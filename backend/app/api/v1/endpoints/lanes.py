from datetime import datetime, timedelta, timezone
from decimal import Decimal
from statistics import median
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.lane import Lane
from app.schemas.lane import LaneCreate, LaneUpdate, LaneResponse
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.load import Load
from app.models.loads_ai import LIVE_AI_LOAD_STATUSES, IngestedDocument
from app.documents.facilities import _parse_location
from app.geo.places import locate, parse_place
from app.models.customer import Customer

router = APIRouter()


@router.get("/", response_model=List[LaneResponse])
async def get_lanes(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Lane).where(Lane.company_id == current_user.company_id).offset(skip).limit(limit)
    result = await db.execute(query)
    lanes = result.scalars().all()
    return lanes


@router.post("/", response_model=LaneResponse)
async def create_lane(
    lane: LaneCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    db_lane = Lane(**lane.dict(), company_id=current_user.company_id)
    db.add(db_lane)
    await db.commit()
    await db.refresh(db_lane)
    return db_lane


class LaneLoadOut(BaseModel):
    source: str  # "load" (entered) or "ai" (Loads AI)
    id: int
    load_number: Optional[str] = None
    broker: Optional[str] = None
    pickup_date: Optional[str] = None
    pickup_location: Optional[str] = None
    delivery_location: Optional[str] = None
    miles: Optional[int] = None
    rate: Optional[Decimal] = None


class LaneHistoryOut(BaseModel):
    origin_city: str
    origin_state: str
    destination_city: str
    destination_state: str
    origin_lat: Optional[float] = None
    origin_lng: Optional[float] = None
    destination_lat: Optional[float] = None
    destination_lng: Optional[float] = None
    miles: Optional[int] = None
    loads: int
    last_run: Optional[str] = None
    avg_rate: Optional[Decimal] = None
    avg_rpm: Optional[Decimal] = None
    load_list: List[LaneLoadOut] = []


class PlaceOut(BaseModel):
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


def _place(location) -> Optional[dict]:
    p = _parse_location(location)
    if not p.get("city") or not p.get("state"):
        return None
    return {"city": p["city"].strip().title(), "state": p["state"].upper(), "zip": p.get("zip_code")}


def _num(v) -> Optional[Decimal]:
    try:
        d = Decimal(str(v).replace("$", "").replace(",", "")) if v not in (None, "") else None
    except Exception:
        return None
    return d if d and d > 0 else None


@router.get("/place", response_model=PlaceOut)
async def find_place(q: str, current_user: User = Depends(get_current_active_user)):
    """A typed search ('Chicago, IL', 'IL', '60609') and where it is, for DH radius searches."""
    p = parse_place(q)
    hit = locate(p.get("city"), p.get("state"), p.get("zip")) if (p.get("zip") or (p.get("city") and p.get("state"))) else None
    return PlaceOut(**p, lat=hit[0] if hit else None, lng=hit[1] if hit else None)


@router.get("/history", response_model=List[LaneHistoryOut])
async def lane_history(
    days: int = 365,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Lanes run: every pickup city -> delivery city pair on the company's loads
    (entered loads and AI loads) of the last `days` days, with where both ends
    are (for DH radius searches), its miles (median of the loads' miles),
    number of loads, last pickup, average rate / rate per mile and the loads.
    """
    since = datetime.utcnow() - timedelta(days=days)
    runs = []
    loads = (await db.execute(
        select(Load.id, Load.load_number, Customer.name, Load.pickup_location, Load.delivery_location,
               Load.miles, Load.rate, Load.pickup_date, Load.created_at)
        .outerjoin(Customer, Customer.id == Load.customer_id)
        .where(Load.company_id == current_user.company_id, Load.created_at >= since)
    )).all()
    for lid, number, broker, pick, dele, miles, rate, pdate, created in loads:
        runs.append(("load", lid, number, broker, pick, dele, miles, rate, pdate or created))
    docs = (await db.execute(
        select(IngestedDocument.id, IngestedDocument.draft, IngestedDocument.created_at).where(
            IngestedDocument.company_id == current_user.company_id,
            IngestedDocument.status.in_(LIVE_AI_LOAD_STATUSES),
            IngestedDocument.draft.isnot(None),
            IngestedDocument.created_at >= since,
        )
    )).all()
    for did, draft, created in docs:
        f = draft if isinstance(draft, dict) else {}
        when = f.get("pickup_date")
        try:
            when = datetime.fromisoformat(str(when).replace("Z", "+00:00")).replace(tzinfo=None) if when else created
        except ValueError:
            when = created
        runs.append(("ai", did, f.get("load_number") or f.get("broker_load_number"), f.get("broker_name"),
                     f.get("pickup_location"), f.get("delivery_location"), f.get("miles"), f.get("rate"), when))

    lanes = {}
    for source, rid, number, broker, pick, dele, miles, rate, when in runs:
        # created_at is timezone-aware, pickup dates are wall-clock: compare as naive UTC.
        if isinstance(when, datetime) and when.tzinfo is not None:
            when = when.astimezone(timezone.utc).replace(tzinfo=None)
        o, d = _place(pick), _place(dele)
        if not o or not d:
            continue
        key = ((o["city"], o["state"]), (d["city"], d["state"]))
        lane = lanes.setdefault(key, {"miles": [], "rates": [], "rpm": [], "last": None, "list": [],
                                      "o": None, "d": None})
        lane["o"] = lane["o"] or locate(o["city"], o["state"], o["zip"])
        lane["d"] = lane["d"] or locate(d["city"], d["state"], d["zip"])
        m, r = _num(miles), _num(rate)
        if m:
            lane["miles"].append(int(m))
        if r:
            lane["rates"].append(r)
            if m:
                lane["rpm"].append(r / m)
        if when and (lane["last"] is None or when > lane["last"]):
            lane["last"] = when
        lane["list"].append(LaneLoadOut(
            source=source, id=rid, load_number=number, broker=broker,
            pickup_date=when.date().isoformat() if when else None,
            pickup_location=pick, delivery_location=dele, miles=int(m) if m else None,
            rate=r.quantize(Decimal("0.01")) if r else None,
        ))

    cents = lambda xs: (sum(xs) / len(xs)).quantize(Decimal("0.01")) if xs else None
    out = []
    for (o, d), v in lanes.items():
        v["list"].sort(key=lambda l: l.pickup_date or "", reverse=True)
        out.append(LaneHistoryOut(
            origin_city=o[0], origin_state=o[1], destination_city=d[0], destination_state=d[1],
            origin_lat=v["o"][0] if v["o"] else None, origin_lng=v["o"][1] if v["o"] else None,
            destination_lat=v["d"][0] if v["d"] else None, destination_lng=v["d"][1] if v["d"] else None,
            miles=int(median(v["miles"])) if v["miles"] else None, loads=len(v["list"]),
            last_run=v["last"].date().isoformat() if v["last"] else None,
            avg_rate=cents(v["rates"]), avg_rpm=cents(v["rpm"]), load_list=v["list"],
        ))
    out.sort(key=lambda l: (-l.loads, l.origin_state, l.origin_city))
    return out


@router.get("/{lane_id}", response_model=LaneResponse)
async def get_lane(
    lane_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Lane).where(
        Lane.id == lane_id,
        Lane.company_id == current_user.company_id
    )
    result = await db.execute(query)
    lane = result.scalar_one_or_none()
    if not lane:
        raise HTTPException(status_code=404, detail="Lane not found")
    return lane


@router.put("/{lane_id}", response_model=LaneResponse)
async def update_lane(
    lane_id: int,
    lane_update: LaneUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Lane).where(
        Lane.id == lane_id,
        Lane.company_id == current_user.company_id
    )
    result = await db.execute(query)
    lane = result.scalar_one_or_none()
    if not lane:
        raise HTTPException(status_code=404, detail="Lane not found")

    for field, value in lane_update.dict(exclude_unset=True).items():
        setattr(lane, field, value)

    await db.commit()
    await db.refresh(lane)
    return lane


@router.delete("/{lane_id}")
async def delete_lane(
    lane_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Lane).where(
        Lane.id == lane_id,
        Lane.company_id == current_user.company_id
    )
    result = await db.execute(query)
    lane = result.scalar_one_or_none()
    if not lane:
        raise HTTPException(status_code=404, detail="Lane not found")

    await db.delete(lane)
    await db.commit()
    return {"message": "Lane deleted successfully"}
