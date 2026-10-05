"""
Loads AI endpoints.

Loads AI is the sandbox board for the document-automation pipeline. For now
the only thing it owns is its source mailbox - the inbox that loads will be
drawn from once ingestion lands.

Admin-only throughout, matching the page's own gating: pointing the pipeline
at a different mailbox decides which messages the system will read, so it is
not exposed to dispatchers, drivers, customers, or viewers.
"""

import hashlib
import logging
import uuid
from typing import Any, Dict, List, Optional

from email_validator import EmailNotValidError, validate_email
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.security import get_current_admin_user
from app.database import get_db
from app.documents.extraction.base import (
    DocumentBytes,
    ExtractionError,
    ExtractionUnavailable,
)
from app.documents.extraction.registry import get_extractor
from app.documents.mapping import build_load_draft, extraction_field_map, rank_customers
from app.documents.pipeline import resolve_company, run_ingestion
from app.models.company import Company
from app.models.customer import Customer
from app.models.load import Load
from app.models.loads_ai import LIVE_AI_LOAD_STATUSES, DocumentStatus, IngestedDocument
from app.sms.ai_loads import view as ai_view
from app.sms.assignment import notify_ai_load_assigned
from app.documents.unverified import verify_with
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


class LoadsAISettingsResponse(BaseModel):
    """Current Loads AI configuration for the caller's company."""

    source_email: Optional[str] = None   # rate confirmations inbox
    pod_email: Optional[str] = None      # driver POD inbox

    class Config:
        from_attributes = True


class LoadsAISettingsUpdate(BaseModel):
    source_email: Optional[str] = None
    pod_email: Optional[str] = None

    @field_validator("source_email", "pod_email", mode="before")
    @classmethod
    def normalize_source_email(cls, v):
        """
        Normalize and validate the address.

        An empty string clears the setting rather than storing "" - the UI
        sends the field back verbatim, and a blank box means "no source",
        not "a source whose address is the empty string".
        """
        if v is None:
            return None

        candidate = str(v).strip()
        if not candidate:
            return None

        try:
            # No deliverability check: it would do a DNS lookup on every save
            # and fail for an internal-only address that is perfectly valid
            # as an SES receipt target.
            return validate_email(candidate, check_deliverability=False).normalized
        except EmailNotValidError as e:
            raise ValueError(f"Invalid email address: {e}") from e


async def _get_company(db: AsyncSession, company_id: int) -> Company:
    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found",
        )
    return company


@router.get("/settings", response_model=LoadsAISettingsResponse)
async def get_loads_ai_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Read the Loads AI source mailbox for the caller's company."""
    company = await _get_company(db, current_user.company_id)
    return LoadsAISettingsResponse(source_email=company.loads_ai_source_email, pod_email=company.loads_ai_pod_email)


@router.put("/settings", response_model=LoadsAISettingsResponse)
async def update_loads_ai_settings(
    payload_in: LoadsAISettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Set (or clear) the Loads AI source mailbox for the caller's company."""
    company = await _get_company(db, current_user.company_id)

    # exclude_unset so an omitted field is left alone, while an explicit null
    # or empty string clears it.
    payload = payload_in.model_dump(exclude_unset=True)
    if "source_email" in payload:
        previous = company.loads_ai_source_email
        company.loads_ai_source_email = payload["source_email"]
        logger.info(
            "loads-ai: company %s source mailbox %r -> %r (by user %s)",
            company.id,
            previous,
            company.loads_ai_source_email,
            current_user.id,
        )
    if "pod_email" in payload:
        logger.info("loads-ai: company %s POD mailbox %r -> %r (by user %s)",
                    company.id, company.loads_ai_pod_email, payload["pod_email"], current_user.id)
        company.loads_ai_pod_email = payload["pod_email"]

    await db.commit()
    await db.refresh(company)

    return LoadsAISettingsResponse(source_email=company.loads_ai_source_email, pod_email=company.loads_ai_pod_email)


# ---------------------------------------------------------------------------
# Document extraction
# ---------------------------------------------------------------------------

# Allowed uploads, identified by magic bytes rather than by filename or the
# browser-supplied Content-Type. Attachments are untrusted input; an extension
# proves nothing.
_MAGIC = [
    (b"%PDF", "application/pdf"),
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"GIF87a", "image/gif"),
    (b"GIF89a", "image/gif"),
]


def sniff_content_type(content: bytes) -> Optional[str]:
    """Identify an upload by its leading bytes. None means unsupported."""
    for magic, media_type in _MAGIC:
        if content.startswith(magic):
            return media_type
    # WEBP is RIFF....WEBP
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    return None


