"""
Driving miles between two addresses (Google Maps Distance Matrix).

The same calculation the loads pages run when a location is entered, made
available server-side so Loads AI can fill miles once when it builds a load.
"""

import logging
from typing import Optional

from starlette.concurrency import run_in_threadpool

from app.config import settings

logger = logging.getLogger(__name__)


def _miles_sync(origin: str, destination: str) -> Optional[int]:
    import googlemaps

    client = googlemaps.Client(key=settings.GOOGLE_MAPS_API_KEY, timeout=10)
    result = client.distance_matrix(origins=[origin], destinations=[destination], mode="driving", units="imperial")
    if result.get("status") != "OK":
        logger.info("mileage: Google status %s for %r -> %r", result.get("status"), origin, destination)
        return None
    element = result["rows"][0]["elements"][0]
    if element.get("status") != "OK":
        logger.info("mileage: no route (%s) for %r -> %r", element.get("status"), origin, destination)
        return None
    return round(element["distance"]["value"] / 1609.344)


async def driving_miles(origin: Optional[str], destination: Optional[str]) -> Optional[int]:
    """Rounded driving miles, or None if either address is missing or no route is found. Never raises."""
    if not settings.GOOGLE_MAPS_API_KEY or not (origin or "").strip() or not (destination or "").strip():
        return None
    try:
        return await run_in_threadpool(_miles_sync, origin.strip(), destination.strip())
    except Exception as e:
        logger.warning("mileage: lookup failed for %r -> %r: %s", origin, destination, e)
        return None


async def fill_miles(draft: dict) -> dict:
    """Return the draft with `miles` set if it had none and both stops are known."""
    try:
        has_miles = int(float(draft.get("miles") or 0)) > 0
    except (TypeError, ValueError):
        has_miles = False
    if has_miles:
        return draft
    miles = await driving_miles(draft.get("pickup_location"), draft.get("delivery_location"))
    if miles:
        draft = {**draft, "miles": miles}
    return draft
