from pydantic import BaseModel
from datetime import date as date_type, datetime
from decimal import Decimal
from typing import Optional, Union
from app.schemas.driver import DriverResponse
from app.schemas.truck import TruckResponse


class FuelBase(BaseModel):
    date: date_type
    location: Optional[str] = None
    gallons: Decimal
    price_per_gallon: Optional[Decimal] = None
    def_gallons: Optional[Decimal] = None
    def_price: Optional[Decimal] = None
    total_amount: Decimal
    odometer: Optional[int] = None
    notes: Optional[str] = None
    driver_id: Optional[int] = None
    truck_id: Optional[int] = None
    load_id: Optional[int] = None


class FuelCreate(FuelBase):
    pass


class FuelUpdate(BaseModel):
    date: Union[date_type, None] = None
    location: Union[str, None] = None
    gallons: Union[Decimal, None] = None
    price_per_gallon: Union[Decimal, None] = None
    def_gallons: Union[Decimal, None] = None
    def_price: Union[Decimal, None] = None
    total_amount: Union[Decimal, None] = None
    odometer: Union[int, None] = None
    notes: Union[str, None] = None
    driver_id: Union[int, None] = None
    truck_id: Union[int, None] = None
    load_id: Union[int, None] = None


class FuelResponse(BaseModel):
    id: int
    date: date_type
    location: Optional[str] = None
    gallons: Decimal
    price_per_gallon: Optional[Decimal] = None
    def_gallons: Optional[Decimal] = None
    def_price: Optional[Decimal] = None
    total_amount: Decimal
    odometer: Optional[int] = None
    notes: Optional[str] = None
    driver_id: Optional[int] = None
    driver: Optional[DriverResponse] = None
    truck_id: Optional[int] = None
    truck: Optional[TruckResponse] = None
    load_id: Optional[int] = None
    company_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
