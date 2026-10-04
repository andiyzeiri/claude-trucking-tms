"""
Email -> load pipeline.

Reads a mailbox, turns each readable attachment into a load. The model's
only job is to say what the document says; every decision about what
becomes a load is made here, in ordinary code.

Idempotency is the central concern. This runs on a timer, a message can be
redelivered, and a PDF gets forwarded more than once - so the same input
must never produce a second load. Two unique constraints do that work:

    inbound_emails      (company_id, message_id)
    ingested_documents  (company_id, sha256)

Both are enforced by the database, not by checking first and hoping.
"""

import hashlib
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import List, Optional

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.documents.extraction.base import (
    DocumentBytes,
    ExtractionError,
    ExtractionUnavailable,
)
from app.documents.extraction.registry import get_extractor
from app.documents.mapping import build_load_draft
from app.documents.sources.base import SourceAttachment, SourceMessage
from app.documents.sources.imap_mailbox import ImapMailboxReader, MailboxError
from app.models.company import Company
from app.models.customer import Customer
from app.models.load import Load, LoadStatus
from app.models.loads_ai import (
    DocumentStatus,
    InboundEmail,
    InboundEmailStatus,
    IngestedDocument,
)
from app.services.s3 import s3_service

logger = logging.getLogger(__name__)

# Same magic-byte sniffing the upload endpoint uses: an attachment's declared
# type and filename are both attacker-controlled, its leading bytes are not.
_MAGIC = [
    (b"%PDF", "application/pdf"),
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"GIF87a", "image/gif"),
    (b"GIF89a", "image/gif"),
]


def sniff_content_type(content: bytes) -> Optional[str]:
    for magic, media_type in _MAGIC:
        if content.startswith(magic):
            return media_type
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    return None


@dataclass
class IngestSummary:
    """What one poll cycle did. Returned to the caller and logged."""

    enabled: bool = True
    company_id: Optional[int] = None
    mailbox: Optional[str] = None
    messages_seen: int = 0
    messages_new: int = 0
    documents_created: int = 0
    duplicates: int = 0
    retried: int = 0
    unsupported: int = 0
    loads_created: int = 0
    needs_review: int = 0
    failed: int = 0
    errors: List[str] = field(default_factory=list)
    notes: List[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "enabled": self.enabled,
            "company_id": self.company_id,
            "mailbox": self.mailbox,
            "messages_seen": self.messages_seen,
            "messages_new": self.messages_new,
            "documents_created": self.documents_created,
            "duplicates": self.duplicates,
            "retried": self.retried,
            "unsupported": self.unsupported,
            "loads_created": self.loads_created,
            "needs_review": self.needs_review,
            "failed": self.failed,
            "errors": self.errors,
            "notes": self.notes,
        }


def _to_decimal(value: Optional[str]) -> Optional[Decimal]:
    if value in (None, ""):
        return None
    try:
        return Decimal(value)
    except (InvalidOperation, TypeError):
        return None


def _to_naive_datetime(value: Optional[str]) -> Optional[datetime]:
    """
    Draft dates are already wall-clock strings; Load columns are naive
    timestamps. Parse without any timezone conversion, which would move the
    appointment by a day.
    """
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", ""))
    except ValueError:
        return None


async def resolve_company(session: AsyncSession, mailbox: str) -> Optional[Company]:
    """
    Find the tenant that owns this mailbox.

    Matched against companies.loads_ai_source_email - the Source mailbox
    field on the Loads AI page. If nobody has claimed the address, we do not
    guess; ingestion is skipped and says so.
    """
    result = await session.execute(
        select(Company).where(
            func.lower(Company.loads_ai_source_email) == mailbox.strip().lower()
        )
    )
    return result.scalars().first()


async def _store_attachment(
    session: AsyncSession,
    company_id: int,
    email_row: Optional[InboundEmail],
    attachment: SourceAttachment,
    source: str,
) -> tuple[Optional[IngestedDocument], str]:
    """
    Persist one attachment. Returns (document, outcome).

    outcome is one of: created, retry, duplicate, unsupported.

    "retry" means these exact bytes were seen before but extraction failed
    (e.g. the API key was missing at the time). Re-sending the document is
    the natural way for a user to ask for another attempt, so we honour it
    instead of discarding it as a duplicate.
    """
    content_type = sniff_content_type(attachment.content)
    if content_type is None:
        return None, "unsupported"

    digest = hashlib.sha256(attachment.content).hexdigest()

    existing = (
        await session.execute(
            select(IngestedDocument).where(
                IngestedDocument.company_id == company_id,
                IngestedDocument.sha256 == digest,
            )
        )
    ).scalars().first()
    if existing is not None:
        if existing.status == DocumentStatus.FAILED:
            return existing, "retry"
        return None, "duplicate"

    # Filename is never used to build the key - it is untrusted input.
    s3_key = f"companies/{company_id}/documents/{uuid.uuid4()}"
    if settings.USE_S3:
        stored = await run_in_threadpool(
            s3_service.upload_bytes, s3_key, attachment.content, content_type
        )
        if not stored:
            logger.warning("loads-ai: S3 upload failed for %s", attachment.filename)
            s3_key = None
    else:
        s3_key = None

    document = IngestedDocument(
        company_id=company_id,
        inbound_email_id=email_row.id if email_row else None,
        source=source,
        original_filename=attachment.filename,
        s3_key=s3_key,
        content_type=content_type,
        byte_size=len(attachment.content),
        sha256=digest,
        status=DocumentStatus.RECEIVED,
    )
    try:
        # A savepoint, not session.rollback(): a full rollback would also
        # discard the not-yet-committed message row and expire every loaded
        # object, and touching an expired attribute under asyncio raises
        # MissingGreenlet. Only reachable if a concurrent poll inserted the
        # same bytes between the lookup above and here.
        async with session.begin_nested():
            session.add(document)
    except IntegrityError:
        return None, "duplicate"

    return document, "created"


