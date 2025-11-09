from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class DriverPayrollSettingsBase(BaseModel):
    dispatch_fee_percent: float = 0
    insurance_weekly: float = 0
    parking_weekly: float = 0
    trailer_weekly: float = 0
    misc_weekly: float = 0


class DriverPayrollSettingsCreate(DriverPayrollSettingsBase):
    driver_id: int


class DriverPayrollSettingsUpdate(BaseModel):
    dispatch_fee_percent: Optional[float] = None
    insurance_weekly: Optional[float] = None
    parking_weekly: Optional[float] = None
    trailer_weekly: Optional[float] = None
    misc_weekly: Optional[float] = None


class DriverPayrollSettingsResponse(DriverPayrollSettingsBase):
    id: int
    driver_id: int
    company_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
