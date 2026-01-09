from pydantic import BaseModel
from datetime import datetime, date
from typing import Optional, Literal
from app.models.driver import DriverStatus


class DriverBase(BaseModel):
    first_name: str
    last_name: str
    license_number: str
    license_expiry: Optional[date] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    status: DriverStatus = DriverStatus.OFF_DUTY
    driver_type: Literal["company", "owner_operator"] = "company"
    # Employment dates
    date_hired: Optional[date] = None
    date_terminated: Optional[date] = None
    # Additional info
    date_of_birth: Optional[date] = None
    experience: Optional[str] = None
    mvr_expiry: Optional[date] = None
    medical_card_expiry: Optional[date] = None
    # Fuel card
    has_fuel_card: bool = False
    fuel_card_number: Optional[str] = None


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
    driver_type: Optional[Literal["company", "owner_operator"]] = None
    # Employment dates
    date_hired: Optional[date] = None
    date_terminated: Optional[date] = None
    # Additional info
    date_of_birth: Optional[date] = None
    experience: Optional[str] = None
    mvr_expiry: Optional[date] = None
    medical_card_expiry: Optional[date] = None
    # Fuel card
    has_fuel_card: Optional[bool] = None
    fuel_card_number: Optional[str] = None


class DriverResponse(DriverBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    company_id: int

    class Config:
        from_attributes = True
