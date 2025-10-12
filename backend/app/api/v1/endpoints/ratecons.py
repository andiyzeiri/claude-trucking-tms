"""
Ratecon API endpoints
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.ratecon import Ratecon
from app.schemas.ratecon import RateconCreate, RateconUpdate, RateconResponse
from app.core.security import get_current_active_user
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=List[RateconResponse])
@router.get("", response_model=List[RateconResponse])
async def get_ratecons(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all ratecons for the current company"""
    query = select(Ratecon).where(Ratecon.company_id == current_user.company_id).offset(skip).limit(limit)
    result = await db.execute(query)
    ratecons = result.scalars().all()
    return ratecons


@router.post("/", response_model=RateconResponse)
@router.post("", response_model=RateconResponse)
async def create_ratecon(
    ratecon: RateconCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new ratecon"""
    db_ratecon = Ratecon(**ratecon.dict(), company_id=current_user.company_id)
    db.add(db_ratecon)
    await db.commit()
    await db.refresh(db_ratecon)
    return db_ratecon


@router.get("/{ratecon_id}", response_model=RateconResponse)
async def get_ratecon(
    ratecon_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a single ratecon by ID"""
    query = select(Ratecon).where(
        Ratecon.id == ratecon_id,
        Ratecon.company_id == current_user.company_id
    )
    result = await db.execute(query)
    ratecon = result.scalar_one_or_none()
    if not ratecon:
        raise HTTPException(status_code=404, detail="Ratecon not found")
    return ratecon


@router.put("/{ratecon_id}", response_model=RateconResponse)
async def update_ratecon(
    ratecon_id: int,
    ratecon_update: RateconUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update a ratecon"""
    query = select(Ratecon).where(
        Ratecon.id == ratecon_id,
        Ratecon.company_id == current_user.company_id
    )
    result = await db.execute(query)
    ratecon = result.scalar_one_or_none()
    if not ratecon:
        raise HTTPException(status_code=404, detail="Ratecon not found")

    for field, value in ratecon_update.dict(exclude_unset=True).items():
        setattr(ratecon, field, value)

    await db.commit()
    await db.refresh(ratecon)
    return ratecon


@router.delete("/{ratecon_id}")
async def delete_ratecon(
    ratecon_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a ratecon"""
    query = select(Ratecon).where(
        Ratecon.id == ratecon_id,
        Ratecon.company_id == current_user.company_id
    )
    result = await db.execute(query)
    ratecon = result.scalar_one_or_none()
    if not ratecon:
        raise HTTPException(status_code=404, detail="Ratecon not found")

    await db.delete(ratecon)
    await db.commit()
    return {"message": "Ratecon deleted successfully"}
