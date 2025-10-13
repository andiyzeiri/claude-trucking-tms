from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models.fuel import Fuel
from app.schemas.fuel import FuelCreate, FuelUpdate, FuelResponse
from app.core.security import get_current_active_user
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=List[FuelResponse])
async def get_fuel_entries(
    skip: int = 0,
    limit: int = 100,
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
    return db_fuel


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
    await db.refresh(fuel)
    return fuel


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

    await db.delete(fuel)
    await db.commit()
    return {"message": "Fuel entry deleted successfully"}
