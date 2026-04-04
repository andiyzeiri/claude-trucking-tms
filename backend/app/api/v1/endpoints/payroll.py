from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timedelta
from app.database import get_db
from app.models.payroll import Payroll
from app.models.load import Load
from app.models.driver import Driver
from app.models.driver_payroll_settings import DriverPayrollSettings
from app.models.fuel import Fuel
from app.models.payroll_override import PayrollOverride
from app.schemas.payroll import PayrollCreate, PayrollUpdate, PayrollResponse, CalculatedPayrollResponse
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


# Helper functions for payroll calculations
def get_week_number(date: datetime) -> int:
    """Get ISO week number from a date."""
    return date.isocalendar()[1]


def get_iso_week_year(date: datetime) -> int:
    """Get ISO week year from a date.

    Important: ISO week year can differ from calendar year at year boundaries.
    For example, Dec 30, 2025 is in ISO week 1 of 2026.
    """
    return date.isocalendar()[0]


def get_week_start_end(date: datetime) -> tuple:
    """Get the Monday and Sunday of the week containing the given date."""
    # Get the day of the week (0=Monday, 6=Sunday)
    day_of_week = date.weekday()

    # Calculate the Monday of this week
    monday = date - timedelta(days=day_of_week)

    # Calculate the Sunday of this week
    sunday = monday + timedelta(days=6)

    return monday.date(), sunday.date()


