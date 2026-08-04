from typing import List
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models.fuel import Fuel
from app.schemas.fuel import FuelCreate, FuelUpdate, FuelResponse
from app.core.security import get_current_active_user
from app.models.user import User
from app.services import accounting as gl

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/", response_model=List[FuelResponse])
async def get_fuel_entries(
    skip: int = 0,
    limit: int = 10000,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = (
        select(Fuel)
        .options(selectinload(Fuel.driver), selectinload(Fuel.truck))
        .where(Fuel.company_id == current_user.company_id)
        .offset(skip)
        .limit(limit)
        .order_by(Fuel.date.desc())
    )
    result = await db.execute(query)
    fuel_entries = result.scalars().all()
    return fuel_entries


@router.post("/", response_model=FuelResponse)
async def create_fuel_entry(
    fuel: FuelCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    db_fuel = Fuel(**fuel.dict(), company_id=current_user.company_id)
    db.add(db_fuel)
    await db.commit()
    await db.refresh(db_fuel)

    # Ledger: debit Fuel Expense, credit Cash/AP. Cannot fail the receipt.
    await gl.auto_post_safe(
        company_id=current_user.company_id,
        event_key="fuel",
        source_id=db_fuel.id,
        amount=db_fuel.total_amount,
        entry_date=db_fuel.date,
        memo=f"Fuel purchase #{db_fuel.id}",
        user_id=current_user.id,
    )

    # Re-query with eager loading for relationships
    query = (
        select(Fuel)
        .options(selectinload(Fuel.driver), selectinload(Fuel.truck))
        .where(Fuel.id == db_fuel.id)
    )
    result = await db.execute(query)
    return result.scalar_one()


@router.get("/{fuel_id}", response_model=FuelResponse)
async def get_fuel_entry(
    fuel_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = (
        select(Fuel)
        .options(selectinload(Fuel.driver), selectinload(Fuel.truck))
        .where(
            Fuel.id == fuel_id,
            Fuel.company_id == current_user.company_id
        )
    )
    result = await db.execute(query)
    fuel = result.scalar_one_or_none()
    if not fuel:
        raise HTTPException(status_code=404, detail="Fuel entry not found")
    return fuel


@router.put("/{fuel_id}", response_model=FuelResponse)
async def update_fuel_entry(
    fuel_id: int,
    fuel_update: FuelUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    logger.info(f"🔧 Fuel update request for ID {fuel_id}: {fuel_update.dict()}")
    query = (
        select(Fuel)
        .options(selectinload(Fuel.driver), selectinload(Fuel.truck))
        .where(
            Fuel.id == fuel_id,
            Fuel.company_id == current_user.company_id
        )
    )
    result = await db.execute(query)
    fuel = result.scalar_one_or_none()
    if not fuel:
        raise HTTPException(status_code=404, detail="Fuel entry not found")

    update_data = fuel_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(fuel, field, value)

    await db.commit()

    # Ledger: reverse and repost if the amount or date changed.
    await gl.auto_post_safe(
        company_id=current_user.company_id,
        event_key="fuel",
        source_id=fuel.id,
        amount=fuel.total_amount,
        entry_date=fuel.date,
        memo=f"Fuel purchase #{fuel.id}",
        user_id=current_user.id,
    )

    # Re-query with eager loading for relationships
    query = (
        select(Fuel)
        .options(selectinload(Fuel.driver), selectinload(Fuel.truck))
        .where(Fuel.id == fuel_id)
    )
    result = await db.execute(query)
    return result.scalar_one()


@router.delete("/{fuel_id}")
async def delete_fuel_entry(
    fuel_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Fuel).where(
        Fuel.id == fuel_id,
        Fuel.company_id == current_user.company_id
    )
    result = await db.execute(query)
    fuel = result.scalar_one_or_none()
    if not fuel:
        raise HTTPException(status_code=404, detail="Fuel entry not found")

    # Capture before the row is gone.
    deleted_id = fuel.id
    fuel_date = fuel.date

    await db.delete(fuel)
    await db.commit()

    # Ledger: reverse the posting, don't erase it.
    await gl.auto_post_safe(
        company_id=current_user.company_id,
        event_key="fuel",
        source_id=deleted_id,
        amount=None,
        entry_date=fuel_date,
        memo=f"Fuel purchase #{deleted_id} deleted",
        user_id=current_user.id,
    )
    return {"message": "Fuel entry deleted successfully"}
