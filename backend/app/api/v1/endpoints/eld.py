"""
ELD integration (Peak ELD): connect with an API key, then read miles driven
per truck and per state for any date range (Reports > Mileage).

Miles are read live from Peak (briefly cached in app/services/peak_eld.py),
not copied into our tables, so they always match Peak's own IFTA report.

Peak trucks are matched to TMS trucks by unit number, then VIN; a match can
be set by hand (truck_map) when neither lines up.
"""

import asyncio
import re
from datetime import date, datetime, time, timedelta, timezone
from typing import Dict, List, Literal, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import get_current_active_user
from app.database import get_db
from app.models.eld_connection import EldConnection
from app.models.truck import Truck
from app.models.user import User
from app.services import eld_odometer, peak_eld, secret_box

router = APIRouter()

MAX_RANGE_DAYS = 400


class ConnectionOut(BaseModel):
    connected: bool
    provider: Optional[str] = None
    key_last4: Optional[str] = None
    last_ok_at: Optional[datetime] = None
    last_error: Optional[str] = None


class ConnectIn(BaseModel):
    api_key: str = Field(..., min_length=8, max_length=512)


class TruckOption(BaseModel):
    id: int
    truck_number: str


class VehicleMiles(BaseModel):
    eld_id: str
    unit: str  # unit number in Peak
    vin: Optional[str] = None
    active: bool = True
    miles: float
    truck_id: Optional[int] = None
    truck_number: Optional[str] = None
    driver_name: Optional[str] = None
    matched_by: Optional[Literal["manual", "unit", "vin"]] = None
    # With ?odometer=true: odometer at the start and end of the range, from
    # recorded live ELD readings ("eld") or else the first/last inspection ("dvir").
    odometer_source: Optional[Literal["eld", "dvir"]] = None
    odometer_miles: Optional[float] = None
    start_odometer: Optional[int] = None
    start_time: Optional[datetime] = None
    end_odometer: Optional[int] = None
    end_time: Optional[datetime] = None


class MileageOut(BaseModel):
    start: date
    end: date
    total_miles: float
    vehicles: List[VehicleMiles]
    trucks: List[TruckOption]  # TMS trucks, for matching by hand


class StateMiles(BaseModel):
    state: str
    miles: float


class StatesOut(BaseModel):
    start: date
    end: date
    total_miles: float
    states: List[StateMiles]  # all requested trucks combined
    by_vehicle: Dict[str, List[StateMiles]]  # eld_id -> states


class TruckMapIn(BaseModel):
    eld_id: str = Field(..., min_length=1, max_length=64)
    truck_id: Optional[int] = None  # null = match automatically again


def _conn_out(conn: Optional[EldConnection]) -> ConnectionOut:
    if conn is None:
        return ConnectionOut(connected=False)
    return ConnectionOut(
        connected=True, provider=conn.provider, key_last4=conn.key_last4,
        last_ok_at=conn.last_ok_at, last_error=conn.last_error,
    )


async def _connection(db: AsyncSession, company_id: int) -> Optional[EldConnection]:
    return (await db.execute(select(EldConnection).where(EldConnection.company_id == company_id))).scalar_one_or_none()


async def _api_key(db: AsyncSession, company_id: int) -> tuple:
    conn = await _connection(db, company_id)
    if conn is None:
        raise HTTPException(status_code=409, detail="Peak ELD isn't connected - add your API key in Settings")
    key = secret_box.decrypt(conn.api_key_encrypted)
    if not key:
        raise HTTPException(status_code=409, detail="The saved Peak ELD key can't be read - reconnect it in Settings")
    return conn, key


async def _record(db: AsyncSession, conn: EldConnection, error: Optional[str]) -> None:
    if error:
        conn.last_error = error[:255]
    else:
        conn.last_ok_at = datetime.now(timezone.utc)
        conn.last_error = None
    await db.commit()


def _range_ms(start: date, end: date, tz: str) -> tuple:
    """Local calendar days [start, end] -> epoch ms, end inclusive."""
    if end < start:
        raise HTTPException(status_code=400, detail="End date is before start date")
    if (end - start).days > MAX_RANGE_DAYS:
        raise HTTPException(status_code=400, detail=f"Pick a range of {MAX_RANGE_DAYS} days or less")
    try:
        zone = ZoneInfo(tz)
    except (ZoneInfoNotFoundError, ValueError):
        zone = ZoneInfo("America/Chicago")
    start_dt = datetime.combine(start, time.min, zone)
    end_dt = datetime.combine(end + timedelta(days=1), time.min, zone)
    return int(start_dt.timestamp() * 1000), int(end_dt.timestamp() * 1000) - 1


