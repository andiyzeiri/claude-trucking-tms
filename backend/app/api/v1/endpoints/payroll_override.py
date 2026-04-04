from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.database import get_db
from app.models.payroll_override import PayrollOverride
from app.schemas.payroll_override import PayrollOverrideCreate, PayrollOverrideResponse
from app.core.security import get_current_active_user
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=List[PayrollOverrideResponse])
async def get_overrides(
    year: int = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(PayrollOverride).where(
        PayrollOverride.company_id == current_user.company_id,
        PayrollOverride.year == year
    )
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=PayrollOverrideResponse)
async def create_or_update_override(
    override: PayrollOverrideCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # Check if override already exists for this driver/year/week/field
    query = select(PayrollOverride).where(
        PayrollOverride.company_id == current_user.company_id,
        PayrollOverride.driver_id == override.driver_id,
        PayrollOverride.year == override.year,
        PayrollOverride.week_number == override.week_number,
        PayrollOverride.field == override.field
    )
    result = await db.execute(query)
    existing = result.scalar_one_or_none()

    if existing:
        existing.value = override.value
        await db.commit()
        await db.refresh(existing)
        return existing
    else:
        db_override = PayrollOverride(
            driver_id=override.driver_id,
            company_id=current_user.company_id,
            year=override.year,
            week_number=override.week_number,
            field=override.field,
            value=override.value
        )
        db.add(db_override)
        await db.commit()
        await db.refresh(db_override)
        return db_override