@router.get("/calculate-from-loads", response_model=List[CalculatedPayrollResponse])
async def calculate_payroll_from_loads(
    year: int = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Calculate payroll data from loads, grouped by driver and week.
    Aggregates miles and gross pay (rate) from completed loads.
    Uses ISO week numbering that can span year boundaries.
    """
    # Default to current year if not specified
    if year is None:
        year = datetime.now().year

    print(f"🔍 Calculating payroll for year: {year}")

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

    print(f"📦 Total loads found: {len(loads)}")

    # Get driver information
    drivers_query = select(Driver).where(Driver.company_id == current_user.company_id)
    drivers_result = await db.execute(drivers_query)
    drivers = {driver.id: driver for driver in drivers_result.scalars().all()}

    # Get driver payroll settings
    settings_query = select(DriverPayrollSettings).where(DriverPayrollSettings.company_id == current_user.company_id)
    settings_result = await db.execute(settings_query)
    driver_settings = {setting.driver_id: setting for setting in settings_result.scalars().all()}

    # Group loads by driver and week
    payroll_data = {}
    loads_processed = 0
    loads_filtered_by_year = 0

    for load in loads:
        if not load.pickup_date:
            continue

        # Get week information using ISO week year (handles year boundary correctly)
        week_num = get_week_number(load.pickup_date)
        iso_year = get_iso_week_year(load.pickup_date)
        week_start, week_end = get_week_start_end(load.pickup_date)

        # Filter by ISO year (not calendar year) to handle year boundaries correctly
        # e.g., Dec 30, 2025 is in week 1 of ISO year 2026
        if iso_year != year:
            loads_filtered_by_year += 1
            continue

        loads_processed += 1
        if loads_processed <= 3:  # Log first 3 loads for debugging
            print(f"  Load {load.id}: pickup={load.pickup_date}, iso_year={iso_year}, week={week_num}, week_start={week_start}, rate={load.rate}, miles={load.miles}")

        # Create unique key for driver + year + week (year needed to distinguish between years)
        key = f"{load.driver_id}_{iso_year}_{week_num}"

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
                "loads": [],
                "adjustments": 0.0,  # Total adjustments from load details
                "fuel": 0.0,  # Will be populated from fuel entries
                "truck_id": None
            }

        # Add load data to aggregated totals
        # Use rate as the driver's gross pay
        gross_amount = float(load.rate) if load.rate else 0.0
        miles_amount = load.miles if load.miles else 0
        raw_adjustment = float(load.adjustment_amount) if load.adjustment_amount else 0.0

        # Use the adjustment amount as-is (respect the sign from the load)
        # Positive = adds to pay, Negative = deducts from pay
        adjustment_type = load.adjustment_type.value if load.adjustment_type else None
        adjustment_amount = raw_adjustment

        payroll_data[key]["gross"] += gross_amount + adjustment_amount  # Gross = rate + adjustments
        payroll_data[key]["miles"] += miles_amount
        payroll_data[key]["adjustments"] += adjustment_amount  # Track adjustments separately for reference
        payroll_data[key]["load_count"] += 1
        payroll_data[key]["loads"].append({
            "load_number": load.load_number,
            "pickup_date": load.pickup_date.isoformat() if load.pickup_date else None,
            "miles": miles_amount,
            "carrier_rate": gross_amount,  # Using rate field for payroll
            "adjustment_type": adjustment_type,
            "adjustment_amount": adjustment_amount
        })

    # Aggregate fuel data using assigned truck_id from driver payroll settings
    # Step 1: Get all fuel entries for the company
    fuel_query = select(Fuel).where(
        Fuel.company_id == current_user.company_id,
        Fuel.date.isnot(None)
    )
    fuel_result = await db.execute(fuel_query)
    fuel_entries = fuel_result.scalars().all()

    # Step 2: Aggregate fuel by truck+week
    fuel_by_truck_week = {}  # {(truck_id, iso_year, week_num): total}
    for fe in fuel_entries:
        if not fe.date or not fe.truck_id:
            continue
        fe_week = get_week_number(fe.date)
        fe_year = get_iso_week_year(fe.date)
        if fe_year != year:
            continue
        ftw_key = (fe.truck_id, fe_year, fe_week)
        fuel_amount = float(fe.total_amount) if fe.total_amount else 0.0
        def_amount = float(fe.def_price) if fe.def_price else 0.0
        fuel_by_truck_week[ftw_key] = fuel_by_truck_week.get(ftw_key, 0.0) + fuel_amount + def_amount

    # Step 3: Get per-week truck_id overrides from payroll_overrides
    override_query = select(PayrollOverride).where(
        PayrollOverride.company_id == current_user.company_id,
        PayrollOverride.year == year,
        PayrollOverride.field == "truck_id"
    )
    override_result = await db.execute(override_query)
    truck_overrides = {}  # {(driver_id, week_number): truck_id}
    for ov in override_result.scalars().all():
        truck_overrides[(ov.driver_id, ov.week_number)] = int(ov.value) if ov.value else None

    # Step 4: Map fuel costs to drivers via per-week override or default truck from settings
    for key, data in payroll_data.items():
        driver_id = data["driver_id"]
        wn = data["week_number"]
        settings = driver_settings.get(driver_id)

        # Per-week override takes priority over default
        override_truck = truck_overrides.get((driver_id, wn))
        default_truck = settings.truck_id if settings else None
        truck_id = override_truck if override_truck is not None else default_truck

        if truck_id:
            fuel_total = fuel_by_truck_week.get((truck_id, year, wn), 0.0)
            data["fuel"] = fuel_total
            data["truck_id"] = truck_id
        else:
            data["truck_id"] = default_truck

    # Apply driver settings and calculate deductions
    for key, data in payroll_data.items():
        driver_id = data["driver_id"]
        settings = driver_settings.get(driver_id)

        gross = data["gross"]

        # Calculate deductions based on driver settings
        if settings:
            dispatch_fee = gross * (float(settings.dispatch_fee_percent) / 100)
            insurance = float(settings.insurance_weekly)
            parking = float(settings.parking_weekly)
            trailer = float(settings.trailer_weekly)
            misc = float(settings.misc_weekly)
        else:
            dispatch_fee = 0
            insurance = 0
            parking = 0
            trailer = 0
            misc = 0

        # Add deduction fields to the data
        data["dispatch_fee"] = dispatch_fee
        data["insurance"] = insurance
        data["parking"] = parking
        data["trailer"] = trailer
        data["misc"] = misc
        data["extra"] = 0  # Can be manually added later

        # Calculate check amount: gross - deductions + extra
        # Adjustments are already included in gross (gross = rate + adjustments)
        fuel = data.get("fuel", 0.0)
        data["check_amount"] = gross - dispatch_fee - insurance - fuel - parking - trailer - misc + data["extra"]

    # Convert to list and sort by driver name and week
    result_list = sorted(
        payroll_data.values(),
        key=lambda x: (x["driver_name"], x["week_number"])
    )

    print(f"✅ Loads processed: {loads_processed}, Filtered by year: {loads_filtered_by_year}")
    print(f"📊 Payroll entries created: {len(result_list)}")

    return result_list


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
