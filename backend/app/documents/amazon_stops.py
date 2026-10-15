"""
Multi-stop Amazon loads: one email, several Amazon delivery appointments.

A shipper booking a trailer to two Amazon FCs (e.g. Golden Arcus: one pickup
in Franklin Park, IGQ2 then MDW2) sends one appointment page and one Word
bill of lading per FC in the same email. That is one trip, so the first
appointment builds the AI load and each later one is added to it as a stop
instead of becoming a second load.

The load keeps one pickup and one delivery (the last stop, by delivery
time); every stop is kept in draft["stops"], the earlier ones show as
extra stops (draft["extra_stops"]), and the load's Notes list the
appointment IDs.
"""
import logging
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.loads_ai import LIVE_AI_LOAD_STATUSES, IngestedDocument
from app.documents import extra_stops

logger = logging.getLogger(__name__)

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
        # Notes (pickup_notes, what the Loads AI page's Notes column edits):
        # just the stops' Amazon appointment IDs, in delivery order.
        "pickup_notes": "Appt# " + ", ".join(str(s["appointment"]) for s in stops if s.get("appointment")),
        "notes": None,
    })
    # Fill what the first appointment's bill of lading didn't.
    for key in ("pickup_location", "pickup_date", "pickup_window", "shipper_name", "broker_name", "customer_id"):
        if not merged.get(key) and draft.get(key):
            merged[key] = draft[key]
    # The earlier deliveries show as extra stops; miles run through each.
    merged["extra_stops"] = extra_stops.from_amazon_stops(stops)
    miles = await extra_stops.route_miles(merged)
    if miles:
        merged["miles"] = miles
    return merged
