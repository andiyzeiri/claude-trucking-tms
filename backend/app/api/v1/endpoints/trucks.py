from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.truck import STATUS_OWNERSHIP, Truck
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


def _check_status(status_value, ownership) -> None:
    """Sold is for company equipment, Not Leased for owner-operators'."""
    status_value = getattr(status_value, "value", status_value)
    ownership = getattr(ownership, "value", ownership) or "company"
    need = STATUS_OWNERSHIP.get(status_value)
    if need and need != ownership:
        label = "Sold" if status_value == "sold" else "Not Leased"
        whose = "company" if need == "company" else "owner-operator"
        raise HTTPException(status_code=422, detail=f"{label} is only for {whose} equipment.")


@router.post("/", response_model=TruckResponse)
@router.post("", response_model=TruckResponse)
async def create_truck(
    truck: TruckCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    truck_data = truck.model_dump(exclude_unset=True)
    _check_status(truck_data.get("status", truck.status), truck_data.get("ownership", truck.ownership))
    db_truck = Truck(**truck_data, company_id=current_user.company_id)

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

    update_data = truck_update.model_dump(exclude_unset=True)
    _check_status(update_data.get("status", truck.status), update_data.get("ownership", truck.ownership))
    for field, value in update_data.items():
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