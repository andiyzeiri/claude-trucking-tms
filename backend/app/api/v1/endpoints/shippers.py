from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.shipper import Shipper
from app.schemas.shipper import ShipperCreate, ShipperUpdate, ShipperResponse
from app.core.security import get_current_active_user
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=List[ShipperResponse])
@router.get("", response_model=List[ShipperResponse])
async def get_shippers(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Shipper).where(Shipper.company_id == current_user.company_id).offset(skip).limit(limit)
    result = await db.execute(query)
    shippers = result.scalars().all()
    return shippers


@router.post("/", response_model=ShipperResponse)
@router.post("", response_model=ShipperResponse)
async def create_shipper(
    shipper: ShipperCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    db_shipper = Shipper(**shipper.dict(), company_id=current_user.company_id)
    db.add(db_shipper)
    await db.commit()
    await db.refresh(db_shipper)
    return db_shipper


@router.get("/{shipper_id}", response_model=ShipperResponse)
async def get_shipper(
    shipper_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Shipper).where(
        Shipper.id == shipper_id,
        Shipper.company_id == current_user.company_id
    )
    result = await db.execute(query)
    shipper = result.scalar_one_or_none()
    if not shipper:
        raise HTTPException(status_code=404, detail="Shipper not found")
    return shipper


@router.put("/{shipper_id}", response_model=ShipperResponse)
async def update_shipper(
    shipper_id: int,
    shipper_update: ShipperUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Shipper).where(
        Shipper.id == shipper_id,
        Shipper.company_id == current_user.company_id
    )
    result = await db.execute(query)
    shipper = result.scalar_one_or_none()
    if not shipper:
        raise HTTPException(status_code=404, detail="Shipper not found")

    for field, value in shipper_update.dict(exclude_unset=True).items():
        setattr(shipper, field, value)

    await db.commit()
    await db.refresh(shipper)
    return shipper


@router.delete("/{shipper_id}")
async def delete_shipper(
    shipper_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Shipper).where(
        Shipper.id == shipper_id,
        Shipper.company_id == current_user.company_id
    )
    result = await db.execute(query)
    shipper = result.scalar_one_or_none()
    if not shipper:
        raise HTTPException(status_code=404, detail="Shipper not found")

    await db.delete(shipper)
    await db.commit()
    return {"message": "Shipper deleted successfully"}
