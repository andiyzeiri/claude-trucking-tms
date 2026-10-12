"""
Peak ELD Open API client (https://cloud.eldpeak.com/open-api.html).

The company creates an API key in the Peak portal (API Keys page; read-only
is enough) and it is sent as the X-Api-Key header. We use:
  GET /api/v0/vehicles              trucks in Peak: unit number, VIN
  GET /api/v0/vehicles/ifta         miles per truck for a time range
  GET /api/v0/vehicles/ifta/{id}    miles per state for one truck

Times are epoch milliseconds (UTC). Lists are paginated with page/elements.
Distances come in the Peak company's odometer unit; we always return miles.

Calls retry on network errors, 429 and 5xx, and a per-key circuit breaker
stops calling Peak for a minute after repeated failures so a Peak outage
doesn't stall every page load. Results are cached briefly per key.
"""

import asyncio
import hashlib
import logging
import time
from typing import Any, Dict, List, Optional, Tuple

import httpx

logger = logging.getLogger(__name__)

BASE_URL = "https://cloud.eldpeak.com"
PAGE_SIZE = 100
KM_TO_MI = 0.621371
CACHE_SECONDS = 300
RETRIES = 3
BREAKER_FAILURES = 5
BREAKER_SECONDS = 60


class PeakError(Exception):
    """A Peak call failed. `auth` is True when the key itself was rejected."""

    def __init__(self, message: str, auth: bool = False):
        super().__init__(message)
        self.auth = auth


_cache: Dict[Tuple, Tuple[float, Any]] = {}
_breaker: Dict[str, Tuple[int, float]] = {}  # key hash -> (consecutive failures, open until)


def _key_id(api_key: str) -> str:
    return hashlib.sha256(api_key.encode()).hexdigest()[:16]


async def _get(api_key: str, path: str, params: Dict[str, Any], cache: bool = True) -> Dict[str, Any]:
    kid = _key_id(api_key)
    failures, open_until = _breaker.get(kid, (0, 0.0))
    if open_until > time.monotonic():
        raise PeakError("Peak ELD isn't responding - try again in a minute")

    cache_key = (kid, path, tuple(sorted((k, str(v)) for k, v in params.items())))
    hit = _cache.get(cache_key) if cache else None
    if hit and hit[0] > time.monotonic():
        return hit[1]

    last_error = "Peak ELD request failed"
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=20) as client:
        for attempt in range(RETRIES):
            if attempt:
                await asyncio.sleep(0.5 * 2 ** (attempt - 1))
            try:
                resp = await client.get(path, params=params, headers={"X-Api-Key": api_key, "Accept": "application/json"})
            except httpx.HTTPError as e:
                last_error = f"Couldn't reach Peak ELD ({e.__class__.__name__})"
                continue
            if resp.status_code in (401, 403):
                _breaker.pop(kid, None)
                raise PeakError("Peak ELD rejected the API key", auth=True)
            if resp.status_code == 429 or resp.status_code >= 500:
                last_error = f"Peak ELD error {resp.status_code}"
                continue
            if resp.status_code >= 400:
                detail = _error_text(resp)
                raise PeakError(f"Peak ELD error {resp.status_code}{': ' + detail if detail else ''}")
            data = resp.json()
            _breaker.pop(kid, None)
            _cache[cache_key] = (time.monotonic() + CACHE_SECONDS, data)
            return data

    failures += 1
    _breaker[kid] = (failures, time.monotonic() + BREAKER_SECONDS if failures >= BREAKER_FAILURES else 0.0)
    logger.warning("peak_eld: %s %s failed: %s", path, params.get("startTime", ""), last_error)
    raise PeakError(last_error)


def _error_text(resp: httpx.Response) -> str:
    try:
        errors = resp.json().get("errors") or []
        return "; ".join(e.get("message", "") for e in errors if e.get("message"))[:200]
    except Exception:
        return ""


async def _get_all(api_key: str, path: str, params: Dict[str, Any]) -> Tuple[List[dict], dict]:
    """Every row of a paginated list, plus the first page's `extras`.

    The docs don't say whether pages start at 0 or 1, so ask for page 0 and
    switch to 1-based if that's rejected or comes back empty with rows behind it.
    """
    page = 0
    try:
        first = await _get(api_key, path, {**params, "page": 0, "elements": PAGE_SIZE})
    except PeakError as e:
        if e.auth:
            raise
        first = None
    if first is None or (not first.get("data") and (first.get("meta") or {}).get("totalElements", 0) > 0):
        page = 1
        first = await _get(api_key, path, {**params, "page": 1, "elements": PAGE_SIZE})

    # Rows are de-duplicated in case page 0 is treated as page 1.
    rows: Dict[str, dict] = {}

    def add(batch: List[dict]) -> int:
        before = len(rows)
        for r in batch:
            rows[str(r.get("id") or r.get("state") or r.get("vehicleId") or len(rows))] = r
        return len(rows) - before

    add(first.get("data") or [])
    total = (first.get("meta") or {}).get("totalElements") or len(rows)
    while len(rows) < total:
        page += 1
        nxt = await _get(api_key, path, {**params, "page": page, "elements": PAGE_SIZE})
        if not add(nxt.get("data") or []):
            break
    return list(rows.values()), first.get("extras") or {}


