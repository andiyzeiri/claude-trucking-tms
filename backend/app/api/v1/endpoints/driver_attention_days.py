from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel
from datetime import date
from typing import List

from app.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.driver_attention_day import DriverAttentionDay

router = APIRouter()


class AttentionDayCreate(BaseModel):
    driver_id: int
    date: date


class AttentionDayResponse(BaseModel):
    id: int
    driver_id: int
    date: date
    company_id: int

    class Config:
        from_attributes = True


@router.get("/", response_model=List[AttentionDayResponse])
async def get_attention_days(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all attention days for the current company"""
    query = select(DriverAttentionDay).where(
        DriverAttentionDay.company_id == current_user.company_id
    )
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/toggle", response_model=dict)
async def toggle_attention_day(
    attention_day: AttentionDayCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Toggle attention status for a driver on a specific date"""
    # Check if attention day exists
    query = select(DriverAttentionDay).where(
        DriverAttentionDay.driver_id == attention_day.driver_id,
        DriverAttentionDay.date == attention_day.date,
        DriverAttentionDay.company_id == current_user.company_id
    )
    result = await db.execute(query)
    existing = result.scalar_one_or_none()

    if existing:
        # Remove attention day
        await db.delete(existing)
        await db.commit()
        return {"status": "removed", "message": "Attention removed"}
    else:
        # Add attention day
        new_attention_day = DriverAttentionDay(
            driver_id=attention_day.driver_id,
            date=attention_day.date,
            company_id=current_user.company_id
        )
        db.add(new_attention_day)
        await db.commit()
        await db.refresh(new_attention_day)
        return {"status": "added", "message": "Marked for attention"}


@router.delete("/{driver_id}/{date_str}")
async def remove_attention_day(
    driver_id: int,
    date_str: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Remove a specific attention day"""
    attention_date = date.fromisoformat(date_str)
    query = delete(DriverAttentionDay).where(
        DriverAttentionDay.driver_id == driver_id,
        DriverAttentionDay.date == attention_date,
        DriverAttentionDay.company_id == current_user.company_id
    )
    await db.execute(query)
    await db.commit()
    return {"status": "removed"}
