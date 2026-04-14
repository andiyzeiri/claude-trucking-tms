from typing import List
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.rate_to_operate import RateToOperate
from app.schemas.rate_to_operate import (
    RateToOperateCreate,
    RateToOperateUpdate,
    RateToOperateResponse,
)
from app.core.security import get_current_active_user
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=List[RateToOperateResponse])
async def list_rate_to_operate(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    query = (
        select(RateToOperate)
        .where(RateToOperate.company_id == current_user.company_id)
        .order_by(RateToOperate.section, RateToOperate.sort_order, RateToOperate.id)
    )
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=RateToOperateResponse)
async def create_rate_to_operate(
    payload: RateToOperateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    row = RateToOperate(**payload.dict(), company_id=current_user.company_id)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


@router.put("/{row_id}", response_model=RateToOperateResponse)
async def update_rate_to_operate(
    row_id: int,
    payload: RateToOperateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    query = select(RateToOperate).where(
        RateToOperate.id == row_id,
        RateToOperate.company_id == current_user.company_id,
    )
    result = await db.execute(query)
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Row not found")

    data = payload.dict(exclude_unset=True)
    for field, value in data.items():
        if field in ('miles', 'rate_per_mile', 'total') and value is not None:
            value = Decimal(str(value))
        setattr(row, field, value)

    await db.commit()
    await db.refresh(row)
    return row


@router.delete("/{row_id}")
async def delete_rate_to_operate(
    row_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    query = select(RateToOperate).where(
        RateToOperate.id == row_id,
        RateToOperate.company_id == current_user.company_id,
    )
    result = await db.execute(query)
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Row not found")

    await db.delete(row)
    await db.commit()
    return {"message": "Row deleted"}
