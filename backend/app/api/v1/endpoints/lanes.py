from datetime import datetime, timedelta
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


class LaneHistoryOut(BaseModel):
    origin_city: str
    origin_state: str
    destination_city: str
    destination_state: str
    miles: Optional[int] = None
    loads: int
    last_run: Optional[str] = None
    avg_rate: Optional[Decimal] = None
    avg_rpm: Optional[Decimal] = None


def _city_state(location) -> Optional[tuple]:
    p = _parse_location(location)
    if not p.get("city") or not p.get("state"):
        return None
    return (p["city"].strip().title(), p["state"].upper())


def _num(v) -> Optional[Decimal]:
    try:
        d = Decimal(str(v).replace("$", "").replace(",", "")) if v not in (None, "") else None
    except Exception:
        return None
    return d if d and d > 0 else None


@router.get("/history", response_model=List[LaneHistoryOut])
async def lane_history(
    days: int = 365,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Lanes run: every pickup city -> delivery city pair on the company's loads
    (entered loads and AI loads) of the last `days` days, with its miles
    (median of the loads' miles), number of loads, last pickup and average
    linehaul rate / rate per mile.
    """
    since = datetime.utcnow() - timedelta(days=days)
    runs = []  # (origin, dest, miles, rate, date)
    loads = (await db.execute(
        select(Load.pickup_location, Load.delivery_location, Load.miles, Load.rate, Load.pickup_date, Load.created_at)
        .where(Load.company_id == current_user.company_id, Load.created_at >= since)
    )).all()
    for pick, dele, miles, rate, pdate, created in loads:
        runs.append((pick, dele, miles, rate, pdate or created))
    docs = (await db.execute(
        select(IngestedDocument.draft, IngestedDocument.created_at).where(
            IngestedDocument.company_id == current_user.company_id,
            IngestedDocument.status.in_(LIVE_AI_LOAD_STATUSES),
            IngestedDocument.draft.isnot(None),
            IngestedDocument.created_at >= since,
        )
    )).all()
    for draft, created in docs:
        f = draft if isinstance(draft, dict) else {}
        when = f.get("pickup_date")
        try:
            when = datetime.fromisoformat(str(when).replace("Z", "+00:00")).replace(tzinfo=None) if when else created
        except ValueError:
            when = created
        runs.append((f.get("pickup_location"), f.get("delivery_location"), f.get("miles"), f.get("rate"), when))

    lanes = {}
    for pick, dele, miles, rate, when in runs:
        o, d = _city_state(pick), _city_state(dele)
        if not o or not d:
            continue
        lane = lanes.setdefault((o, d), {"miles": [], "rates": [], "rpm": [], "count": 0, "last": None})
        lane["count"] += 1
        m = _num(miles)
        r = _num(rate)
        if m:
            lane["miles"].append(int(m))
        if r:
            lane["rates"].append(r)
            if m:
                lane["rpm"].append(r / m)
        if when and (lane["last"] is None or when > lane["last"]):
            lane["last"] = when

    cents = lambda xs: (sum(xs) / len(xs)).quantize(Decimal("0.01")) if xs else None
    out = [
        LaneHistoryOut(
            origin_city=o[0], origin_state=o[1], destination_city=d[0], destination_state=d[1],
            miles=int(median(v["miles"])) if v["miles"] else None, loads=v["count"],
            last_run=v["last"].date().isoformat() if v["last"] else None,
            avg_rate=cents(v["rates"]), avg_rpm=cents(v["rpm"]),
        )
        for (o, d), v in lanes.items()
    ]
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
