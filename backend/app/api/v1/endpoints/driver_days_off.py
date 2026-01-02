from typing import List
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel
from app.database import get_db
from app.models.driver_day_off import DriverDayOff
from app.core.security import get_current_active_user
from app.models.user import User

router = APIRouter()


class DayOffCreate(BaseModel):
    driver_id: int
    date: date


class DayOffResponse(BaseModel):
    id: int
    driver_id: int
    date: date

    class Config:
        from_attributes = True


class DayOffBulkUpdate(BaseModel):
    days_off: List[DayOffCreate]


@router.get("/", response_model=List[DayOffResponse])
@router.get("", response_model=List[DayOffResponse])
async def get_days_off(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all driver days off for the company"""
    query = select(DriverDayOff).where(
        DriverDayOff.company_id == current_user.company_id
    )
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=DayOffResponse)
@router.post("", response_model=DayOffResponse)
async def add_day_off(
    day_off: DayOffCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Add a day off for a driver"""
    # Check if already exists
    query = select(DriverDayOff).where(
        DriverDayOff.driver_id == day_off.driver_id,
        DriverDayOff.date == day_off.date,
        DriverDayOff.company_id == current_user.company_id
    )
    result = await db.execute(query)
    existing = result.scalar_one_or_none()

    if existing:
        return existing  # Already exists, return it

    db_day_off = DriverDayOff(
        driver_id=day_off.driver_id,
        date=day_off.date,
        company_id=current_user.company_id
    )
    db.add(db_day_off)
    await db.commit()
    await db.refresh(db_day_off)
    return db_day_off


@router.delete("/")
@router.delete("")
async def remove_day_off(
    driver_id: int,
    date: date,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Remove a day off for a driver"""
    query = select(DriverDayOff).where(
        DriverDayOff.driver_id == driver_id,
        DriverDayOff.date == date,
        DriverDayOff.company_id == current_user.company_id
    )
    result = await db.execute(query)
    day_off = result.scalar_one_or_none()

    if not day_off:
        return {"message": "Day off not found or already removed"}

    await db.delete(day_off)
    await db.commit()
    return {"message": "Day off removed successfully"}


@router.post("/toggle")
async def toggle_day_off(
    day_off: DayOffCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Toggle a day off for a driver - add if not exists, remove if exists"""
    query = select(DriverDayOff).where(
        DriverDayOff.driver_id == day_off.driver_id,
        DriverDayOff.date == day_off.date,
        DriverDayOff.company_id == current_user.company_id
    )
    result = await db.execute(query)
    existing = result.scalar_one_or_none()

    if existing:
        # Remove it
        await db.delete(existing)
        await db.commit()
        return {"action": "removed", "is_off": False}
    else:
        # Add it
        db_day_off = DriverDayOff(
            driver_id=day_off.driver_id,
            date=day_off.date,
            company_id=current_user.company_id
        )
        db.add(db_day_off)
        await db.commit()
        return {"action": "added", "is_off": True}
