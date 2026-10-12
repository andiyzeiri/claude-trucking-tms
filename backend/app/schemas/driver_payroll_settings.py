from pydantic import BaseModel, Field
from typing import Literal, Optional
from datetime import datetime

PayStructure = Literal["fixed", "per_mile", "percent"]


class DriverPayrollSettingsBase(BaseModel):
    truck_id: Optional[int] = None
    pay_type: Optional[str] = 'flat'
    pay_rate: Optional[float] = 0
    dispatch_fee_percent: float = 0
    insurance_weekly: float = 0
    parking_weekly: float = 0
    trailer_weekly: float = 0
    misc_weekly: float = 0
    pay_structure: Optional[PayStructure] = None
    pay_fixed: Optional[float] = Field(None, ge=0)
    pay_per_mile: Optional[float] = Field(None, ge=0)
    pay_percent: Optional[float] = Field(None, ge=0, le=100)


class DriverPayrollSettingsCreate(DriverPayrollSettingsBase):
    driver_id: int


class DriverPayrollSettingsUpdate(BaseModel):
    truck_id: Optional[int] = None
    pay_type: Optional[str] = None
    pay_rate: Optional[float] = None
    dispatch_fee_percent: Optional[float] = None
    insurance_weekly: Optional[float] = None
    parking_weekly: Optional[float] = None
    trailer_weekly: Optional[float] = None
    misc_weekly: Optional[float] = None
    pay_structure: Optional[PayStructure] = None
    pay_fixed: Optional[float] = Field(None, ge=0)
    pay_per_mile: Optional[float] = Field(None, ge=0)
    pay_percent: Optional[float] = Field(None, ge=0, le=100)


class DriverPayrollSettingsResponse(DriverPayrollSettingsBase):
    id: int
    driver_id: int
    company_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
