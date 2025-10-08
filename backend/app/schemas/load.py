from pydantic import BaseModel
from datetime import datetime
from decimal import Decimal
from typing import Optional
from app.models.load import LoadStatus
from app.schemas.driver import DriverResponse
from app.schemas.truck import TruckResponse


class LoadBase(BaseModel):
    load_number: str
    reference_number: Optional[str] = None
    description: Optional[str] = None
    pickup_location: Optional[str] = None
    delivery_location: Optional[str] = None
    miles: Optional[int] = None
    rate: Optional[Decimal] = None
    fuel_surcharge: Optional[Decimal] = None
    accessorial_charges: Optional[Decimal] = None
    total_amount: Optional[Decimal] = None
    pickup_date: Optional[datetime] = None
    delivery_date: Optional[datetime] = None
    pickup_deadline: Optional[datetime] = None
    delivery_deadline: Optional[datetime] = None
    status: LoadStatus = LoadStatus.PENDING
    customer_id: int
    truck_id: Optional[int] = None
    driver_id: Optional[int] = None
    pod_url: Optional[str] = None
    ratecon_url: Optional[str] = None


class LoadCreate(LoadBase):
    pass


class LoadUpdate(BaseModel):
    load_number: Optional[str] = None
    reference_number: Optional[str] = None
    description: Optional[str] = None
    pickup_location: Optional[str] = None
    delivery_location: Optional[str] = None
    miles: Optional[int] = None
    rate: Optional[Decimal] = None
    fuel_surcharge: Optional[Decimal] = None
    accessorial_charges: Optional[Decimal] = None
    total_amount: Optional[Decimal] = None
    pickup_date: Optional[datetime] = None
    delivery_date: Optional[datetime] = None
    pickup_deadline: Optional[datetime] = None
    delivery_deadline: Optional[datetime] = None
    status: Optional[LoadStatus] = None
    customer_id: Optional[int] = None
    truck_id: Optional[int] = None
    driver_id: Optional[int] = None
    pod_url: Optional[str] = None
    ratecon_url: Optional[str] = None


class LoadResponse(BaseModel):
    id: int
    load_number: str
    reference_number: Optional[str] = None
    description: Optional[str] = None
    pickup_location: Optional[str] = None
    delivery_location: Optional[str] = None
    miles: Optional[int] = None
    rate: Optional[Decimal] = None
    fuel_surcharge: Optional[Decimal] = None
    accessorial_charges: Optional[Decimal] = None
    total_amount: Optional[Decimal] = None
    pickup_date: Optional[datetime] = None
    delivery_date: Optional[datetime] = None
    pickup_deadline: Optional[datetime] = None
    delivery_deadline: Optional[datetime] = None
    status: LoadStatus = LoadStatus.PENDING
    customer_id: int
    truck_id: Optional[int] = None
    driver_id: Optional[int] = None
    pod_url: Optional[str] = None
    ratecon_url: Optional[str] = None
    driver: Optional[DriverResponse] = None
    truck: Optional[TruckResponse] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    company_id: int

    class Config:
        from_attributes = True