class ExtractedFieldResponse(BaseModel):
    value: Optional[str] = None
    confidence: float = 0.0
    source_text: Optional[str] = None


class CustomerCandidateResponse(BaseModel):
    id: int
    name: str
    mc: Optional[str] = None
    score: float
    reason: str


class LoadDraftResponse(BaseModel):
    """
    Proposed Load column values. Money is a string so no float ever touches a
    rate; the client parses it for display.
    """

    load_number: Optional[str] = None
    reference_number: Optional[str] = None
    broker_load_number: Optional[str] = None
    bol_number: Optional[str] = None
    po_number: Optional[str] = None
    customer_id: Optional[int] = None
    pickup_location: Optional[str] = None
    delivery_location: Optional[str] = None
    pickup_date: Optional[str] = None
    delivery_date: Optional[str] = None
    rate: Optional[str] = None
    fuel_surcharge: Optional[str] = None
    accessorial_charges: Optional[str] = None
    miles: Optional[int] = None
    description: Optional[str] = None
    pickup_notes: Optional[str] = None
    status: str = "available"


class ExtractionUsageResponse(BaseModel):
    provider: str
    model: str
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    latency_ms: Optional[int] = None
    prompt_version: str
    schema_version: str


class ExtractDocumentResponse(BaseModel):
    filename: Optional[str] = None
    content_type: str
    doc_type: Optional[str] = None
    doc_type_confidence: Optional[float] = None
    draft: LoadDraftResponse
    fields: Dict[str, ExtractedFieldResponse]
    customer_candidates: List[CustomerCandidateResponse]
    warnings: List[str]
    usage: ExtractionUsageResponse


