"""
Revised rate confirmations.

Brokers re-send a rate confirmation when something changes (rate, times,
a stop). When one arrives for a load that is already an AI load, it must not
become a second AI load: the existing load is flagged "Revision received"
with the list of changes, and a person accepts or dismisses it.

The revision is kept on its own ingested_documents row (status "revision")
with its full draft; the AI load only carries a pointer plus the change list
in draft["pending_revision"].
"""

from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.documents.unverified import _company_docs, norm_ref
from app.models.loads_ai import LIVE_AI_LOAD_STATUSES, DocumentStatus, IngestedDocument

# (draft key, label shown to the dispatcher). What a revision can change.
COMPARED = (
    ("rate", "Rate"),
    ("pickup_location", "Pickup"),
    ("pickup_date", "Pickup date/time"),
    ("pickup_window", "Pickup hours"),
    ("delivery_location", "Delivery"),
    ("delivery_date", "Delivery date/time"),
    ("delivery_window", "Delivery hours"),
    ("pickup_number", "Pickup #"),
    ("delivery_number", "Delivery #"),
    ("po_number", "PO #"),
    ("bol_number", "BOL #"),
    ("shipper_name", "Shipper"),
    ("receiver_name", "Receiver"),
    ("pickup_notes", "Instructions"),
)
# Accepting applies these from the revised draft (plus the compared ones).
APPLIED = tuple(k for k, _ in COMPARED) + (
    "fuel_surcharge", "accessorial_charges", "description", "notes", "miles", "ratecon_url",
    "broker_name", "broker_mc", "reference_number",
)
IDENTITY = ("load_number", "broker_load_number")


def _norm(key: str, value) -> str:
    if value in (None, ""):
        return ""
    if key == "rate":
        try:
            return f"{float(str(value).replace(',', '').replace('$', '')):.2f}"
        except ValueError:
            pass
    if key.endswith("_date"):
        return str(value).replace("Z", "")[:16]
    return " ".join(str(value).split()).upper()


def _show(key: str, value) -> Optional[str]:
    if value in (None, ""):
        return None
    if key == "rate":
        try:
            return f"${float(str(value).replace(',', '').replace('$', '')):,.2f}"
        except ValueError:
            return str(value)
    if key.endswith("_date"):
        try:
            d = datetime.fromisoformat(str(value).replace("Z", ""))
            return d.strftime("%m/%d %I:%M %p").replace(" 12:00 AM", "")
        except ValueError:
            return str(value)
    return str(value)


def diff(old: dict, new: dict) -> List[dict]:
    """Fields the revised ratecon changes. A field the revision doesn't state is not a change."""
    out = []
    for key, label in COMPARED:
        a, b = old.get(key), new.get(key)
        if b in (None, ""):
            continue
        if _norm(key, a) != _norm(key, b):
            out.append({"field": key, "label": label, "old": _show(key, a), "new": _show(key, b)})
    return out


async def pending_doc(session: AsyncSession, existing: IngestedDocument) -> Optional[IngestedDocument]:
    rev_id = ((existing.draft or {}).get("pending_revision") or {}).get("doc_id")
    doc = await session.get(IngestedDocument, rev_id) if rev_id else None
    return doc if doc is not None and doc.status == DocumentStatus.REVISION else None


async def find_existing(session: AsyncSession, company_id: int, draft: dict, exclude_id: int) -> Optional[IngestedDocument]:
    """The live AI load with the same load number (ours or the broker's), if any."""
    keys = {norm_ref(draft.get(k)) for k in IDENTITY}
    keys = {k for k in keys if len(k) >= 4}
    if not keys:
        return None
    for doc in await _company_docs(session, company_id, LIVE_AI_LOAD_STATUSES):
        if doc.id == exclude_id:
            continue
        theirs = {norm_ref((doc.draft or {}).get(k)) for k in IDENTITY}
        if keys & theirs:
            return doc
    return None


def label_of(doc: IngestedDocument) -> str:
    d = doc.draft or {}
    return d.get("load_number") or d.get("broker_load_number") or f"#{doc.id}"


def flag_revision(existing: IngestedDocument, revision: IngestedDocument, changes: List[dict],
                  superseded: Optional[IngestedDocument] = None) -> None:
    """Hold `revision` on the load. A newer revision replaces one still pending."""
    if superseded is not None and superseded.id != revision.id:
        superseded.status = DocumentStatus.REVISION_DISMISSED
        superseded.warnings = [f"Replaced by a newer revision for load {label_of(existing)}."]
    merged = dict(existing.draft or {})
    merged["pending_revision"] = {
        "doc_id": revision.id,
        "changes": changes,
        "received_at": datetime.now(timezone.utc).isoformat(),
        "filename": revision.original_filename,
        "ratecon_url": (revision.draft or {}).get("ratecon_url"),
    }
    existing.draft = merged
    revision.status = DocumentStatus.REVISION
    revision.warnings = [
        f"Revised rate confirmation for load {label_of(existing)}: "
        + "; ".join(f"{c['label']} {c['old'] or '-'} -> {c['new']}" for c in changes[:6])
        + ". Accept or dismiss it on the load."
    ]


def accept(existing: IngestedDocument, revision: IngestedDocument) -> None:
    """Apply the revised fields. Driver, truck, POD, lumper, status stay as they are."""
    new = revision.draft or {}
    merged = dict(existing.draft or {})
    for key in APPLIED:
        if new.get(key) not in (None, ""):
            merged[key] = new[key]
    # The revised times replace the old ones as printed, not as hand-edited.
    for side in ("pickup", "delivery"):
        if new.get(f"{side}_date") not in (None, ""):
            merged.pop(f"{side}_time_manual", None)
    merged.pop("pending_revision", None)
    history = list(merged.get("revisions") or [])
    history.append({"doc_id": revision.id, "applied_at": datetime.now(timezone.utc).isoformat()})
    merged["revisions"] = history
    existing.draft = merged
    if isinstance(revision.extraction, dict):
        existing.extraction = revision.extraction
    revision.status = DocumentStatus.REVISION_APPLIED
    revision.warnings = [f"Revision applied to load {label_of(existing)}."]


def dismiss(existing: IngestedDocument, revision: Optional[IngestedDocument]) -> None:
    merged = dict(existing.draft or {})
    merged.pop("pending_revision", None)
    existing.draft = merged
    if revision is not None:
        revision.status = DocumentStatus.REVISION_DISMISSED
        revision.warnings = [f"Revision dismissed; load {label_of(existing)} kept as it was."]
