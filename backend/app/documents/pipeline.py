"""
Email -> AI load pipeline.

Reads a mailbox, turns each readable attachment into an AI load: a draft
stored on its ingested_documents row and shown only on the Loads AI page.
The real loads table is never written here; it is reserved for loads the
dispatcher enters by hand. The model's
only job is to say what the document says; every decision about what
becomes a load is made here, in ordinary code.

Idempotency is the central concern. This runs on a timer, a message can be
redelivered, and a PDF gets forwarded more than once - so the same input
must never produce a second AI load. Two unique constraints do that work:

    inbound_emails      (company_id, message_id)
    ingested_documents  (company_id, sha256)

Both are enforced by the database, not by checking first and hoping.
"""

import hashlib
import re
import logging
import uuid
from dataclasses import dataclass, field
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
from app.documents.sources.highway import parse_highway_notification
from app.documents.unverified import record_unverified, verify_with
from app.documents.sources.imap_mailbox import ImapMailboxReader, MailboxError
from app.models.company import Company
from app.models.customer import Customer
from app.models.loads_ai import (
    LIVE_AI_LOAD_STATUSES,
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
    unverified_created: int = 0
    unverified_verified: int = 0
    pods_attached: int = 0
    pods_unmatched: int = 0
    not_loads: int = 0
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
            "unverified_created": self.unverified_created,
            "unverified_verified": self.unverified_verified,
            "pods_attached": self.pods_attached,
            "pods_unmatched": self.pods_unmatched,
            "not_loads": self.not_loads,
            "needs_review": self.needs_review,
            "failed": self.failed,
            "errors": self.errors,
            "notes": self.notes,
        }


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


def _norm_ref(value) -> str:
    """Compare reference numbers on letters and digits only: 'PO# 55-21' == 'po5521'."""
    return re.sub(r"[^A-Za-z0-9]", "", str(value or "")).upper()


# AI load fields a POD's printed numbers are matched against.
_AI_LOAD_REF_FIELDS = ("load_number", "broker_load_number", "bol_number", "po_number", "reference_number")


async def _attach_pod_to_ai_load(
    session: AsyncSession,
    company_id: int,
    document: IngestedDocument,
    classification,
    summary: IngestSummary,
    sender: Optional[str] = None,
) -> None:
    """
    Route a proof of delivery to the AI load it belongs to.

    Matched on any reference number printed on the POD against the AI load's
    load / broker / BOL / PO / reference numbers. An existing POD is never
    overwritten, and an ambiguous match is left for a person.
    """
    refs = {_norm_ref(r) for r in (classification.reference_numbers or [])}
    refs = {r for r in refs if len(r) >= 4}   # ignore stray short numbers ("1", "53")
    document.draft = None  # a POD document is not itself an AI load

    candidates = (
        await session.execute(
            select(IngestedDocument).where(
                IngestedDocument.company_id == company_id,
                IngestedDocument.status.in_(LIVE_AI_LOAD_STATUSES),
                IngestedDocument.id != document.id,
                IngestedDocument.draft.isnot(None),
            )
        )
    ).scalars().all()
    matches = []
    for doc in candidates:
        f = doc.draft if isinstance(doc.draft, dict) else {}
        own = {_norm_ref(f.get(k)) for k in _AI_LOAD_REF_FIELDS if f.get(k)}
        hit = refs & own
        if hit:
            matches.append((doc, sorted(hit)))

    label = lambda d: (d.draft or {}).get("load_number") or (d.draft or {}).get("broker_load_number") or f"#{d.id}"
    pod_url = f"/api/v1/uploads/s3/{document.s3_key}" if document.s3_key else None

    # No number on the paper matched: fall back to who sent it. A driver
    # emailing pods@ is almost always sending the POD for the load they just
    # delivered, i.e. their most recent AI load still missing one.
    if not matches and sender:
        driver = await _driver_by_email(session, company_id, sender)
        if driver is not None:
            mine = []
            for doc in candidates:
                f = doc.draft if isinstance(doc.draft, dict) else {}
                if str(f.get("driver_id") or "") == str(driver.id) and not f.get("pod_url") and f.get("status") != "invoiced":
                    mine.append(doc)
            if mine:
                mine.sort(key=lambda d: str((d.draft or {}).get("delivery_date") or ""), reverse=True)
                matches = [(mine[0], [f"sender {driver.first_name} {driver.last_name}".strip()])]

    if len(matches) == 1 and pod_url:
        target, hit = matches[0]
        if (target.draft or {}).get("pod_url"):
            document.status = DocumentStatus.POD_UNMATCHED
            document.warnings = [f"Proof of delivery for load {label(target)}, which already has a POD - kept the existing one."]
            summary.pods_unmatched += 1
        else:
            merged = dict(target.draft)
            merged["pod_url"] = pod_url
            target.draft = merged
            document.status = DocumentStatus.POD_ATTACHED
            document.warnings = [f"Attached as the POD for load {label(target)} (matched {', '.join(hit)})."]
            summary.pods_attached += 1
            logger.info("loads-ai: POD %s attached to AI load %s", document.original_filename, target.id)
        return

    document.status = DocumentStatus.POD_UNMATCHED
    if not pod_url:
        document.warnings = ["Proof of delivery, but the file could not be stored, so it was not attached."]
    elif len(matches) > 1:
        document.warnings = ["Proof of delivery matching more than one load (" + ", ".join(label(d) for d, _ in matches[:5]) + ") - attach it by hand."]
    else:
        shown = ", ".join(sorted(classification.reference_numbers or [])[:6]) or "none readable"
        document.warnings = [f"Proof of delivery, but no AI load matches its numbers ({shown})."]
    summary.pods_unmatched += 1