def _to_miles(distance: Optional[float], unit: Optional[str]) -> float:
    d = float(distance or 0)
    return d * KM_TO_MI if (unit or "").strip().lower().startswith("k") else d


def state_code(peak_state: Optional[str]) -> str:
    """"US_TX" -> "TX", "CA_ON" -> "ON"."""
    s = (peak_state or "").strip()
    return s.split("_", 1)[1] if "_" in s else s


async def vehicles(api_key: str) -> Tuple[List[dict], Optional[str]]:
    """All Peak vehicles and the company's odometer unit."""
    rows, extras = await _get_all(api_key, "/api/v0/vehicles", {"asc": "true", "orderBy": "vehicleId"})
    unit = ((extras or {}).get("company") or {}).get("odometerUnit")
    return rows, unit


async def check_key(api_key: str) -> int:
    """Raises PeakError if the key doesn't work; returns how many vehicles Peak has."""
    rows, _ = await _get_all(api_key, "/api/v0/vehicles", {"asc": "true", "orderBy": "vehicleId"})
    return len(rows)


async def miles_by_vehicle(api_key: str, start_ms: int, end_ms: int, unit: Optional[str]) -> Dict[str, float]:
    """Peak vehicle id -> miles driven in [start_ms, end_ms]."""
    rows, _ = await _get_all(api_key, "/api/v0/vehicles/ifta", {
        "asc": "true", "orderBy": "vehicleId", "startTime": start_ms, "endTime": end_ms,
    })
    out: Dict[str, float] = {}
    for r in rows:
        vid = str(r.get("id") or r.get("vehicleId") or "")
        if vid:
            out[vid] = out.get(vid, 0.0) + _to_miles(r.get("distance"), unit)
    return out


async def live_odometers(api_key: str, unit: Optional[str]) -> List[Tuple[str, int, float]]:
    """(Peak vehicle id, location time ms, odometer in miles) for every truck, as of now."""
    data = await _get(api_key, "/api/v0/locations", {}, cache=False)
    out = []
    for v in data.get("vehicles") or []:
        vid, when, odo = str(v.get("id") or ""), v.get("locationTime"), v.get("odometer")
        if vid and when and odo:
            out.append((vid, int(when), _to_miles(odo, unit)))
    return out


async def odometer_span(api_key: str, vehicle_id: str, start_ms: int, end_ms: int, unit: Optional[str]) -> Optional[dict]:
    """Odometer at the first and last DVIR (pre/post-trip inspection) in [start_ms, end_ms].

    The Open API has no HOS log events, but every DVIR records the odometer,
    so first-inspection-to-last-inspection is the week's odometer miles.
    Returns None when fewer than two inspections in the range carry one.
    """
    rows, _ = await _get_all(api_key, f"/api/v0/maintenance/dvir/{vehicle_id}", {
        "asc": "true", "orderBy": "date", "startTime": start_ms, "endTime": end_ms,
    })
    rows = sorted((r for r in rows if r.get("id") and r.get("date")), key=lambda r: r["date"])

    async def reading(r: dict) -> Optional[Tuple[int, float]]:
        detail = await _get(api_key, f"/api/v0/maintenance/dvir/{vehicle_id}/{r['id']}", {})
        odo = detail.get("odometer")
        return (int(detail.get("date") or r["date"]), float(odo)) if odo else None

    async def first_reading(candidates: List[dict]) -> Optional[Tuple[int, float]]:
        for r in candidates[:6]:  # a few inspections may have no odometer
            got = await reading(r)
            if got:
                return got
        return None

    first = await first_reading(rows)
    last = await first_reading(list(reversed(rows)))
    if not first or not last or last[0] <= first[0] or last[1] < first[1]:
        return None
    to_mi = KM_TO_MI if (unit or "").strip().lower().startswith("k") else 1.0
    return {
        "start_time": first[0], "start_odometer": round(first[1] * to_mi),
        "end_time": last[0], "end_odometer": round(last[1] * to_mi),
        "miles": round((last[1] - first[1]) * to_mi, 1),
    }


async def miles_by_state(api_key: str, vehicle_id: str, start_ms: int, end_ms: int, unit: Optional[str]) -> Dict[str, float]:
    """State code -> miles one Peak vehicle drove in [start_ms, end_ms]."""
    rows, _ = await _get_all(api_key, f"/api/v0/vehicles/ifta/{vehicle_id}", {
        "asc": "true", "orderBy": "state", "startTime": start_ms, "endTime": end_ms,
    })
    out: Dict[str, float] = {}
    for r in rows:
        code = state_code(r.get("state"))
        if code:
            out[code] = out.get(code, 0.0) + _to_miles(r.get("distance"), unit)
    return out
