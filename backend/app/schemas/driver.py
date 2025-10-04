from pydantic import BaseModel
from datetime import datetime, date
from typing import Optional
from app.models.driver import DriverStatus


class DriverBase(BaseModel):
    first_name: str
    last_name: str
    license_number: str
    license_expiry: Optional[date] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    status: DriverStatus = DriverStatus.OFF_DUTY


class DriverCreate(DriverBase):
    pass


class DriverUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    license_number: Optional[str] = None
    license_expiry: Optional[date] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    status: Optional[DriverStatus] = None


class DriverResponse(DriverBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    company_id: int

    class Config:
        from_attributes = True
