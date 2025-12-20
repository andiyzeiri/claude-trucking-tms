from pydantic import BaseModel
from datetime import datetime, time
from typing import Optional
from decimal import Decimal


class DedicatedLaneBase(BaseModel):
    name: str
    pickup_location: str
    delivery_location: str
    miles: Optional[int] = None
    day_of_week: int = 0  # 0=Monday, 6=Sunday
    pickup_time: Optional[time] = None
    delivery_time: Optional[time] = None
    rate: Optional[Decimal] = None
    carrier_rate: Optional[Decimal] = None
    fuel_surcharge: Optional[Decimal] = Decimal("0")
    accessorial_charges: Optional[Decimal] = Decimal("0")
    pickup_notes: Optional[str] = None
    delivery_notes: Optional[str] = None
    reference_number: Optional[str] = None
    is_active: bool = True
    customer_id: int
    driver_id: Optional[int] = None
    truck_id: Optional[int] = None


class DedicatedLaneCreate(DedicatedLaneBase):
    pass


class DedicatedLaneUpdate(BaseModel):
    name: Optional[str] = None
    pickup_location: Optional[str] = None
    delivery_location: Optional[str] = None
    miles: Optional[int] = None
    day_of_week: Optional[int] = None
    pickup_time: Optional[time] = None
    delivery_time: Optional[time] = None
    rate: Optional[Decimal] = None
    carrier_rate: Optional[Decimal] = None
    fuel_surcharge: Optional[Decimal] = None
    accessorial_charges: Optional[Decimal] = None
    pickup_notes: Optional[str] = None
    delivery_notes: Optional[str] = None
    reference_number: Optional[str] = None
    is_active: Optional[bool] = None
    customer_id: Optional[int] = None
    driver_id: Optional[int] = None
    truck_id: Optional[int] = None


class CustomerInfo(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class DriverInfo(BaseModel):
    id: int
    first_name: str
    last_name: str

    class Config:
        from_attributes = True


class TruckInfo(BaseModel):
    id: int
    unit_number: str

    class Config:
        from_attributes = True


class DedicatedLaneResponse(DedicatedLaneBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    company_id: int
    route: str
    day_name: str
    customer: Optional[CustomerInfo] = None
    driver: Optional[DriverInfo] = None
    truck: Optional[TruckInfo] = None

    class Config:
        from_attributes = True
