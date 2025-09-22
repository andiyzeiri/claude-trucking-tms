from pydantic import BaseModel
from datetime import datetime
from decimal import Decimal
from typing import Optional
from app.models.load import LoadStatus


class LoadBase(BaseModel):
    load_number: str
    reference_number: Optional[str] = None
    description: Optional[str] = None
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


class LoadCreate(LoadBase):
    pass


class LoadUpdate(BaseModel):
    load_number: Optional[str] = None
    reference_number: Optional[str] = None
    description: Optional[str] = None
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


class LoadResponse(LoadBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    company_id: int

    class Config:
        from_attributes = True