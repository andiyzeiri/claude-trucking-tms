from typing import List, Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models.ifta import IFTA
from app.schemas.ifta import IFTACreate, IFTAUpdate, IFTAResponse, IFTASummary
from app.core.security import get_current_active_user
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=List[IFTAResponse])
async def get_ifta_entries(
    year: Optional[int] = None,
    quarter: Optional[int] = None,
    truck_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all IFTA entries for the current company, optionally filtered by year/quarter."""
    query = (
        select(IFTA)
        .options(selectinload(IFTA.truck))
        .where(IFTA.company_id == current_user.company_id)
    )

    if year is not None:
        query = query.where(IFTA.year == year)
    if quarter is not None:
        query = query.where(IFTA.quarter == quarter)
    if truck_id is not None:
        query = query.where(IFTA.truck_id == truck_id)

    query = query.order_by(IFTA.year.desc(), IFTA.quarter.desc(), IFTA.jurisdiction)
    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/summary", response_model=IFTASummary)
async def get_ifta_summary(
    year: int,
    quarter: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get summary totals for a specific quarter."""
    query = select(
        func.sum(IFTA.total_miles).label("total_miles"),
        func.sum(IFTA.taxable_miles).label("taxable_miles"),
        func.sum(IFTA.tax_paid_gallons).label("total_gallons"),
        func.count(IFTA.id).label("jurisdiction_count")
    ).where(
        IFTA.company_id == current_user.company_id,
        IFTA.year == year,
        IFTA.quarter == quarter
    )

    result = await db.execute(query)
    row = result.one()

    total_miles = row.total_miles or 0
    total_gallons = row.total_gallons or Decimal("0")
    overall_mpg = None
    if total_gallons > 0:
        overall_mpg = Decimal(str(total_miles)) / total_gallons

    return IFTASummary(
        year=year,
        quarter=quarter,
        total_miles=total_miles,
        total_taxable_miles=row.taxable_miles or 0,
        total_gallons=total_gallons,
        overall_mpg=overall_mpg,
        jurisdiction_count=row.jurisdiction_count or 0
    )


@router.post("/", response_model=IFTAResponse)
async def create_ifta_entry(
    ifta: IFTACreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new IFTA entry."""
    # Validate quarter
    if ifta.quarter < 1 or ifta.quarter > 4:
        raise HTTPException(
            status_code=400,
            detail="Quarter must be between 1 and 4"
        )

    # Calculate MPG if gallons provided
    mpg = None
    if ifta.tax_paid_gallons and ifta.tax_paid_gallons > 0 and ifta.total_miles > 0:
        mpg = Decimal(str(ifta.total_miles)) / ifta.tax_paid_gallons

    db_ifta = IFTA(
        **ifta.model_dump(exclude={"mpg"}),
        mpg=mpg,
        company_id=current_user.company_id
    )
    db.add(db_ifta)
    await db.commit()
    await db.refresh(db_ifta)

    # Reload with relationships
    query = select(IFTA).where(IFTA.id == db_ifta.id).options(selectinload(IFTA.truck))
    result = await db.execute(query)
    return result.scalar_one()


@router.get("/{ifta_id}", response_model=IFTAResponse)
async def get_ifta_entry(
    ifta_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a specific IFTA entry by ID."""
    query = (
        select(IFTA)
        .options(selectinload(IFTA.truck))
        .where(
            IFTA.id == ifta_id,
            IFTA.company_id == current_user.company_id
        )
    )
    result = await db.execute(query)
    ifta = result.scalar_one_or_none()
    if not ifta:
        raise HTTPException(status_code=404, detail="IFTA entry not found")
    return ifta


@router.put("/{ifta_id}", response_model=IFTAResponse)
async def update_ifta_entry(
    ifta_id: int,
    ifta_update: IFTAUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update an existing IFTA entry."""
    query = select(IFTA).where(
        IFTA.id == ifta_id,
        IFTA.company_id == current_user.company_id
    )
    result = await db.execute(query)
    ifta = result.scalar_one_or_none()
    if not ifta:
        raise HTTPException(status_code=404, detail="IFTA entry not found")

    # Validate quarter if being updated
    update_data = ifta_update.model_dump(exclude_unset=True)
    if 'quarter' in update_data:
        if update_data['quarter'] < 1 or update_data['quarter'] > 4:
            raise HTTPException(
                status_code=400,
                detail="Quarter must be between 1 and 4"
            )

    for field, value in update_data.items():
        setattr(ifta, field, value)

    # Recalculate MPG
    if ifta.tax_paid_gallons and ifta.tax_paid_gallons > 0 and ifta.total_miles > 0:
        ifta.mpg = Decimal(str(ifta.total_miles)) / ifta.tax_paid_gallons
    else:
        ifta.mpg = None

    await db.commit()
    await db.refresh(ifta)

    # Reload with relationships
    query = select(IFTA).where(IFTA.id == ifta.id).options(selectinload(IFTA.truck))
    result = await db.execute(query)
    return result.scalar_one()


@router.delete("/{ifta_id}")
async def delete_ifta_entry(
    ifta_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete an IFTA entry."""
    query = select(IFTA).where(
        IFTA.id == ifta_id,
        IFTA.company_id == current_user.company_id
    )
    result = await db.execute(query)
    ifta = result.scalar_one_or_none()
    if not ifta:
        raise HTTPException(status_code=404, detail="IFTA entry not found")

    await db.delete(ifta)
    await db.commit()
    return {"message": "IFTA entry deleted successfully"}