async def process_document(
    session: AsyncSession,
    company_id: int,
    document: IngestedDocument,
    content: bytes,
    summary: IngestSummary,
    mode: str = "auto",
    sender: Optional[str] = None,
) -> None:
    """
    Route one document by the inbox it came from:

      mode "ratecon" (ratecons@)  -> always a new AI load
      mode "pod"     (pods@)      -> always filed as a POD on the matching AI load
      mode "auto"    (one shared inbox) -> classified, then routed as below

      rate confirmation (or unclear)  -> a new AI load, with the PDF as its ratecon
      proof of delivery / signed BOL  -> attached as the POD of the AI load it matches
      invoice / unsigned BOL / other  -> recorded, no AI load
    """
    document.status = DocumentStatus.PROCESSING
    document.attempt_count = (document.attempt_count or 0) + 1
    await session.flush()

    doc_bytes = DocumentBytes(
        content=content,
        content_type=document.content_type,
        filename=document.original_filename,
    )
    try:
        extractor = get_extractor()
        if mode == "ratecon":
            # The ratecons inbox only receives rate confirmations; no need to ask.
            result = await extractor.extract_ratecon(doc_bytes)
            document.doc_type = "ratecon"
            c = None
        else:
            classified = await extractor.classify(doc_bytes)
            c = classified.classification
            document.doc_type = c.doc_type
            document.doc_type_confidence = c.confidence

        is_pod = c is not None and (mode == "pod" or c.doc_type == "pod" or (c.doc_type == "bol" and c.has_signature))
        if is_pod:
            document.extraction = {"classification": c.model_dump()}
            document.ai_provider = classified.usage.provider
            document.ai_model = classified.usage.model
            await _attach_pod_to_ai_load(session, company_id, document, c, summary, sender=sender)
            return
        if c is not None and c.doc_type in ("invoice", "bol", "other") and c.confidence >= 0.6:
            document.extraction = {"classification": c.model_dump()}
            document.draft = None
            document.status = DocumentStatus.NOT_A_LOAD
            document.warnings = [f"Read as {'an invoice' if c.doc_type == 'invoice' else 'an unsigned bill of lading' if c.doc_type == 'bol' else 'other paperwork'} - no load created."]
            summary.not_loads += 1
            return

        # Rate confirmation - or genuinely unclear, which is read as one so a
        # real load is never silently dropped.
        if c is not None:
            result = await extractor.extract_ratecon(doc_bytes)
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
    # Attach the source document as the AI load's rate confirmation, in the
    # same /uploads/s3 form the Ratecon column already opens.
    if document.s3_key:
        draft["ratecon_url"] = f"/api/v1/uploads/s3/{document.s3_key}"
    document.draft = draft
    document.warnings = mapped.warnings

    # The draft IS the AI load. It lives only on this document row and is
    # shown on the Loads AI page; nothing is written to the real loads
    # table, which stays reserved for manually entered loads (and so never
    # leaks into invoicing, payroll or reports).
    document.status = DocumentStatus.AI_LOAD
    summary.loads_created += 1
    # A Highway notice may have announced this load already: verify it.
    await session.flush()
    if await verify_with(session, company_id, document):
        summary.unverified_verified += 1
    logger.info(
        "loads-ai: AI load %s ready from %s (document #%s)",
        draft.get("load_number") or draft.get("broker_load_number") or "(no number)",
        document.original_filename,
        document.id,
    )


