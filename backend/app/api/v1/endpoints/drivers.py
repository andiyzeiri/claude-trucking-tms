from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.driver import Driver
from app.schemas.driver import DriverCreate, DriverUpdate, DriverResponse
from app.core.security import get_current_active_user
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=List[DriverResponse])
@router.get("", response_model=List[DriverResponse])
async def get_drivers(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Driver).where(Driver.company_id == current_user.company_id).offset(skip).limit(limit)
    result = await db.execute(query)
    drivers = result.scalars().all()
    return drivers


@router.post("/", response_model=DriverResponse)
@router.post("", response_model=DriverResponse)
async def create_driver(
    driver: DriverCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    db_driver = Driver(**driver.dict(), company_id=current_user.company_id)
    db.add(db_driver)
    await db.commit()
    await db.refresh(db_driver)
    return db_driver


@router.get("/{driver_id}", response_model=DriverResponse)
async def get_driver(
    driver_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Driver).where(
        Driver.id == driver_id,
        Driver.company_id == current_user.company_id
    )
    result = await db.execute(query)
    driver = result.scalar_one_or_none()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    return driver


@router.put("/{driver_id}", response_model=DriverResponse)
async def update_driver(
    driver_id: int,
    driver_update: DriverUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Driver).where(
        Driver.id == driver_id,
        Driver.company_id == current_user.company_id
    )
    result = await db.execute(query)
    driver = result.scalar_one_or_none()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    for field, value in driver_update.dict(exclude_unset=True).items():
        setattr(driver, field, value)

    await db.commit()
    await db.refresh(driver)
    return driver


@router.delete("/{driver_id}")
async def delete_driver(
    driver_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Driver).where(
        Driver.id == driver_id,
        Driver.company_id == current_user.company_id
    )
    result = await db.execute(query)
    driver = result.scalar_one_or_none()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    await db.delete(driver)
    await db.commit()
    return {"message": "Driver deleted successfully"}