async def _create_load_from_draft(
    session: AsyncSession,
    company_id: int,
    document: IngestedDocument,
    draft: dict,
) -> Optional[Load]:
    """
    Turn a draft into a real load.

    Returns None when the draft cannot become one. That is not a failure
    mode we chose - loads.customer_id is NOT NULL, so a document whose
    broker does not resolve to a customer physically cannot be created
    unattended. Those stay as needs_review.
    """
    customer_id = draft.get("customer_id")
    if not customer_id:
        return None

    # A load number is required by the schema. Prefer what the document
    # said; fall back to the broker's number, then to a traceable
    # machine-generated one rather than inventing something meaningless.
    load_number = (
        draft.get("load_number")
        or draft.get("broker_load_number")
        or f"AI-{document.id}"
    )

    load = Load(
        company_id=company_id,
        customer_id=customer_id,
        load_number=load_number,
        reference_number=draft.get("reference_number"),
        broker_load_number=draft.get("broker_load_number"),
        bol_number=draft.get("bol_number"),
        po_number=draft.get("po_number"),
        description=draft.get("description"),
        pickup_location=draft.get("pickup_location"),
        delivery_location=draft.get("delivery_location"),
        pickup_date=_to_naive_datetime(draft.get("pickup_date")),
        delivery_date=_to_naive_datetime(draft.get("delivery_date")),
        miles=draft.get("miles"),
        rate=_to_decimal(draft.get("rate")),
        fuel_surcharge=_to_decimal(draft.get("fuel_surcharge")),
        accessorial_charges=_to_decimal(draft.get("accessorial_charges")),
        pickup_notes=draft.get("pickup_notes"),
        status=LoadStatus.available,
        # Surfaces the load on the dispatch board so a human lays eyes on
        # something a machine created from an email.
        needs_attention=settings.LOADS_AI_FLAG_CREATED_LOADS,
    )
    session.add(load)
    await session.flush()
    return load


async def process_document(
    session: AsyncSession,
    company_id: int,
    document: IngestedDocument,
    content: bytes,
    summary: IngestSummary,
) -> None:
    """Extract one document and create a load from it where possible."""
    document.status = DocumentStatus.PROCESSING
    document.attempt_count = (document.attempt_count or 0) + 1
    await session.flush()

    try:
        extractor = get_extractor()
        result = await extractor.extract_ratecon(
            DocumentBytes(
                content=content,
                content_type=document.content_type,
                filename=document.original_filename,
            )
        )
    except (ExtractionError, ExtractionUnavailable) as e:
        document.status = DocumentStatus.FAILED
        document.last_error = str(e)[:2000]
        summary.failed += 1
        summary.errors.append(f"{document.original_filename}: {e}")
        logger.warning("loads-ai: extraction failed for %s: %s", document.original_filename, e)
        return

    document.ai_provider = result.usage.provider
    document.ai_model = result.usage.model
    document.input_tokens = result.usage.input_tokens
    document.output_tokens = result.usage.output_tokens
    document.latency_ms = result.usage.latency_ms
    document.extraction = result.extraction.model_dump()
    document.status = DocumentStatus.EXTRACTED

    customers = (
        (await session.execute(select(Customer).where(Customer.company_id == company_id)))
        .scalars()
        .all()
    )
    mapped = build_load_draft(result.extraction, customers=list(customers))
    draft = vars(mapped.draft).copy()
    document.draft = draft
    document.warnings = mapped.warnings

    if not settings.LOADS_AI_AUTO_CREATE_LOADS:
        document.status = DocumentStatus.NEEDS_REVIEW
        summary.needs_review += 1
        return

    load = await _create_load_from_draft(session, company_id, document, draft)
    if load is None:
        document.status = DocumentStatus.NEEDS_REVIEW
        summary.needs_review += 1
        logger.info(
            "loads-ai: %s could not be auto-created (%s)",
            document.original_filename,
            "; ".join(mapped.warnings) or "no customer match",
        )
        return

    document.load_id = load.id
    document.status = DocumentStatus.LOAD_CREATED
    summary.loads_created += 1
    logger.info(
        "loads-ai: created load %s (#%s) from %s",
        load.load_number,
        load.id,
        document.original_filename,
    )


