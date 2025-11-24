from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.driver_payroll_settings import DriverPayrollSettings
from app.schemas.driver_payroll_settings import (
    DriverPayrollSettingsCreate,
    DriverPayrollSettingsUpdate,
    DriverPayrollSettingsResponse
)
from app.core.security import get_current_active_user
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=List[DriverPayrollSettingsResponse])
async def get_all_driver_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get payroll settings for all drivers in the company."""
    try:
        query = select(DriverPayrollSettings).where(
            DriverPayrollSettings.company_id == current_user.company_id
        )
        result = await db.execute(query)
        settings = result.scalars().all()
        return settings
    except Exception as e:
        # If table doesn't exist, return empty list
        if "does not exist" in str(e):
            return []
        raise


@router.get("/{driver_id}", response_model=DriverPayrollSettingsResponse)
async def get_driver_settings(
    driver_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get payroll settings for a specific driver."""
    try:
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
    except Exception as e:
        # If table doesn't exist, return default settings
        if "does not exist" in str(e):
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
        raise


@router.post("/", response_model=DriverPayrollSettingsResponse)
async def create_or_update_driver_settings(
    settings: DriverPayrollSettingsCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create or update payroll settings for a driver."""
    try:
        # Check if settings already exist
        query = select(DriverPayrollSettings).where(
            DriverPayrollSettings.driver_id == settings.driver_id,
            DriverPayrollSettings.company_id == current_user.company_id
        )
        result = await db.execute(query)
        existing_settings = result.scalar_one_or_none()

        if existing_settings:
            # Update existing settings
            for field, value in settings.dict(exclude={'driver_id'}).items():
                setattr(existing_settings, field, value)
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
            await db.commit()
            await db.refresh(db_settings)
            return db_settings
    except Exception as e:
        # If table doesn't exist, raise error
        if "does not exist" in str(e):
            raise HTTPException(
                status_code=503,
                detail="Driver payroll settings feature is not yet enabled. Please contact support."
            )
        raise


@router.put("/{driver_id}", response_model=DriverPayrollSettingsResponse)
async def update_driver_settings(
    driver_id: int,
    settings_update: DriverPayrollSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update payroll settings for a driver."""
    try:
        query = select(DriverPayrollSettings).where(
            DriverPayrollSettings.driver_id == driver_id,
            DriverPayrollSettings.company_id == current_user.company_id
        )
        result = await db.execute(query)
        settings = result.scalar_one_or_none()

        if not settings:
            raise HTTPException(status_code=404, detail="Driver settings not found")

        for field, value in settings_update.dict(exclude_unset=True).items():
            setattr(settings, field, value)

        await db.commit()
        await db.refresh(settings)
        return settings
    except HTTPException:
        raise
    except Exception as e:
        # If table doesn't exist, raise error
        if "does not exist" in str(e):
            raise HTTPException(
                status_code=503,
                detail="Driver payroll settings feature is not yet enabled. Please contact support."
            )
        raise
