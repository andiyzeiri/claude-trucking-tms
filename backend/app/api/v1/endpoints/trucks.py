from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.truck import Truck
from app.schemas.truck import TruckCreate, TruckUpdate, TruckResponse
from app.core.security import get_current_active_user
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=List[TruckResponse])
@router.get("", response_model=List[TruckResponse])
async def get_trucks(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Truck).where(Truck.company_id == current_user.company_id).offset(skip).limit(limit)
    result = await db.execute(query)
    trucks = result.scalars().all()
    return trucks


@router.post("/", response_model=TruckResponse)
@router.post("", response_model=TruckResponse)
async def create_truck(
    truck: TruckCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    db_truck = Truck(**truck.dict(), company_id=current_user.company_id)
    db.add(db_truck)
    await db.commit()
    await db.refresh(db_truck)
    return db_truck


@router.get("/{truck_id}", response_model=TruckResponse)
async def get_truck(
    truck_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Truck).where(
        Truck.id == truck_id,
        Truck.company_id == current_user.company_id
    )
    result = await db.execute(query)
    truck = result.scalar_one_or_none()
    if not truck:
        raise HTTPException(status_code=404, detail="Truck not found")
    return truck


@router.put("/{truck_id}", response_model=TruckResponse)
async def update_truck(
    truck_id: int,
    truck_update: TruckUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Truck).where(
        Truck.id == truck_id,
        Truck.company_id == current_user.company_id
    )
    result = await db.execute(query)
    truck = result.scalar_one_or_none()
    if not truck:
        raise HTTPException(status_code=404, detail="Truck not found")

    for field, value in truck_update.dict(exclude_unset=True).items():
        setattr(truck, field, value)

    await db.commit()
    await db.refresh(truck)
    return truck


@router.delete("/{truck_id}")
async def delete_truck(
    truck_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Truck).where(
        Truck.id == truck_id,
        Truck.company_id == current_user.company_id
    )
    result = await db.execute(query)
    truck = result.scalar_one_or_none()
    if not truck:
        raise HTTPException(status_code=404, detail="Truck not found")

    await db.delete(truck)
    await db.commit()
    return {"message": "Truck deleted successfully"}