async def ingest_message(
    session: AsyncSession,
    company_id: int,
    message: SourceMessage,
    summary: IngestSummary,
    remaining_documents: int,
    mode: str = "auto",
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

    # Highway sends a notice instead of the rate confirmation. Record it as
    # an unverified load (rate confirmations inbox / shared inbox only).
    if mode != "pod":
        notice = parse_highway_notification(message.subject, message.from_address, message.body_text)
        if notice is not None:
            _, outcome = await record_unverified(
                session, company_id,
                load_id=notice.load_id, broker_name=notice.broker_name, contact_name=notice.contact_name,
                source="highway", inbound_email_id=email_row.id,
            )
            if outcome == "created":
                summary.unverified_created += 1
                created_docs += 1
            logger.info("loads-ai: Highway notice for load %s (%s): %s", notice.load_id, notice.broker_name, outcome)

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
        await process_document(
            session, company_id, document, attachment.content, summary,
            mode=mode, sender=message.from_address,
        )

    email_row.documents_created = created_docs
    email_row.status = (
        InboundEmailStatus.PROCESSED if (used or created_docs) else InboundEmailStatus.SKIPPED
    )
    await session.flush()
    return used


async def _driver_by_email(session: AsyncSession, company_id: int, sender: str):
    """The company's driver whose email is this message's sender, if any."""
    from email.utils import parseaddr

    from app.models.driver import Driver

    address = (parseaddr(sender or "")[1] or "").strip().lower()
    if not address:
        return None
    return (
        await session.execute(
            select(Driver).where(Driver.company_id == company_id, func.lower(Driver.email) == address)
        )
    ).scalars().first()


async def _poll_mailbox(
    session: AsyncSession,
    company_id: int,
    username: str,
    password: str,
    mode: str,
    summary: IngestSummary,
    budget: int,
) -> int:
    """Read one inbox and process its unread mail. Returns the remaining document budget."""
    reader = ImapMailboxReader(
        host=settings.LOADS_AI_IMAP_HOST,
        port=settings.LOADS_AI_IMAP_PORT,
        username=username,
        password=password,
        folder=settings.LOADS_AI_IMAP_FOLDER,
    )
    try:
        # imaplib is blocking; keep it off the event loop.
        messages = await run_in_threadpool(reader.fetch_unseen, settings.LOADS_AI_MAX_MESSAGES_PER_POLL)
    except MailboxError as e:
        summary.errors.append(f"{username}: {e}")
        logger.warning("loads-ai: %s: %s", username, e)
        return budget
    except Exception as e:
        summary.errors.append(f"{username}: unexpected mailbox error: {e}")
        logger.exception("loads-ai: unexpected mailbox error (%s)", username)
        return budget

    summary.messages_seen += len(messages)
    for message in messages:
        if budget <= 0:
            summary.notes.append("Per-cycle document limit reached; remaining mail stays unread.")
            break
        try:
            budget -= await ingest_message(session, company_id, message, summary, budget, mode=mode)
            await session.commit()
        except Exception as e:
            await session.rollback()
            summary.failed += 1
            summary.errors.append(f"{message.subject!r}: {e}")
            logger.exception("loads-ai: failed ingesting message %s", message.message_id)
    return budget


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
    pod_setting = (company.loads_ai_pod_email or "").strip().lower()
    summary.company_id = company_id

    pod_mailbox = (settings.LOADS_AI_POD_IMAP_USERNAME or "").strip()
    pod_password = settings.LOADS_AI_POD_IMAP_PASSWORD
    # Read pods@ only once it is both connected (credentials) and named as
    # this company's POD inbox on the Loads AI page - the same opt-in the
    # rate confirmations inbox requires.
    has_pod_inbox = bool(pod_mailbox and pod_password and pod_setting == pod_mailbox.lower())
    if pod_mailbox and pod_password and not has_pod_inbox:
        summary.notes.append(f"{pod_mailbox} is connected but not set as the POD inbox on the Loads AI page.")
    if has_pod_inbox:
        summary.mailbox = f"{mailbox}, {pod_mailbox}"

    budget = settings.LOADS_AI_MAX_DOCUMENTS_PER_POLL
    # With a dedicated pods inbox, the main inbox is rate confirmations only;
    # with a single shared inbox, each document is classified.
    budget = await _poll_mailbox(
        session, company_id, mailbox, password, "ratecon" if has_pod_inbox else "auto", summary, budget
    )
    if has_pod_inbox:
        await _poll_mailbox(session, company_id, pod_mailbox, pod_password, "pod", summary, budget)

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
