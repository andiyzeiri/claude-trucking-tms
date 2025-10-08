from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.lane import Lane
from app.schemas.lane import LaneCreate, LaneUpdate, LaneResponse
from app.core.security import get_current_active_user
from app.models.user import User

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
