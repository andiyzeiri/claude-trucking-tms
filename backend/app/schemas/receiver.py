from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class ReceiverBase(BaseModel):
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


class ReceiverCreate(ReceiverBase):
    pass


class ReceiverUpdate(BaseModel):
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


class ReceiverResponse(ReceiverBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    company_id: int

    class Config:
        from_attributes = True
