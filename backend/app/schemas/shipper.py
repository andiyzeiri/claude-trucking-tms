from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class ShipperBase(BaseModel):
    name: str
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    phone: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    product_type: Optional[str] = None
    average_wait_time: Optional[str] = None
    appointment_type: Optional[str] = None
    notes: Optional[str] = None


class ShipperCreate(ShipperBase):
    pass


class ShipperUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    phone: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    product_type: Optional[str] = None
    average_wait_time: Optional[str] = None
    appointment_type: Optional[str] = None
    notes: Optional[str] = None


class ShipperResponse(ShipperBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    company_id: int

    class Config:
        from_attributes = True
