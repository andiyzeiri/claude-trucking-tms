from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class PayrollOverrideCreate(BaseModel):
    driver_id: int
    year: int
    week_number: int
    field: str
    value: float


class PayrollOverrideResponse(BaseModel):
    id: int
    driver_id: int
    company_id: int
    year: int
    week_number: int
    field: str
    value: float
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PayrollOverrideBulkRequest(BaseModel):
    overrides: List[PayrollOverrideCreate]
