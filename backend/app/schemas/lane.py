from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class LaneBase(BaseModel):
    pickup_location: str
    delivery_location: str
    broker: str
    email: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None


class LaneCreate(LaneBase):
    pass


class LaneUpdate(BaseModel):
    pickup_location: Optional[str] = None
    delivery_location: Optional[str] = None
    broker: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None


class LaneResponse(LaneBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    company_id: int
    route: str

    class Config:
        from_attributes = True
