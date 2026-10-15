"""
Multi-stop Amazon loads: one email, several Amazon delivery appointments.

A shipper booking a trailer to two Amazon FCs (e.g. Golden Arcus: one pickup
in Franklin Park, IGQ2 then MDW2) sends one appointment page and one Word
bill of lading per FC in the same email. That is one trip, so the first
appointment builds the AI load and each later one is added to it as a stop
instead of becoming a second load.

The load keeps one pickup and one delivery (the last stop, by delivery
time); every stop is kept in draft["stops"] and written into the load's
Notes column (pickup_notes) so it shows on the Loads AI page.
"""
import logging
import re
from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.loads_ai import LIVE_AI_LOAD_STATUSES, IngestedDocument
from app.services.mileage import driving_miles

logger = logging.getLogger(__name__)

STOPS_HEADER = "Stops:"


def stop_of(draft: dict) -> dict:
    """The delivery stop an Amazon appointment draft describes."""
    return {
        "name": draft.get("receiver_name"),
        "location": draft.get("delivery_location"),
        "date": draft.get("delivery_date"),
        "window": draft.get("delivery_window"),
        "appointment": draft.get("delivery_number") or draft.get("broker_load_number"),
        "ratecon_url": draft.get("ratecon_url"),
    }


def _when(s: dict) -> Optional[str]:
    """'Wed 10/22 10:00 CDT': the day, then the appointment time as printed (else the clock time)."""
    raw = str(s.get("date") or "")
    try:
        d = datetime.fromisoformat(raw[:19])
    except ValueError:
        return s.get("window") or None
    day = f"{d:%a} {d.month}/{d.day}"
    time = s.get("window") or (f"{d:%H:%M}" if d.hour or d.minute else "")
    return f"{day} {time}".strip()


def _stop_line(i: int, n: int, s: dict) -> str:
    bits = [s.get("name") or "Stop", s.get("location") if s.get("location") != s.get("name") else None, _when(s),
            f"Appt {s['appointment']}" if s.get("appointment") else None]
    return f"{i}/{n}: " + " - ".join(b for b in bits if b)


def _with_stops_note(notes: Optional[str], stops: list) -> str:
    """The load's notes with the Stops block replaced (anything typed above it kept)."""
    kept = (notes or "").split(STOPS_HEADER)[0].rstrip()
    block = "\n".join([STOPS_HEADER] + [_stop_line(i + 1, len(stops), s) for i, s in enumerate(stops)])
    return f"{kept}\n{block}" if kept else block


async def sibling_load(session: AsyncSession, company_id: int, document: IngestedDocument) -> Optional[IngestedDocument]:
    """The Amazon AI load an earlier appointment in the same email built, if any."""
    if not document.inbound_email_id:
        return None
    rows = (await session.execute(
        select(IngestedDocument).where(
            IngestedDocument.company_id == company_id,
            IngestedDocument.inbound_email_id == document.inbound_email_id,
            IngestedDocument.id != document.id,
            IngestedDocument.status.in_(LIVE_AI_LOAD_STATUSES),
        ).order_by(IngestedDocument.id)
    )).scalars().all()
    for doc in rows:
        if isinstance(doc.draft, dict) and doc.draft.get("amazon_appointment"):
            return doc
    return None


async def add_stop(target: IngestedDocument, draft: dict) -> dict:
    """Add the appointment in `draft` to `target` as a delivery stop. Returns target's new draft."""
    merged = dict(target.draft or {})
    stops = list(merged.get("stops") or [stop_of(merged)])
    new = stop_of(draft)
    if new.get("appointment") and any(s.get("appointment") == new["appointment"] for s in stops):
        return merged  # this appointment is already a stop
    stops.append(new)
    stops.sort(key=lambda s: str(s.get("date") or "9999"))
    last = stops[-1]
    merged.update({
        "stops": stops,
        "receiver_name": last["name"],
        "delivery_location": last["location"],
        "delivery_date": last["date"],
        "delivery_window": last["window"],
        "delivery_number": last["appointment"],
        # pickup_notes is what the Loads AI page's Notes column edits and saves.
        "pickup_notes": _with_stops_note(merged.get("pickup_notes") or merged.get("notes"), stops),
    })
    # Fill what the first appointment's bill of lading didn't.
    for key in ("pickup_location", "pickup_date", "pickup_window", "shipper_name", "broker_name", "customer_id"):
        if not merged.get(key) and draft.get(key):
            merged[key] = draft[key]
    # Miles: pickup, then each stop in order.
    legs = [merged.get("pickup_location")] + [s.get("location") for s in stops]
    total = 0
    for a, b in zip(legs, legs[1:]):
        m = await driving_miles(a, b) if a and b and not re.fullmatch(r"(?i)amazon\s+\w+", str(b).strip()) else None
        if not m:
            total = 0
            break
        total += m
    if total:
        merged["miles"] = total
    return merged
