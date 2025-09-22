from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.load import Load
from app.schemas.load import LoadCreate, LoadUpdate, LoadResponse
from app.core.security import get_current_active_user
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=List[LoadResponse])
async def get_loads(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Load).where(Load.company_id == current_user.company_id).offset(skip).limit(limit)
    result = await db.execute(query)
    loads = result.scalars().all()
    return loads


@router.post("/", response_model=LoadResponse)
async def create_load(
    load: LoadCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    db_load = Load(**load.dict(), company_id=current_user.company_id)
    db.add(db_load)
    await db.commit()
    await db.refresh(db_load)
    return db_load


@router.get("/{load_id}", response_model=LoadResponse)
async def get_load(
    load_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Load).where(
        Load.id == load_id,
        Load.company_id == current_user.company_id
    )
    result = await db.execute(query)
    load = result.scalar_one_or_none()
    if not load:
        raise HTTPException(status_code=404, detail="Load not found")
    return load


@router.put("/{load_id}", response_model=LoadResponse)
async def update_load(
    load_id: int,
    load_update: LoadUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Load).where(
        Load.id == load_id,
        Load.company_id == current_user.company_id
    )
    result = await db.execute(query)
    load = result.scalar_one_or_none()
    if not load:
        raise HTTPException(status_code=404, detail="Load not found")

    for field, value in load_update.dict(exclude_unset=True).items():
        setattr(load, field, value)

    await db.commit()
    await db.refresh(load)
    return load


@router.delete("/{load_id}")
async def delete_load(
    load_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Load).where(
        Load.id == load_id,
        Load.company_id == current_user.company_id
    )
    result = await db.execute(query)
    load = result.scalar_one_or_none()
    if not load:
        raise HTTPException(status_code=404, detail="Load not found")

    await db.delete(load)
    await db.commit()
    return {"message": "Load deleted successfully"}