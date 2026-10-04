"""
Loads AI endpoints.

Loads AI is the sandbox board for the document-automation pipeline. For now
the only thing it owns is its source mailbox - the inbox that loads will be
drawn from once ingestion lands.

Admin-only throughout, matching the page's own gating: pointing the pipeline
at a different mailbox decides which messages the system will read, so it is
not exposed to dispatchers, drivers, customers, or viewers.
"""

import logging
from typing import Any, Dict, List, Optional

from email_validator import EmailNotValidError, validate_email
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
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
from app.documents.mapping import build_load_draft, extraction_field_map
from app.models.company import Company
from app.models.customer import Customer
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


class LoadsAISettingsResponse(BaseModel):
    """Current Loads AI configuration for the caller's company."""

    source_email: Optional[str] = None

    class Config:
        from_attributes = True


class LoadsAISettingsUpdate(BaseModel):
    source_email: Optional[str] = None

    @field_validator("source_email", mode="before")
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
    return LoadsAISettingsResponse(source_email=company.loads_ai_source_email)


@router.put("/settings", response_model=LoadsAISettingsResponse)
async def update_loads_ai_settings(
    settings: LoadsAISettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Set (or clear) the Loads AI source mailbox for the caller's company."""
    company = await _get_company(db, current_user.company_id)

    # exclude_unset so an omitted field is left alone, while an explicit null
    # or empty string clears it.
    payload = settings.model_dump(exclude_unset=True)
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

    await db.commit()
    await db.refresh(company)

    return LoadsAISettingsResponse(source_email=company.loads_ai_source_email)


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