def _norm_unit(s: Optional[str]) -> str:
    """"Truck #0101" and "101" both -> "101"."""
    s = re.sub(r"[^a-z0-9]", "", (s or "").lower())
    s = re.sub(r"^(truck|unit|trk)", "", s)
    return s.lstrip("0")


def _peak_error(e: peak_eld.PeakError) -> HTTPException:
    return HTTPException(status_code=400 if e.auth else 502, detail=str(e))


@router.get("/connection", response_model=ConnectionOut)
async def get_connection(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return _conn_out(await _connection(db, current_user.company_id))


@router.put("/connection", response_model=ConnectionOut)
async def connect(
    body: ConnectIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Check the key against Peak, then save it (encrypted)."""
    key = body.api_key.strip()
    try:
        await peak_eld.check_key(key)
    except peak_eld.PeakError as e:
        raise _peak_error(e)

    conn = await _connection(db, current_user.company_id)
    if conn is None:
        conn = EldConnection(company_id=current_user.company_id, provider="peak", truck_map={})
        db.add(conn)
    conn.api_key_encrypted = secret_box.encrypt(key)
    conn.key_last4 = key[-4:]
    conn.connected_by = current_user.id
    conn.last_ok_at = datetime.now(timezone.utc)
    conn.last_error = None
    await db.commit()
    await db.refresh(conn)
    try:
        await eld_odometer.record(db, conn)  # start the odometer history right away
    except Exception:
        await db.rollback()
    return _conn_out(conn)


@router.delete("/connection", response_model=ConnectionOut)
async def disconnect(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    conn = await _connection(db, current_user.company_id)
    if conn is not None:
        await db.delete(conn)  # a credential, not business data - nothing to keep
        await db.commit()
    return ConnectionOut(connected=False)


@router.get("/mileage", response_model=MileageOut)
async def mileage(
    start: date,
    end: date,
    tz: str = Query("America/Chicago", max_length=64),
    odometer: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Miles per truck for local days start..end (inclusive).

    `miles` is Peak's IFTA (GPS) distance. With odometer=true each truck also
    gets its odometer at the start and end of the range and odometer_miles =
    end - start (what Payroll's Total Miles uses): from the recorded live ELD
    odometer when recording covers the range, else the first and last
    inspection (DVIR) in it.
    """
    conn, key = await _api_key(db, current_user.company_id)
    start_ms, end_ms = _range_ms(start, end, tz)
    spans: Dict[str, Optional[dict]] = {}
    recorded: Dict[str, dict] = {}
    if odometer:
        recorded = await eld_odometer.spans(
            db, conn,
            datetime.fromtimestamp(start_ms / 1000, timezone.utc), datetime.fromtimestamp(end_ms / 1000, timezone.utc),
        )
    try:
        vehicles, unit = await peak_eld.vehicles(key)
        miles = await peak_eld.miles_by_vehicle(key, start_ms, end_ms, unit)
        if odometer:
            gate = asyncio.Semaphore(5)

            async def one(vid: str):
                async with gate:
                    try:
                        spans[vid] = await peak_eld.odometer_span(key, vid, start_ms, end_ms, unit)
                    except peak_eld.PeakError as e:
                        if e.auth:
                            raise
                        spans[vid] = None  # this truck falls back to GPS miles

            await asyncio.gather(*(one(vid) for vid, m in miles.items() if m > 0 and vid not in recorded))
    except peak_eld.PeakError as e:
        await _record(db, conn, str(e))
        raise _peak_error(e)
    await _record(db, conn, None)

    trucks = (await db.execute(
        select(Truck).options(selectinload(Truck.current_driver))
        .where(Truck.company_id == current_user.company_id, Truck.type == "truck")
    )).scalars().all()
    by_id = {t.id: t for t in trucks}
    by_unit = {}
    for t in trucks:
        by_unit.setdefault(_norm_unit(t.truck_number), t)
    by_vin = {(t.vin or "").strip().upper(): t for t in trucks if (t.vin or "").strip()}
    manual = conn.truck_map or {}

    out: List[VehicleMiles] = []
    seen = set()
    for v in vehicles:
        eld_id = str(v.get("id") or "")
        if not eld_id:
            continue
        seen.add(eld_id)
        out.append(_vehicle_row(eld_id, v, miles.get(eld_id, 0.0), manual, by_id, by_unit, by_vin))
    for eld_id, m in miles.items():  # miles for a vehicle no longer listed
        if eld_id not in seen:
            out.append(_vehicle_row(eld_id, {"vehicleId": eld_id, "active": False}, m, manual, by_id, by_unit, by_vin))

    for r in out:
        if r.eld_id in recorded:
            span = recorded[r.eld_id]
            r.odometer_source = "eld"
            r.odometer_miles = span["miles"]
            r.start_odometer, r.end_odometer = span["start_odometer"], span["end_odometer"]
            r.start_time, r.end_time = span["start_time"], span["end_time"]
        elif spans.get(r.eld_id):
            span = spans[r.eld_id]
            r.odometer_source = "dvir"
            r.odometer_miles = span["miles"]
            r.start_odometer, r.end_odometer = span["start_odometer"], span["end_odometer"]
            r.start_time = datetime.fromtimestamp(span["start_time"] / 1000, timezone.utc)
            r.end_time = datetime.fromtimestamp(span["end_time"] / 1000, timezone.utc)
    out.sort(key=lambda r: (-r.miles, r.unit))
    return MileageOut(
        start=start, end=end,
        total_miles=round(sum(r.miles for r in out), 1),
        vehicles=out,
        # Matching choices: sold / not-leased trucks only when a Peak truck is already matched to one.
        trucks=sorted((TruckOption(id=t.id, truck_number=t.truck_number) for t in trucks
                       if t.status not in ("sold", "not_leased") or t.id in {r.truck_id for r in out}),
                      key=lambda t: t.truck_number),
    )


def _vehicle_row(eld_id, v, miles, manual, by_id, by_unit, by_vin) -> VehicleMiles:
    unit = str(v.get("vehicleId") or eld_id)
    vin = (v.get("vinNum") or "").strip().upper() or None
    truck, how = None, None
    if eld_id in manual:
        truck = by_id.get(manual[eld_id]) if manual[eld_id] else None
        how = "manual" if truck else None
    else:
        truck = by_unit.get(_norm_unit(unit))
        how = "unit" if truck else None
        if truck is None and vin:
            truck = by_vin.get(vin)
            how = "vin" if truck else None
    driver = truck.current_driver if truck else None
    return VehicleMiles(
        eld_id=eld_id, unit=unit, vin=vin, active=v.get("active", True) is not False,
        miles=round(miles, 1),
        truck_id=truck.id if truck else None,
        truck_number=truck.truck_number if truck else None,
        driver_name=f"{driver.first_name} {driver.last_name}".strip() if driver else None,
        matched_by=how,
    )


@router.get("/mileage/states", response_model=StatesOut)
async def mileage_by_state(
    start: date,
    end: date,
    tz: str = Query("America/Chicago", max_length=64),
    eld_ids: Optional[List[str]] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Miles per state (IFTA) for the given Peak trucks, or every truck that drove."""
    conn, key = await _api_key(db, current_user.company_id)
    start_ms, end_ms = _range_ms(start, end, tz)
    try:
        _, unit = await peak_eld.vehicles(key)
        if eld_ids:
            ids = list(dict.fromkeys(eld_ids))[:200]
        else:
            ids = [vid for vid, m in (await peak_eld.miles_by_vehicle(key, start_ms, end_ms, unit)).items() if m > 0]
        gate = asyncio.Semaphore(5)

        async def one(vid: str):
            async with gate:
                return vid, await peak_eld.miles_by_state(key, vid, start_ms, end_ms, unit)

        results = await asyncio.gather(*(one(v) for v in ids))
    except peak_eld.PeakError as e:
        await _record(db, conn, str(e))
        raise _peak_error(e)
    await _record(db, conn, None)

    totals: Dict[str, float] = {}
    by_vehicle: Dict[str, List[StateMiles]] = {}
    for vid, states in results:
        by_vehicle[vid] = [StateMiles(state=s, miles=round(m, 1)) for s, m in sorted(states.items(), key=lambda kv: -kv[1])]
        for s, m in states.items():
            totals[s] = totals.get(s, 0.0) + m
    return StatesOut(
        start=start, end=end,
        total_miles=round(sum(totals.values()), 1),
        states=[StateMiles(state=s, miles=round(m, 1)) for s, m in sorted(totals.items(), key=lambda kv: -kv[1])],
        by_vehicle=by_vehicle,
    )


@router.put("/truck-map", response_model=ConnectionOut)
async def set_truck_match(
    body: TruckMapIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Pin a Peak truck to a TMS truck (truck_id null = back to automatic)."""
    conn = await _connection(db, current_user.company_id)
    if conn is None:
        raise HTTPException(status_code=409, detail="Peak ELD isn't connected")
    if body.truck_id is not None:
        truck = await db.get(Truck, body.truck_id)
        if truck is None or truck.company_id != current_user.company_id:
            raise HTTPException(status_code=404, detail="Truck not found")
    mapping = dict(conn.truck_map or {})
    if body.truck_id is None:
        mapping.pop(body.eld_id, None)
    else:
        mapping[body.eld_id] = body.truck_id
    conn.truck_map = mapping
    await db.commit()
    return _conn_out(conn)
