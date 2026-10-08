"""
Unverified loads: loads we know about from a notification (Highway) before
their rate confirmation arrives.

Stored as ingested_documents rows with status "unverified" and a small draft
(broker, load id, contact), shown in their own table above the AI loads.
When a rate confirmation becomes an AI load, any unverified load with the
same load number is marked "verified" and drops off that table.
"""

import hashlib
import logging
import re
from typing import Iterable, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.loads_ai import LIVE_AI_LOAD_STATUSES, DocumentStatus, IngestedDocument

logger = logging.getLogger(__name__)

NOT_A_REF = re.compile(r"phone|fax|tel|cell|mobile|\bmc\b|\bdot\b|scac|zip|postal|nmfc|weight|amount|rate", re.I)
REF_FIELDS = ("load_number", "broker_load_number", "reference_number", "po_number", "bol_number")
# Fields a person may have set on the unverified row that the rate
# confirmation won't contain; carried over when it is verified.
CARRY_OVER = (
    "driver_id", "truck_id", "notes", "status", "needs_attention",
    # A POD can arrive before the rate confirmation (attached to the
    # unverified load); it carries over too.
    "pod_url", "pod_pages", "pod_source", "pod_window_started", "pod_page_count",
    "lumper_amount", "lumper_vendor",
)


def norm_ref(value) -> str:
    return re.sub(r"[^A-Za-z0-9]", "", str(value or "")).upper()


def refs_of(draft: Optional[dict]) -> set:
    d = draft or {}
    out = {r for r in (norm_ref(d.get(k)) for k in REF_FIELDS) if len(r) >= 4}
    out |= {r for r in (d.get("ref_keys") or []) if len(r) >= 4}
    return out


def refs_from_extraction(extraction: Optional[dict]) -> set:
    """Every reference number the model read (rate con list, POD classification list, id fields)."""
    ex = extraction or {}
    values = []
    for item in ex.get("reference_numbers") or []:
        if isinstance(item, dict):
            # Phone / MC / zip etc. are shared across unrelated paperwork.
            if NOT_A_REF.search(item.get("label") or ""):
                continue
            values.append(item.get("value"))
        else:
            values.append(item)
    for v in (ex.get("classification") or {}).get("reference_numbers") or []:
        values.append(v)
    for k in ("broker_load_number", "internal_load_number", "bol_number", "po_number", "pickup_number", "delivery_number"):
        f = ex.get(k)
        values.append(f.get("value") if isinstance(f, dict) else f)
    out = set()
    for v in values:
        for token in re.split(r"[,;/\s]+", str(v or "")):
            key = norm_ref(token)
            if len(key) >= 4 and any(ch.isdigit() for ch in key):
                out.add(key)
    return out


def all_refs(doc: IngestedDocument) -> set:
    return refs_of(doc.draft) | refs_from_extraction(doc.extraction if isinstance(doc.extraction, dict) else None)


async def _company_docs(session: AsyncSession, company_id: int, statuses: Iterable[str]):
    return (
        await session.execute(
            select(IngestedDocument).where(
                IngestedDocument.company_id == company_id,
                IngestedDocument.status.in_(tuple(statuses)),
                IngestedDocument.draft.isnot(None),
            )
        )
    ).scalars().all()


async def record_unverified(
    session: AsyncSession,
    company_id: int,
    *,
    load_id: str,
    broker_name: Optional[str],
    contact_name: Optional[str],
    source: str,
    inbound_email_id: Optional[int],
) -> tuple[Optional[IngestedDocument], str]:
    """
    Create the unverified load. Returns (doc, outcome):
      created     - new unverified load
      duplicate   - the same notice was already recorded
      already_in  - its rate confirmation is already an AI load
    """
    key = norm_ref(load_id)
    for doc in await _company_docs(session, company_id, LIVE_AI_LOAD_STATUSES):
        if key in refs_of(doc.draft):
            return doc, "already_in"

    sha = hashlib.sha256(f"{source}:{company_id}:{key}".encode()).hexdigest()
    existing = (
        await session.execute(
            select(IngestedDocument).where(IngestedDocument.company_id == company_id, IngestedDocument.sha256 == sha)
        )
    ).scalars().first()
    if existing is not None:
        return existing, "duplicate"

    doc = IngestedDocument(
        company_id=company_id,
        inbound_email_id=inbound_email_id,
        source=source,
        original_filename=f"{source.title()} notice - load {load_id}",
        content_type="text/plain",
        byte_size=0,
        sha256=sha,
        doc_type="load_notice",
        status=DocumentStatus.UNVERIFIED,
        draft={
            "broker_load_number": load_id,
            "broker_name": broker_name,
            "broker_contact": contact_name,
            "source": source,
        },
        warnings=[f"Unverified: waiting for the rate confirmation for load {load_id}."],
    )
    async with session.begin_nested():
        session.add(doc)
    return doc, "created"


async def verify_with(session: AsyncSession, company_id: int, ai_load: IngestedDocument) -> Optional[IngestedDocument]:
    """
    A rate confirmation just became `ai_load`: mark the matching unverified
    load verified and carry over anything a person set on it.
    """
    mine = all_refs(ai_load)
    if not mine:
        return None
    for doc in await _company_docs(session, company_id, (DocumentStatus.UNVERIFIED,)):
        if not (all_refs(doc) & mine):
            continue
        merged = dict(ai_load.draft or {})
        for k in CARRY_OVER:
            if (doc.draft or {}).get(k) not in (None, "") and merged.get(k) in (None, ""):
                merged[k] = doc.draft[k]
        ai_load.draft = merged
        note = dict(doc.draft or {})
        note["verified_ai_load_id"] = ai_load.id
        doc.draft = note
        doc.status = DocumentStatus.VERIFIED
        doc.warnings = [f"Verified: rate confirmation received (AI load #{ai_load.id})."]
        logger.info("loads-ai: unverified load %s verified by AI load %s", doc.id, ai_load.id)
        return doc
    return None


async def merge_pod_only(session: AsyncSession, company_id: int, ai_load: IngestedDocument) -> Optional[IngestedDocument]:
    """
    A rate confirmation just became `ai_load`: if a temporary load built from
    its POD is waiting (POD sent before the ratecon), fold it in - POD, pages,
    driver and lumper move onto the AI load, and the temporary load is retired.
    """
    mine = all_refs(ai_load)
    if not mine:
        return None
    for doc in await _company_docs(session, company_id, (DocumentStatus.POD_ONLY,)):
        if not (all_refs(doc) & mine):
            continue
        merge_pod_into(doc, ai_load)
        logger.info("loads-ai: POD-only load %s merged into AI load %s", doc.id, ai_load.id)
        return doc
    return None


POD_FIELDS = ("pod_url", "pod_pages", "pod_source", "pod_window_started", "pod_page_count",
              "lumper_amount", "lumper_vendor")


def merge_pod_into(pod_only: IngestedDocument, ai_load: IngestedDocument) -> None:
    src = pod_only.draft or {}
    merged = dict(ai_load.draft or {})
    for k in POD_FIELDS:
        if src.get(k) not in (None, "", []) and merged.get(k) in (None, "", []):
            merged[k] = src[k]
    if src.get("driver_id") and not merged.get("driver_id"):
        merged["driver_id"] = src["driver_id"]
    ai_load.draft = merged
    note = dict(src)
    note["merged_into"] = ai_load.id
    pod_only.draft = note
    pod_only.status = DocumentStatus.POD_MERGED
    pod_only.warnings = [f"Merged into AI load #{ai_load.id} when its rate confirmation arrived."]
