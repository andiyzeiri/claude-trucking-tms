from pydantic import BaseModel
from datetime import date
from decimal import Decimal
from typing import Optional
from app.schemas.driver import DriverResponse
from app.schemas.truck import TruckResponse


class FuelBase(BaseModel):
    date: date
    location: Optional[str] = None
    gallons: Decimal
    price_per_gallon: Optional[Decimal] = None
    total_amount: Decimal
    odometer: Optional[int] = None
    notes: Optional[str] = None
    driver_id: Optional[int] = None
    truck_id: Optional[int] = None
    load_id: Optional[int] = None


class FuelCreate(FuelBase):
    pass


class FuelUpdate(BaseModel):
    date: Optional[date] = None
    location: Optional[str] = None
    gallons: Optional[Decimal] = None
    price_per_gallon: Optional[Decimal] = None
    total_amount: Optional[Decimal] = None
    odometer: Optional[int] = None
    notes: Optional[str] = None
    driver_id: Optional[int] = None
    truck_id: Optional[int] = None
    load_id: Optional[int] = None


class FuelResponse(BaseModel):
    id: int
    date: date
    location: Optional[str] = None
    gallons: Decimal
    price_per_gallon: Optional[Decimal] = None
    total_amount: Decimal
    odometer: Optional[int] = None
    notes: Optional[str] = None
    driver_id: Optional[int] = None
    driver: Optional[DriverResponse] = None
    truck_id: Optional[int] = None
    truck: Optional[TruckResponse] = None
    load_id: Optional[int] = None
    company_id: int
    created_at: date
    updated_at: Optional[date] = None

    class Config:
        from_attributes = True
