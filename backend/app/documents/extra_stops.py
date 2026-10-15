"""
Extra stops on an AI load (draft["extra_stops"]).

The load's own pickup_location is the first pickup and delivery_location the
final delivery; extra stops sit between them: extra pickups after the first
pickup, extra deliveries before the final delivery. Each is
{"type": "pickup"|"delivery", "location", "date", "name", "appointment"}.
Miles run pickup -> extra pickups -> extra deliveries -> delivery.
"""
import re
from typing import Any, List, Optional

from app.services.mileage import driving_miles

STOP_TYPES = ("pickup", "delivery")


def _text(value: Any) -> Optional[str]:
    value = str(value).strip() if value is not None else ""
    return value or None


def clean(stops: Any) -> List[dict]:
    """Validated extra stops, pickups first, each type in date order (undated last)."""
    if not isinstance(stops, list):
        raise ValueError("extra_stops must be a list")
    out = []
    for s in stops:
        if not isinstance(s, dict) or s.get("type") not in STOP_TYPES:
            raise ValueError("each stop needs a type of pickup or delivery")
        location = _text(s.get("location"))
        if not location:
            raise ValueError("each stop needs a location")
        out.append({"type": s["type"], "location": location, "date": _text(s.get("date")),
                    "name": _text(s.get("name")), "appointment": _text(s.get("appointment"))})
    # Stable sort: stops without a date keep the order they were added in.
    return sorted(out, key=lambda s: (STOP_TYPES.index(s["type"]), s["date"] or "9999"))


def from_amazon_stops(stops: list) -> List[dict]:
    """A multi-stop Amazon load's draft["stops"]: every delivery but the last is an extra stop."""
    return [{"type": "delivery", "location": s.get("location"), "date": s.get("date"),
             "name": s.get("name"), "appointment": s.get("appointment")}
            for s in (stops or [])[:-1] if isinstance(s, dict) and s.get("location")]


def _routable(location: Optional[str]) -> bool:
    # "Amazon MDW2" until someone adds the FC's address: no route to it.
    return bool(location) and not re.fullmatch(r"(?i)amazon\s+\w+", location.strip())


async def route_miles(draft: dict) -> Optional[int]:
    """Driving miles over every stop in order, or None if any leg can't be routed."""
    extra = draft.get("extra_stops") or []
    legs = ([draft.get("pickup_location")]
            + [s.get("location") for s in extra if s.get("type") == "pickup"]
            + [s.get("location") for s in extra if s.get("type") == "delivery"]
            + [draft.get("delivery_location")])
    if not all(_routable(leg) for leg in legs):
        return None
    total = 0
    for a, b in zip(legs, legs[1:]):
        miles = await driving_miles(a, b)
        if not miles:
            return None
        total += miles
    return round(total)
