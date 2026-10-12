from typing import Dict, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.driver_payroll_settings import DriverPayRateVersion, DriverPayrollSettings
from app.services import pay_rates
from app.schemas.driver_payroll_settings import (
    DriverPayrollSettingsCreate,
    DriverPayrollSettingsUpdate,
    DriverPayrollSettingsResponse
)
from app.core.security import get_current_active_user
from app.models.user import User

router = APIRouter()


@router.get("/rate-versions")
async def get_rate_versions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> Dict[int, List[dict]]:
    """Each driver's dated pay rates, oldest first: {driver_id: [{effective_from, ...rates}]}.

    A pay week uses the latest version dated on or before its Sunday; drivers
    with none use their current settings for every week.
    """
    rows = (await db.execute(
        select(DriverPayRateVersion).where(DriverPayRateVersion.company_id == current_user.company_id)
        .order_by(DriverPayRateVersion.driver_id, DriverPayRateVersion.effective_from)
    )).scalars()
    out: Dict[int, List[dict]] = {}
    for v in rows:
        out.setdefault(v.driver_id, []).append({"effective_from": v.effective_from.isoformat(), **v.values})
    return out


@router.get("/", response_model=List[DriverPayrollSettingsResponse])
async def get_all_driver_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get payroll settings for all drivers in the company."""
    query = select(DriverPayrollSettings).where(
        DriverPayrollSettings.company_id == current_user.company_id
    )
    result = await db.execute(query)
    settings = result.scalars().all()
    return settings


@router.get("/{driver_id}", response_model=DriverPayrollSettingsResponse)
async def get_driver_settings(
    driver_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get payroll settings for a specific driver."""
    query = select(DriverPayrollSettings).where(
        DriverPayrollSettings.driver_id == driver_id,
        DriverPayrollSettings.company_id == current_user.company_id
    )
    result = await db.execute(query)
    settings = result.scalar_one_or_none()

    if not settings:
        # Return default settings if not found
        return DriverPayrollSettingsResponse(
            id=0,
            driver_id=driver_id,
            company_id=current_user.company_id,
            dispatch_fee_percent=0,
            insurance_weekly=0,
            parking_weekly=0,
            trailer_weekly=0,
            misc_weekly=0,
            created_at=None,
            updated_at=None
        )

    return settings


@router.post("/", response_model=DriverPayrollSettingsResponse)
async def create_or_update_driver_settings(
    settings: DriverPayrollSettingsCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create or update payroll settings for a driver."""
    # Check if settings already exist
    query = select(DriverPayrollSettings).where(
        DriverPayrollSettings.driver_id == settings.driver_id,
        DriverPayrollSettings.company_id == current_user.company_id
    )
    result = await db.execute(query)
    existing_settings = result.scalar_one_or_none()

    if existing_settings:
        # Update existing settings
        # Only what was sent, so saving one setting never resets the others.
        before = pay_rates.snapshot(existing_settings)
        for field, value in settings.dict(exclude={'driver_id'}, exclude_unset=True).items():
            setattr(existing_settings, field, value)
        # A changed rate applies from this week on; earlier weeks keep the old one.
        await pay_rates.record_change(db, current_user.company_id, settings.driver_id, before,
                                      pay_rates.snapshot(existing_settings), current_user.id)
        await db.commit()
        await db.refresh(existing_settings)
        return existing_settings
    else:
        # Create new settings
        db_settings = DriverPayrollSettings(
            **settings.dict(),
            company_id=current_user.company_id
        )
        db.add(db_settings)
        await pay_rates.record_change(db, current_user.company_id, settings.driver_id, pay_rates.snapshot(None),
                                      pay_rates.snapshot(db_settings), current_user.id)
        await db.commit()
        await db.refresh(db_settings)
        return db_settings


@router.put("/{driver_id}", response_model=DriverPayrollSettingsResponse)
async def update_driver_settings(
    driver_id: int,
    settings_update: DriverPayrollSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update payroll settings for a driver."""
    query = select(DriverPayrollSettings).where(
        DriverPayrollSettings.driver_id == driver_id,
        DriverPayrollSettings.company_id == current_user.company_id
    )
    result = await db.execute(query)
    settings = result.scalar_one_or_none()

    if not settings:
        raise HTTPException(status_code=404, detail="Driver settings not found")

    before = pay_rates.snapshot(settings)
    for field, value in settings_update.dict(exclude_unset=True).items():
        setattr(settings, field, value)
    # A changed rate applies from this week on; earlier weeks keep the old one.
    await pay_rates.record_change(db, current_user.company_id, driver_id, before, pay_rates.snapshot(settings), current_user.id)

    await db.commit()
    await db.refresh(settings)
    return settings
