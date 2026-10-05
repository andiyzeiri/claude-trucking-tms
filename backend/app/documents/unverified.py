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

REF_FIELDS = ("load_number", "broker_load_number", "reference_number", "po_number", "bol_number")
# Fields a person may have set on the unverified row that the rate
# confirmation won't contain; carried over when it is verified.
CARRY_OVER = ("driver_id", "truck_id", "notes", "status", "needs_attention")


def norm_ref(value) -> str:
    return re.sub(r"[^A-Za-z0-9]", "", str(value or "")).upper()


def refs_of(draft: Optional[dict]) -> set:
    d = draft or {}
    return {r for r in (norm_ref(d.get(k)) for k in REF_FIELDS) if len(r) >= 4}


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
    mine = refs_of(ai_load.draft)
    if not mine:
        return None
    for doc in await _company_docs(session, company_id, (DocumentStatus.UNVERIFIED,)):
        if not (refs_of(doc.draft) & mine):
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