async def ingest_message(
    session: AsyncSession,
    company_id: int,
    message: SourceMessage,
    summary: IngestSummary,
    remaining_documents: int,
) -> int:
    """
    Record one message and process its attachments.

    Returns how many documents it consumed from the per-cycle budget.
    """
    email_row = InboundEmail(
        company_id=company_id,
        source="email",
        message_id=message.message_id,
        from_address=message.from_address,
        to_address=message.to_address,
        subject=message.subject,
        received_at=message.received_at,
        attachment_count=len(message.attachments),
        status=InboundEmailStatus.RECEIVED,
    )
    try:
        # Savepoint for the same reason as in _store_attachment.
        async with session.begin_nested():
            session.add(email_row)
    except IntegrityError:
        # Already ingested on an earlier poll. Expected, not an error.
        return 0

    summary.messages_new += 1
    used = 0
    created_docs = 0

    for attachment in message.attachments:
        if used >= remaining_documents:
            summary.notes.append(
                f"Per-cycle document limit reached; {message.subject!r} has more attachments pending."
            )
            break

        document, outcome = await _store_attachment(
            session, company_id, email_row, attachment, source="email"
        )
        if outcome == "duplicate":
            summary.duplicates += 1
            continue
        if outcome == "unsupported":
            summary.unsupported += 1
            continue

        if outcome == "retry":
            summary.retried += 1
        else:
            created_docs += 1
            summary.documents_created += 1
        used += 1
        await process_document(session, company_id, document, attachment.content, summary)

    email_row.documents_created = created_docs
    email_row.status = (
        InboundEmailStatus.PROCESSED if used else InboundEmailStatus.SKIPPED
    )
    await session.flush()
    return used


async def run_ingestion(session: AsyncSession) -> IngestSummary:
    """
    One poll cycle: read the mailbox, create loads.

    Every exit path returns a summary rather than raising, so the scheduler
    cannot be killed by a bad message or an unreachable mail server.
    """
    summary = IngestSummary()

    if not settings.LOADS_AI_INGESTION_ENABLED:
        summary.enabled = False
        summary.notes.append("Ingestion is disabled (LOADS_AI_INGESTION_ENABLED is false).")
        return summary

    mailbox = (settings.LOADS_AI_IMAP_USERNAME or "").strip()
    password = settings.LOADS_AI_IMAP_PASSWORD
    if not mailbox or not password:
        summary.enabled = False
        summary.errors.append("Mailbox username or password is not configured.")
        return summary

    summary.mailbox = mailbox

    company = await resolve_company(session, mailbox)
    if company is None:
        summary.errors.append(
            f"No company has {mailbox!r} set as its Source mailbox, so there is no "
            f"tenant to file these loads under. Set it on the Loads AI page."
        )
        return summary
    # Read once into a plain int: the rollback in the loop below expires
    # every ORM object, and company.id would then try a lazy reload.
    company_id = company.id
    summary.company_id = company_id

    reader = ImapMailboxReader(
        host=settings.LOADS_AI_IMAP_HOST,
        port=settings.LOADS_AI_IMAP_PORT,
        username=mailbox,
        password=password,
        folder=settings.LOADS_AI_IMAP_FOLDER,
    )

    try:
        # imaplib is blocking; keep it off the event loop.
        messages = await run_in_threadpool(
            reader.fetch_unseen, settings.LOADS_AI_MAX_MESSAGES_PER_POLL
        )
    except MailboxError as e:
        summary.errors.append(str(e))
        logger.warning("loads-ai: %s", e)
        return summary
    except Exception as e:
        summary.errors.append(f"Unexpected mailbox error: {e}")
        logger.exception("loads-ai: unexpected mailbox error")
        return summary

    summary.messages_seen = len(messages)
    budget = settings.LOADS_AI_MAX_DOCUMENTS_PER_POLL

    for message in messages:
        if budget <= 0:
            summary.notes.append("Per-cycle document limit reached; remaining mail stays unread.")
            break
        try:
            budget -= await ingest_message(session, company_id, message, summary, budget)
            await session.commit()
        except Exception as e:
            await session.rollback()
            summary.failed += 1
            summary.errors.append(f"{message.subject!r}: {e}")
            logger.exception("loads-ai: failed ingesting message %s", message.message_id)

    logger.info("loads-ai: ingestion cycle %s", summary.as_dict())
    return summary


async def run_ingestion_job() -> None:
    """Scheduler entry point. Owns its own session."""
    from app.database import AsyncSessionLocal

    if not settings.LOADS_AI_INGESTION_ENABLED:
        return

    async with AsyncSessionLocal() as session:
        try:
            await run_ingestion(session)
        except Exception:
            logger.exception("loads-ai: ingestion job crashed")
