from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.payroll import Payroll
from app.schemas.payroll import PayrollCreate, PayrollUpdate, PayrollResponse
from app.core.security import get_current_active_user
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=List[PayrollResponse])
async def get_payroll_entries(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Payroll).where(Payroll.company_id == current_user.company_id).offset(skip).limit(limit)
    result = await db.execute(query)
    payroll_entries = result.scalars().all()
    return payroll_entries


@router.post("/", response_model=PayrollResponse)
async def create_payroll_entry(
    payroll: PayrollCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    db_payroll = Payroll(**payroll.dict(), company_id=current_user.company_id)
    db.add(db_payroll)
    await db.commit()
    await db.refresh(db_payroll)
    return db_payroll


@router.get("/{payroll_id}", response_model=PayrollResponse)
async def get_payroll_entry(
    payroll_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Payroll).where(
        Payroll.id == payroll_id,
        Payroll.company_id == current_user.company_id
    )
    result = await db.execute(query)
    payroll = result.scalar_one_or_none()
    if not payroll:
        raise HTTPException(status_code=404, detail="Payroll entry not found")
    return payroll


@router.put("/{payroll_id}", response_model=PayrollResponse)
async def update_payroll_entry(
    payroll_id: int,
    payroll_update: PayrollUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Payroll).where(
        Payroll.id == payroll_id,
        Payroll.company_id == current_user.company_id
    )
    result = await db.execute(query)
    payroll = result.scalar_one_or_none()
    if not payroll:
        raise HTTPException(status_code=404, detail="Payroll entry not found")

    for field, value in payroll_update.dict(exclude_unset=True).items():
        setattr(payroll, field, value)

    await db.commit()
    await db.refresh(payroll)
    return payroll


@router.delete("/{payroll_id}")
async def delete_payroll_entry(
    payroll_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Payroll).where(
        Payroll.id == payroll_id,
        Payroll.company_id == current_user.company_id
    )
    result = await db.execute(query)
    payroll = result.scalar_one_or_none()
    if not payroll:
        raise HTTPException(status_code=404, detail="Payroll entry not found")

    await db.delete(payroll)
    await db.commit()
    return {"message": "Payroll entry deleted successfully"}
