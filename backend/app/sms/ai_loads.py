"""
Read/write the fields driver texting needs on an AI load.

An AI load is the `draft` JSON on an ingested_documents row (shown on the
Loads AI page). Driver texting runs on these only - never on the manually
entered loads table.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, Optional

from app.models.loads_ai import IngestedDocument


def parse_wall_clock(value: Any) -> Optional[datetime]:
    """
    Stop time from a draft, as a naive wall-clock datetime at the stop.

    The page saves "2026-10-05T14:00:00.000Z" where the Z is a label, not a
    conversion (the convention used across this TMS); extracted drafts save
    "2026-10-05T14:00:00". Either way the clock reading is the local time.
    """
    if not value or not isinstance(value, str):
        return None
    s = value.strip().replace("Z", "")
    if len(s) > 19 and s[19] in "+-":     # drop an explicit offset, keep the clock
        s = s[:19]
    try:
        return datetime.fromisoformat(s.split(".")[0])
    except ValueError:
        return None


@dataclass
class AILoadView:
    id: int
    company_id: int
    driver_id: Optional[int]
    status: str
    load_number: Optional[str]
    reference_number: Optional[str]
    broker_load_number: Optional[str]
    po_number: Optional[str]
    bol_number: Optional[str]
    pickup_location: Optional[str]
    pickup_date: Optional[datetime]
    delivery_location: Optional[str]
    delivery_date: Optional[datetime]
    pickup_notes: Optional[str]
    pod_url: Optional[str]


def view(doc: IngestedDocument) -> AILoadView:
    f: Dict[str, Any] = doc.draft if isinstance(doc.draft, dict) else {}
    driver_id = f.get("driver_id")
    try:
        driver_id = int(driver_id) if driver_id not in (None, "", 0) else None
    except (TypeError, ValueError):
        driver_id = None
    return AILoadView(
        id=doc.id,
        company_id=doc.company_id,
        driver_id=driver_id,
        status=str(f.get("status") or "available"),
        load_number=f.get("load_number") or None,
        reference_number=f.get("reference_number") or None,
        broker_load_number=f.get("broker_load_number") or None,
        po_number=f.get("po_number") or None,
        bol_number=f.get("bol_number") or None,
        pickup_location=f.get("pickup_location") or None,
        pickup_date=parse_wall_clock(f.get("pickup_date")),
        delivery_location=f.get("delivery_location") or None,
        delivery_date=parse_wall_clock(f.get("delivery_date")),
        pickup_notes=(f.get("notes") or f.get("pickup_notes") or None),
        pod_url=f.get("pod_url") or None,
    )


def update_draft(doc: IngestedDocument, **changes: Any) -> None:
    """Merge into the draft. Reassigned, because in-place JSONB edits aren't tracked."""
    merged = dict(doc.draft) if isinstance(doc.draft, dict) else {}
    merged.update(changes)
    doc.draft = merged


def append_note(doc: IngestedDocument, line: str) -> None:
    f = doc.draft if isinstance(doc.draft, dict) else {}
    current = f.get("notes") or f.get("pickup_notes") or ""
    update_draft(doc, notes=f"{current}\n{line}" if current else line)
