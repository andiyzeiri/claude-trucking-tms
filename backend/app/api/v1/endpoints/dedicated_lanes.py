from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models.dedicated_lane import DedicatedLane
from app.schemas.dedicated_lane import DedicatedLaneCreate, DedicatedLaneUpdate, DedicatedLaneResponse
from app.core.security import get_current_active_user
from app.models.user import User
from app.services.dedicated_lane_scheduler import generate_loads_from_dedicated_lanes

router = APIRouter()


@router.get("/", response_model=List[DedicatedLaneResponse])
async def get_dedicated_lanes(
    skip: int = 0,
    limit: int = 100,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all dedicated lanes for the current company."""
    query = select(DedicatedLane).where(
        DedicatedLane.company_id == current_user.company_id
    ).options(
        selectinload(DedicatedLane.customer),
        selectinload(DedicatedLane.driver),
        selectinload(DedicatedLane.truck)
    )

    if active_only:
        query = query.where(DedicatedLane.is_active == True)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    lanes = result.scalars().all()
    return lanes


@router.post("/", response_model=DedicatedLaneResponse)
async def create_dedicated_lane(
    lane: DedicatedLaneCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new dedicated lane template."""
    # Validate day_of_week
    if lane.day_of_week < 0 or lane.day_of_week > 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="day_of_week must be between 0 (Monday) and 6 (Sunday)"
        )

    db_lane = DedicatedLane(**lane.model_dump(), company_id=current_user.company_id)
    db.add(db_lane)
    await db.commit()
    await db.refresh(db_lane)

    # Reload with relationships
    query = select(DedicatedLane).where(
        DedicatedLane.id == db_lane.id
    ).options(
        selectinload(DedicatedLane.customer),
        selectinload(DedicatedLane.driver),
        selectinload(DedicatedLane.truck)
    )
    result = await db.execute(query)
    return result.scalar_one()


@router.get("/{lane_id}", response_model=DedicatedLaneResponse)
async def get_dedicated_lane(
    lane_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a specific dedicated lane by ID."""
    query = select(DedicatedLane).where(
        DedicatedLane.id == lane_id,
        DedicatedLane.company_id == current_user.company_id
    ).options(
        selectinload(DedicatedLane.customer),
        selectinload(DedicatedLane.driver),
        selectinload(DedicatedLane.truck)
    )
    result = await db.execute(query)
    lane = result.scalar_one_or_none()
    if not lane:
        raise HTTPException(status_code=404, detail="Dedicated lane not found")
    return lane


@router.put("/{lane_id}", response_model=DedicatedLaneResponse)
async def update_dedicated_lane(
    lane_id: int,
    lane_update: DedicatedLaneUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update an existing dedicated lane."""
    query = select(DedicatedLane).where(
        DedicatedLane.id == lane_id,
        DedicatedLane.company_id == current_user.company_id
    )
    result = await db.execute(query)
    lane = result.scalar_one_or_none()
    if not lane:
        raise HTTPException(status_code=404, detail="Dedicated lane not found")

    # Validate day_of_week if being updated
    update_data = lane_update.model_dump(exclude_unset=True)
    if 'day_of_week' in update_data:
        if update_data['day_of_week'] < 0 or update_data['day_of_week'] > 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="day_of_week must be between 0 (Monday) and 6 (Sunday)"
            )

    for field, value in update_data.items():
        setattr(lane, field, value)

    await db.commit()
    await db.refresh(lane)

    # Reload with relationships
    query = select(DedicatedLane).where(
        DedicatedLane.id == lane.id
    ).options(
        selectinload(DedicatedLane.customer),
        selectinload(DedicatedLane.driver),
        selectinload(DedicatedLane.truck)
    )
    result = await db.execute(query)
    return result.scalar_one()


@router.delete("/{lane_id}")
async def delete_dedicated_lane(
    lane_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a dedicated lane."""
    query = select(DedicatedLane).where(
        DedicatedLane.id == lane_id,
        DedicatedLane.company_id == current_user.company_id
    )
    result = await db.execute(query)
    lane = result.scalar_one_or_none()
    if not lane:
        raise HTTPException(status_code=404, detail="Dedicated lane not found")

    await db.delete(lane)
    await db.commit()
    return {"message": "Dedicated lane deleted successfully"}


@router.post("/generate-loads")
async def generate_loads_now(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user)
):
    """
    Manually trigger load generation from dedicated lanes.
    This creates loads for the following week from all active dedicated lanes.
    Useful for testing or manual runs.
    """
    background_tasks.add_task(generate_loads_from_dedicated_lanes)
    return {
        "message": "Load generation started in background",
        "detail": "Loads will be created for the following week from all active dedicated lanes"
    }
