from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.models.truck import TruckStatus, TruckType


class TruckBase(BaseModel):
    type: TruckType = TruckType.TRUCK
    truck_number: str
    vin: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    license_plate: Optional[str] = None
    status: TruckStatus = TruckStatus.AVAILABLE
    current_driver_id: Optional[int] = None


class TruckCreate(TruckBase):
    pass


class TruckUpdate(BaseModel):
    type: Optional[TruckType] = None
    truck_number: Optional[str] = None
    vin: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    license_plate: Optional[str] = None
    status: Optional[TruckStatus] = None
    current_driver_id: Optional[int] = None


class TruckResponse(TruckBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    company_id: int

    class Config:
        from_attributes = True
