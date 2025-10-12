from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.receiver import Receiver
from app.schemas.receiver import ReceiverCreate, ReceiverUpdate, ReceiverResponse
from app.core.security import get_current_active_user
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=List[ReceiverResponse])
@router.get("", response_model=List[ReceiverResponse])
async def get_receivers(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Receiver).where(Receiver.company_id == current_user.company_id).offset(skip).limit(limit)
    result = await db.execute(query)
    receivers = result.scalars().all()
    return receivers


@router.post("/", response_model=ReceiverResponse)
@router.post("", response_model=ReceiverResponse)
async def create_receiver(
    receiver: ReceiverCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    db_receiver = Receiver(**receiver.dict(), company_id=current_user.company_id)
    db.add(db_receiver)
    await db.commit()
    await db.refresh(db_receiver)
    return db_receiver


@router.get("/{receiver_id}", response_model=ReceiverResponse)
async def get_receiver(
    receiver_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Receiver).where(
        Receiver.id == receiver_id,
        Receiver.company_id == current_user.company_id
    )
    result = await db.execute(query)
    receiver = result.scalar_one_or_none()
    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver not found")
    return receiver


@router.put("/{receiver_id}", response_model=ReceiverResponse)
async def update_receiver(
    receiver_id: int,
    receiver_update: ReceiverUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Receiver).where(
        Receiver.id == receiver_id,
        Receiver.company_id == current_user.company_id
    )
    result = await db.execute(query)
    receiver = result.scalar_one_or_none()
    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver not found")

    for field, value in receiver_update.dict(exclude_unset=True).items():
        setattr(receiver, field, value)

    await db.commit()
    await db.refresh(receiver)
    return receiver


@router.delete("/{receiver_id}")
async def delete_receiver(
    receiver_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Receiver).where(
        Receiver.id == receiver_id,
        Receiver.company_id == current_user.company_id
    )
    result = await db.execute(query)
    receiver = result.scalar_one_or_none()
    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver not found")

    await db.delete(receiver)
    await db.commit()
    return {"message": "Receiver deleted successfully"}
