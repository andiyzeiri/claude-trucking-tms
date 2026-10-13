from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional
from decimal import Decimal
from app.models.truck import TruckOwnership, TruckStatus, TruckType


class TruckBase(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    type: TruckType = TruckType.TRUCK
    truck_number: str
    vin: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    license_plate: Optional[str] = None
    status: TruckStatus = TruckStatus.AVAILABLE
    ownership: TruckOwnership = TruckOwnership.COMPANY
    current_driver_id: Optional[int] = None
    value: Optional[Decimal] = None
    cargo_insurance: Optional[Decimal] = None
    liability_insurance: Optional[Decimal] = None
    physical_damage_insurance: Optional[Decimal] = None
    miles: Optional[int] = None
    mpg: Optional[Decimal] = None
    own_fuel_card: bool = False


class TruckCreate(TruckBase):
    pass


class TruckUpdate(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    type: Optional[TruckType] = None
    truck_number: Optional[str] = None
    vin: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    license_plate: Optional[str] = None
    status: Optional[TruckStatus] = None
    ownership: Optional[TruckOwnership] = None
    current_driver_id: Optional[int] = None
    value: Optional[Decimal] = None
    cargo_insurance: Optional[Decimal] = None
    liability_insurance: Optional[Decimal] = None
    physical_damage_insurance: Optional[Decimal] = None
    miles: Optional[int] = None
    mpg: Optional[Decimal] = None
    own_fuel_card: Optional[bool] = None


class TruckResponse(TruckBase):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    id: int
    odometer_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    company_id: int
