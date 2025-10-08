from pydantic import BaseModel
from datetime import datetime, date
from typing import Optional
from app.models.payroll import PayrollType


class PayrollBase(BaseModel):
    week_start: date
    week_end: date
    driver_id: int
    type: PayrollType
    gross: float = 0.0
    extra: float = 0.0
    dispatch_fee: float = 0.0
    insurance: float = 0.0
    fuel: float = 0.0
    parking: float = 0.0
    trailer: float = 0.0
    misc: float = 0.0
    escrow: float = 0.0
    miles: int = 0


class PayrollCreate(PayrollBase):
    pass


class PayrollUpdate(BaseModel):
    week_start: Optional[date] = None
    week_end: Optional[date] = None
    driver_id: Optional[int] = None
    type: Optional[PayrollType] = None
    gross: Optional[float] = None
    extra: Optional[float] = None
    dispatch_fee: Optional[float] = None
    insurance: Optional[float] = None
    fuel: Optional[float] = None
    parking: Optional[float] = None
    trailer: Optional[float] = None
    misc: Optional[float] = None
    escrow: Optional[float] = None
    miles: Optional[int] = None


class PayrollResponse(PayrollBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    company_id: int
    check_amount: float
    rpm: float
    week_label: str

    class Config:
        from_attributes = True
