from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timedelta
from app.database import get_db
from app.models.payroll import Payroll
from app.models.load import Load
from app.models.driver import Driver
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


def get_week_number(date: datetime) -> int:
    """Get ISO week number from a date."""
    return date.isocalendar()[1]


def get_week_start_end(date: datetime) -> tuple:
    """Get the Monday and Sunday of the week containing the given date."""
    # Get the day of the week (0=Monday, 6=Sunday)
    day_of_week = date.weekday()

    # Calculate the Monday of this week
    monday = date - timedelta(days=day_of_week)

    # Calculate the Sunday of this week
    sunday = monday + timedelta(days=6)

    return monday.date(), sunday.date()


@router.get("/calculate-from-loads", response_model=List[Dict[str, Any]])
async def calculate_payroll_from_loads(
    year: int = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Calculate payroll data from loads, grouped by driver and week.
    Aggregates miles and gross pay (carrier_rate) from completed loads.
    """
    # Default to current year if not specified
    if year is None:
        year = datetime.now().year

    # Get all loads for the company with driver information
    query = (
        select(Load)
        .where(
            Load.company_id == current_user.company_id,
            Load.driver_id.isnot(None),  # Only loads with assigned drivers
            Load.pickup_date.isnot(None)
        )
        .options(
            # Load driver relationship for access to driver info
        )
    )

    result = await db.execute(query)
    loads = result.scalars().all()

    # Get driver information
    drivers_query = select(Driver).where(Driver.company_id == current_user.company_id)
    drivers_result = await db.execute(drivers_query)
    drivers = {driver.id: driver for driver in drivers_result.scalars().all()}

    # Group loads by driver and week
    payroll_data = {}

    for load in loads:
        if not load.pickup_date:
            continue

        # Get week information
        week_num = get_week_number(load.pickup_date)
        week_start, week_end = get_week_start_end(load.pickup_date)

        # Only include loads from the specified year
        if load.pickup_date.year != year:
            continue

        # Create unique key for driver + week
        key = f"{load.driver_id}_{week_num}"

        if key not in payroll_data:
            driver = drivers.get(load.driver_id)
            driver_name = f"{driver.first_name} {driver.last_name}" if driver else "Unknown Driver"

            payroll_data[key] = {
                "driver_id": load.driver_id,
                "driver_name": driver_name,
                "week_number": week_num,
                "week_start": week_start.isoformat(),
                "week_end": week_end.isoformat(),
                "gross": 0.0,
                "miles": 0,
                "load_count": 0,
                "loads": []
            }

        # Add load data to aggregated totals
        # Use carrier_rate as the driver's gross pay (what the driver receives)
        gross_amount = float(load.carrier_rate) if load.carrier_rate else 0.0
        miles_amount = load.miles if load.miles else 0

        payroll_data[key]["gross"] += gross_amount
        payroll_data[key]["miles"] += miles_amount
        payroll_data[key]["load_count"] += 1
        payroll_data[key]["loads"].append({
            "load_number": load.load_number,
            "pickup_date": load.pickup_date.isoformat() if load.pickup_date else None,
            "miles": miles_amount,
            "carrier_rate": gross_amount
        })

    # Convert to list and sort by driver name and week
    result_list = sorted(
        payroll_data.values(),
        key=lambda x: (x["driver_name"], x["week_number"])
    )

    return result_list
