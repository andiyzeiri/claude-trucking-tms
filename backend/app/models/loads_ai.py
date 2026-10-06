"""
Loads AI ingestion models.

Two tables, deliberately kept minimal:

  inbound_emails    one row per message pulled from the mailbox
  ingested_documents  one row per attachment, carrying its extraction and
                      whatever load was created from it

Both exist primarily so the pipeline is idempotent and auditable. An email
that arrives twice, or a PDF forwarded twice, must not produce two loads -
that is enforced by unique constraints here rather than by hoping the mail
server behaves.
"""

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from .base import Base


class InboundEmailStatus:
    """Lifecycle of a single message."""

    RECEIVED = "received"      # stored, not yet processed
    PROCESSED = "processed"    # all attachments handled
    SKIPPED = "skipped"        # nothing worth reading (no usable attachments)
    FAILED = "failed"          # could not be parsed


class DocumentStatus:
    """Lifecycle of a single attachment."""

    RECEIVED = "received"
    PROCESSING = "processing"
    EXTRACTED = "extracted"
    AI_LOAD = "ai_load"               # draft is live as an AI load on the Loads AI page
    DISMISSED = "dismissed"           # AI load deleted from the Loads AI page (soft delete)
    POD_ATTACHED = "pod_attached"     # a proof of delivery, attached to the AI load it matched
    POD_UNMATCHED = "pod_unmatched"   # a proof of delivery no AI load could be matched to
    NOT_A_LOAD = "not_a_load"         # invoice / unsigned BOL / other paperwork: no AI load
    UNVERIFIED = "unverified"         # load known from a notice (Highway) - waiting for its rate confirmation
    VERIFIED = "verified"             # unverified load whose rate confirmation arrived (now an AI load)
    # Legacy: rows written before AI loads were separated from the loads table.
    LOAD_CREATED = "load_created"     # a real load was created from this document
    NEEDS_REVIEW = "needs_review"     # extracted but could not be auto-created
    DUPLICATE = "duplicate"           # same bytes already seen
    UNSUPPORTED = "unsupported"       # not a document type we can read
    FAILED = "failed"


# Documents whose draft is shown as an AI load on the Loads AI page.
# load_created / needs_review predate AI loads being kept off the loads table.
LIVE_AI_LOAD_STATUSES = (
    DocumentStatus.AI_LOAD,
    DocumentStatus.LOAD_CREATED,
    DocumentStatus.NEEDS_REVIEW,
    DocumentStatus.EXTRACTED,
)


class InboundEmail(Base):
    """A message pulled from the configured mailbox."""

    __tablename__ = "inbound_emails"

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)

    # 'email' today; 'highway' or 'manual' later. The pipeline below this
    # layer does not care which.
    source = Column(String, nullable=False, default="email")

    # RFC Message-ID. The dedupe key - the same message seen on a second poll
    # must not be reprocessed.
    message_id = Column(String, nullable=False)
    mailbox = Column(String)  # the inbox it was read from (ratecons@ / pods@)

    from_address = Column(String)
    to_address = Column(String)
    subject = Column(Text)
    received_at = Column(DateTime)

    status = Column(String, nullable=False, default=InboundEmailStatus.RECEIVED, index=True)
    error = Column(Text)
    attachment_count = Column(Integer, default=0)
    documents_created = Column(Integer, default=0)
    loads_created = Column(Integer, default=0)

    documents = relationship("IngestedDocument", back_populates="inbound_email")

    __table_args__ = (
        UniqueConstraint("company_id", "message_id", name="uq_inbound_emails_company_message"),
    )


class IngestedDocument(Base):
    """One attachment, its extraction, and whatever came of it."""

    __tablename__ = "ingested_documents"

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    inbound_email_id = Column(
        Integer, ForeignKey("inbound_emails.id"), nullable=True, index=True
    )

    source = Column(String, nullable=False, default="email")
    original_filename = Column(String)
    s3_key = Column(String)
    content_type = Column(String)
    byte_size = Column(BigInteger)

    # Content hash. Dedupe key - the same bytes must never become two loads,
    # however many times they are emailed.
    sha256 = Column(String(64), nullable=False)

    doc_type = Column(String)
    doc_type_confidence = Column(Numeric(5, 4))

    status = Column(String, nullable=False, default=DocumentStatus.RECEIVED, index=True)

    # The validated model output, the mapped draft, and anything the mapping
    # layer wanted a human to know. Kept verbatim so a bad load can always be
    # traced back to what the document actually said.
    extraction = Column(JSONB)
    draft = Column(JSONB)
    warnings = Column(JSONB)

    # Model/cost metadata, for auditing spend and debugging a bad read.
    ai_provider = Column(String)
    ai_model = Column(String)
    input_tokens = Column(Integer)
    output_tokens = Column(Integer)
    latency_ms = Column(Integer)

    load_id = Column(Integer, ForeignKey("loads.id"), nullable=True, index=True)
    attempt_count = Column(Integer, nullable=False, default=0)
    last_error = Column(Text)

    inbound_email = relationship("InboundEmail", back_populates="documents")

    __table_args__ = (
        UniqueConstraint("company_id", "sha256", name="uq_ingested_documents_company_sha256"),
    )