@router.post("/extract", response_model=ExtractDocumentResponse)
async def extract_document(
    file: UploadFile = File(...),
    classify: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Read a rate confirmation and return a proposed load.

    Nothing is persisted. The response is a draft for the caller to review,
    edit and explicitly accept - the model's output never becomes a load on
    its own.

    Set classify=true to also have the document's type identified. That is a
    second model call and roughly doubles the cost, so it defaults off: this
    endpoint is reached from an explicit "upload a rate confirmation" action,
    where the type is already asserted by the user.
    """
    content = await file.read()

    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty.",
        )

    if len(content) > settings.DOCUMENT_MAX_UPLOAD_BYTES:
        limit_mb = settings.DOCUMENT_MAX_UPLOAD_BYTES // (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File is larger than the {limit_mb}MB limit.",
        )

    content_type = sniff_content_type(content)
    if content_type is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Unsupported file type. Upload a PDF or a photo "
                "(JPEG, PNG, GIF or WebP)."
            ),
        )

    doc = DocumentBytes(
        content=content,
        content_type=content_type,
        filename=file.filename,
    )

    try:
        extractor = get_extractor()
    except ExtractionUnavailable as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)
        ) from e

    doc_type: Optional[str] = None
    doc_type_confidence: Optional[float] = None

    try:
        if classify:
            classification = await extractor.classify(doc)
            doc_type = classification.classification.doc_type
            doc_type_confidence = classification.classification.confidence

        result = await extractor.extract_ratecon(doc)
    except ExtractionUnavailable as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)
        ) from e
    except ExtractionError as e:
        # The upstream model call failed or returned something unusable. That
        # is a gateway-side problem, not a bad request from the client.
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e)
        ) from e

    # Customers for this tenant only - broker matching must never see another
    # company's customer list.
    customers = (
        (
            await db.execute(
                select(Customer).where(Customer.company_id == current_user.company_id)
            )
        )
        .scalars()
        .all()
    )

    mapped = build_load_draft(result.extraction, customers=list(customers))

    warnings = list(mapped.warnings)
    if doc_type and doc_type != "ratecon":
        warnings.insert(
            0,
            f"This document was classified as {doc_type!r}, not a rate confirmation. "
            "The extracted fields are probably not meaningful.",
        )

    logger.info(
        "loads-ai: extracted %s for company %s (%s warnings, customer_id=%s)",
        file.filename,
        current_user.company_id,
        len(warnings),
        mapped.draft.customer_id,
    )

    return ExtractDocumentResponse(
        filename=file.filename,
        content_type=content_type,
        doc_type=doc_type,
        doc_type_confidence=doc_type_confidence,
        draft=LoadDraftResponse(**vars(mapped.draft)),
        fields={
            name: ExtractedFieldResponse(**payload)
            for name, payload in extraction_field_map(result.extraction).items()
        },
        customer_candidates=[
            CustomerCandidateResponse(**vars(c)) for c in mapped.customer_candidates
        ],
        warnings=warnings,
        usage=ExtractionUsageResponse(**vars(result.usage)),
    )


# ---------------------------------------------------------------------------
# Email ingestion
# ---------------------------------------------------------------------------


class IngestionStatusResponse(BaseModel):
    """Whether automatic ingestion is actually able to run, and why not."""

    enabled: bool
    mailbox: Optional[str] = None
    credentials_configured: bool
    extraction_configured: bool
    poll_minutes: int
    mailbox_matches_company: bool
    blockers: List[str]
    # Driver POD inbox
    pod_mailbox: Optional[str] = None
    pod_credentials_configured: bool = False
    pod_mailbox_matches_company: bool = False
    pod_blockers: List[str] = []


@router.get("/ingestion-status", response_model=IngestionStatusResponse)
async def ingestion_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Report whether email ingestion can run, naming anything that blocks it.

    Exists because the failure modes are all configuration, and a silent
    no-op is the worst way to discover that.
    """
    mailbox = (settings.LOADS_AI_IMAP_USERNAME or "").strip() or None
    creds = bool(mailbox and settings.LOADS_AI_IMAP_PASSWORD)
    blockers: List[str] = []

    if not settings.LOADS_AI_INGESTION_ENABLED:
        blockers.append("Ingestion is switched off (LOADS_AI_INGESTION_ENABLED).")
    if not mailbox:
        blockers.append("No mailbox username configured.")
    if mailbox and not settings.LOADS_AI_IMAP_PASSWORD:
        blockers.append("No mailbox password configured (Gmail needs an App Password).")
    if not settings.ANTHROPIC_API_KEY:
        blockers.append("ANTHROPIC_API_KEY is not configured, so documents cannot be read.")

    matches = False
    if mailbox:
        company = await resolve_company(db, mailbox)
        matches = company is not None and company.id == current_user.company_id
        if company is None:
            blockers.append(
                f"Enter {mailbox} in the rate confirmations inbox field above to start reading it."
            )
        elif company.id != current_user.company_id:
            blockers.append(f"{mailbox} is claimed by a different company.")

    pod_mailbox = (settings.LOADS_AI_POD_IMAP_USERNAME or "").strip() or None
    pod_creds = bool(pod_mailbox and settings.LOADS_AI_POD_IMAP_PASSWORD)
    pod_blockers: List[str] = []
    company_row = await _get_company(db, current_user.company_id)
    pod_setting = (company_row.loads_ai_pod_email or "").strip().lower()
    pod_matches = bool(pod_mailbox and pod_setting == pod_mailbox.lower())
    if not pod_mailbox:
        pod_blockers.append("No POD inbox is connected yet (run the setup script with MAILBOX_KIND=pod).")
    elif not settings.LOADS_AI_POD_IMAP_PASSWORD:
        pod_blockers.append("The POD inbox has no App Password stored.")
    elif not pod_matches:
        pod_blockers.append(f"Enter {pod_mailbox} in the POD inbox field above to start reading it.")

    return IngestionStatusResponse(
        enabled=settings.LOADS_AI_INGESTION_ENABLED,
        pod_mailbox=pod_mailbox,
        pod_credentials_configured=pod_creds,
        pod_mailbox_matches_company=pod_matches,
        pod_blockers=pod_blockers,
        mailbox=mailbox,
        credentials_configured=creds,
        extraction_configured=bool(settings.ANTHROPIC_API_KEY),
        poll_minutes=settings.LOADS_AI_POLL_MINUTES,
        mailbox_matches_company=matches,
        blockers=blockers,
    )


class IngestSummaryResponse(BaseModel):
    enabled: bool
    company_id: Optional[int] = None
    mailbox: Optional[str] = None
    messages_seen: int
    messages_new: int
    documents_created: int
    duplicates: int
    retried: int = 0
    unsupported: int
    loads_created: int
    needs_review: int
    failed: int
    errors: List[str]
    notes: List[str]


@router.post("/poll", response_model=IngestSummaryResponse)
async def poll_mailbox_now(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Run one ingestion cycle immediately.

    Same code path the scheduler uses, so what you see here is what the
    timer does. Returns a summary rather than raising, so a misconfigured
    mailbox reports the reason instead of a 500.
    """
    # Captured before the run: a rollback inside it expires current_user,
    # and reading an expired attribute afterwards raises MissingGreenlet.
    user_id = current_user.id
    summary = await run_ingestion(db)
    logger.info("loads-ai: manual poll by user %s -> %s", user_id, summary.as_dict())
    return IngestSummaryResponse(**summary.as_dict())


class IngestedDocumentResponse(BaseModel):
    id: int
    original_filename: Optional[str] = None
    content_type: Optional[str] = None
    status: str
    doc_type: Optional[str] = None
    load_id: Optional[int] = None
    load_number: Optional[str] = None
    warnings: List[str] = []
    draft: Optional[dict] = None
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    latency_ms: Optional[int] = None
    last_error: Optional[str] = None
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


@router.get("/documents", response_model=List[IngestedDocumentResponse])
async def list_ingested_documents(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Recently ingested documents and what became of each."""
    limit = max(1, min(limit, 200))

    result = await db.execute(
        select(IngestedDocument, Load.load_number)
        .outerjoin(Load, Load.id == IngestedDocument.load_id)
        .where(IngestedDocument.company_id == current_user.company_id)
        .order_by(IngestedDocument.id.desc())
        .limit(limit)
    )

    out: List[IngestedDocumentResponse] = []
    for doc, load_number in result.all():
        warnings = doc.warnings if isinstance(doc.warnings, list) else []
        out.append(
            IngestedDocumentResponse(
                id=doc.id,
                original_filename=doc.original_filename,
                content_type=doc.content_type,
                status=doc.status,
                doc_type=doc.doc_type,
                load_id=doc.load_id,
                load_number=load_number,
                warnings=warnings,
                draft=doc.draft if isinstance(doc.draft, dict) else None,
                input_tokens=doc.input_tokens,
                output_tokens=doc.output_tokens,
                latency_ms=doc.latency_ms,
                last_error=doc.last_error,
                created_at=doc.created_at.isoformat() if doc.created_at else None,
            )
        )
    return out


# --- AI loads ---------------------------------------------------------------
#
# An AI load is the draft stored on an ingested_documents row. These
# endpoints back the Loads AI page and deliberately never touch the real
# loads table: that table holds only manually entered loads, and everything
# downstream of it (invoices, payroll, reports) must not see AI output.

# Keys the page may store on an AI load. Anything else is dropped, so the
# JSONB column cannot be used as an arbitrary blob store.
AI_LOAD_FIELDS = {
    "load_number", "reference_number", "broker_load_number", "bol_number",
    "po_number", "customer_id", "driver_id", "truck_id",
    "pickup_location", "delivery_location", "pickup_date", "delivery_date",
    "rate", "fuel_surcharge", "accessorial_charges", "miles", "weight",
    "description", "pickup_notes", "delivery_notes", "notes", "status",
    "pod_url", "ratecon_url", "adjustment_type", "adjustment_amount",
    "invoiced", "dispatched", "needs_attention",
    "broker_name", "broker_mc", "customer_confirmed",
}

# Customer match thresholds, on rank_customers' score. 0.95 is an MC match
# or a name equal after dropping punctuation and Inc/LLC-style suffixes;
# 0.60 is rank_customers' own floor for listing a candidate at all.
CUSTOMER_EXACT = 0.95
CUSTOMER_PARTIAL = 0.60

# Statuses whose draft is a live AI load. load_created/needs_review are
# documents from before AI loads were separated; their drafts are shown
# too so nothing extracted so far disappears from the page.


def _clean_ai_load_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        raise HTTPException(status_code=422, detail="Expected a JSON object.")
    return {k: v for k, v in payload.items() if k in AI_LOAD_FIELDS}


class CustomerMatchCandidate(BaseModel):
    id: int
    name: str
    score: float
    reason: str


class AILoadResponse(BaseModel):
    id: int  # the ingested_documents id
    source: str
    original_filename: Optional[str] = None
    document_status: str
    warnings: List[str] = []
    created_at: Optional[str] = None
    fields: Dict[str, Any]
    # exact (green) / partial (orange) / none (red)
    customer_match: str = "none"
    customer_match_reason: Optional[str] = None
    broker_name: Optional[str] = None
    customer_candidates: List[CustomerMatchCandidate] = []


def _extracted(doc: IngestedDocument, key: str) -> Optional[str]:
    """A value from the stored extraction, for drafts saved before broker_name was kept."""
    ex = doc.extraction if isinstance(doc.extraction, dict) else {}
    value = (ex.get(key) or {}).get("value") if isinstance(ex.get(key), dict) else None
    return value or None


def _match_customer(doc: IngestedDocument, fields: Dict[str, Any], customers: List[Customer]):
    """
    Resolve the AI load's customer against the company's current customers.

    Done at read time rather than once at ingestion, so adding a missing
    customer on the Customers page turns a red row green with no re-processing.
    Returns (customer_id, match, reason, broker_name, candidates).
    """
    by_id = {c.id: c for c in customers}
    broker_name = fields.get("broker_name") or _extracted(doc, "broker_name")
    broker_mc = fields.get("broker_mc") or _extracted(doc, "broker_mc_number")

    # A customer the user picked is authoritative, while it still exists.
    stored_id = fields.get("customer_id")
    if fields.get("customer_confirmed") and stored_id in by_id:
        return stored_id, "exact", "Chosen by you", broker_name, []

    candidates = rank_customers(broker_name, broker_mc, customers)
    shown = [
        CustomerMatchCandidate(id=c.id, name=c.name, score=c.score, reason=c.reason)
        for c in candidates
    ]
    if candidates and candidates[0].score >= CUSTOMER_EXACT:
        return candidates[0].id, "exact", candidates[0].reason, broker_name, shown
    if candidates and candidates[0].score >= CUSTOMER_PARTIAL:
        return candidates[0].id, "partial", candidates[0].reason, broker_name, shown

    # Nothing to match on (e.g. a row added by hand): keep whatever customer
    # it carries, but unconfirmed, so it still asks to be checked.
    if not broker_name and stored_id in by_id:
        return stored_id, "partial", "Not confirmed", broker_name, shown
    reason = (
        f"{broker_name!r} is not on the Customers page" if broker_name
        else "No broker name on the document"
    )
    return None, "none", reason, broker_name, shown


def _ai_load_response(doc: IngestedDocument, customers: List[Customer]) -> AILoadResponse:
    fields = dict(doc.draft) if isinstance(doc.draft, dict) else {}
    # AI loads created before the source PDF was attached at extraction
    # time: show it as the ratecon. Only when the key is absent - a ratecon
    # the user removed is stored as null and stays removed.
    if "ratecon_url" not in fields and doc.s3_key:
        fields["ratecon_url"] = f"/api/v1/uploads/s3/{doc.s3_key}"
    customer_id, match, reason, broker_name, candidates = _match_customer(doc, fields, customers)
    fields["customer_id"] = customer_id
    return AILoadResponse(
        id=doc.id,
        source=doc.source,
        original_filename=doc.original_filename,
        document_status=doc.status,
        warnings=doc.warnings if isinstance(doc.warnings, list) else [],
        created_at=doc.created_at.isoformat() if doc.created_at else None,
        fields=fields,
        customer_match=match,
        customer_match_reason=reason,
        broker_name=broker_name,
        customer_candidates=candidates,
    )


async def _company_customers(db: AsyncSession, company_id: int) -> List[Customer]:
    result = await db.execute(select(Customer).where(Customer.company_id == company_id))
    return list(result.scalars().all())


async def _get_ai_load(db: AsyncSession, company_id: int, ai_load_id: int) -> IngestedDocument:
    doc = (
        await db.execute(
            select(IngestedDocument).where(
                IngestedDocument.id == ai_load_id,
                IngestedDocument.company_id == company_id,
                IngestedDocument.status.in_(LIVE_AI_LOAD_STATUSES),
            )
        )
    ).scalars().first()
    if doc is None:
        raise HTTPException(status_code=404, detail="AI load not found.")
    return doc


@router.get("/loads", response_model=List[AILoadResponse])
async def list_ai_loads(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Every live AI load for the caller's company, newest first."""
    result = await db.execute(
        select(IngestedDocument)
        .where(
            IngestedDocument.company_id == current_user.company_id,
            IngestedDocument.status.in_(LIVE_AI_LOAD_STATUSES),
            IngestedDocument.draft.isnot(None),
        )
        .order_by(IngestedDocument.id.desc())
    )
    customers = await _company_customers(db, current_user.company_id)
    return [_ai_load_response(d, customers) for d in result.scalars().all()]


@router.post("/loads", response_model=AILoadResponse, status_code=status.HTTP_201_CREATED)
async def create_ai_load(
    payload: Dict[str, Any],
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Add an AI load by hand from the Loads AI page (the "add row" button, an
    upload, or undoing a delete). Stored like an ingested document so the
    page has a single data source; the hash is random because there are no
    document bytes to deduplicate on.
    """
    doc = IngestedDocument(
        company_id=current_user.company_id,
        source="manual",
        content_type="application/json",
        byte_size=0,
        sha256=hashlib.sha256(uuid.uuid4().bytes).hexdigest(),
        status=DocumentStatus.AI_LOAD,
        draft=_clean_ai_load_payload(payload),
    )
    db.add(doc)
    await db.flush()
    # A ratecon uploaded by hand verifies its Highway notice, like email does.
    await verify_with(db, current_user.company_id, doc)
    await db.commit()
    await db.refresh(doc)
    new_driver = ai_view(doc).driver_id
    if new_driver:
        background_tasks.add_task(notify_ai_load_assigned, doc.id, new_driver)
    return _ai_load_response(doc, await _company_customers(db, current_user.company_id))


@router.patch("/loads/{ai_load_id}", response_model=AILoadResponse)
async def update_ai_load(
    ai_load_id: int,
    payload: Dict[str, Any],
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Merge edited fields into an AI load."""
    doc = await _get_ai_load(db, current_user.company_id, ai_load_id)
    previous_driver = ai_view(doc).driver_id
    merged = dict(doc.draft) if isinstance(doc.draft, dict) else {}
    changes = _clean_ai_load_payload(payload)
    # The page re-sends every column on each edit, including the customer it
    # was *shown* - which may only be a suggestion. Store a customer only
    # when the user explicitly chose it, so editing the rate on an orange
    # row doesn't silently turn its guess into a confirmed customer.
    if changes.get("customer_confirmed") is True:
        if changes.get("customer_id") is None:
            raise HTTPException(status_code=422, detail="Choose a customer to confirm.")
    else:
        changes.pop("customer_id", None)
        changes.pop("customer_confirmed", None)
    merged.update(changes)
    # Reassign rather than mutate in place: SQLAlchemy does not track
    # changes inside a plain JSONB dict.
    doc.draft = merged
    await db.commit()
    await db.refresh(doc)
    # Text the driver only when the assignment actually changes; the page
    # re-sends every column on each edit.
    new_driver = ai_view(doc).driver_id
    if new_driver and new_driver != previous_driver:
        background_tasks.add_task(notify_ai_load_assigned, doc.id, new_driver)
    return _ai_load_response(doc, await _company_customers(db, current_user.company_id))


@router.delete("/loads/{ai_load_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ai_load(
    ai_load_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Soft delete. The document row (and its extraction) is kept for audit,
    and because it still holds the file hash, the same PDF arriving again
    is recognised as a duplicate rather than resurrected.
    """
    doc = await _get_ai_load(db, current_user.company_id, ai_load_id)
    doc.status = DocumentStatus.DISMISSED
    await db.commit()


# --- Unverified loads (Highway notices awaiting their rate confirmation) -----

class UnverifiedLoadResponse(BaseModel):
    id: int
    source: str
    load_number: Optional[str] = None
    broker_name: Optional[str] = None
    broker_contact: Optional[str] = None
    received_at: Optional[str] = None


@router.get("/unverified", response_model=List[UnverifiedLoadResponse])
async def list_unverified_loads(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Loads announced by a notice (e.g. Highway) whose rate confirmation hasn't arrived yet."""
    docs = (
        await db.execute(
            select(IngestedDocument)
            .where(
                IngestedDocument.company_id == current_user.company_id,
                IngestedDocument.status == DocumentStatus.UNVERIFIED,
            )
            .order_by(IngestedDocument.id.desc())
        )
    ).scalars().all()
    return [
        UnverifiedLoadResponse(
            id=d.id,
            source=d.source,
            load_number=(d.draft or {}).get("broker_load_number"),
            broker_name=(d.draft or {}).get("broker_name"),
            broker_contact=(d.draft or {}).get("broker_contact"),
            received_at=d.created_at.isoformat() if d.created_at else None,
        )
        for d in docs
    ]


@router.delete("/unverified/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def dismiss_unverified_load(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Remove an unverified load (e.g. the load fell through). Soft delete."""
    doc = (
        await db.execute(
            select(IngestedDocument).where(
                IngestedDocument.id == doc_id,
                IngestedDocument.company_id == current_user.company_id,
                IngestedDocument.status == DocumentStatus.UNVERIFIED,
            )
        )
    ).scalars().first()
    if doc is None:
        raise HTTPException(status_code=404, detail="Unverified load not found.")
    doc.status = DocumentStatus.DISMISSED
    await db.commit()
