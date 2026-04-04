from pydantic import BaseModel
from datetime import datetime, date
from typing import Optional, List
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


class LoadDetail(BaseModel):
    load_number: str
    pickup_date: Optional[str] = None
    miles: int
    carrier_rate: float
    adjustment_type: Optional[str] = None
    adjustment_amount: float = 0.0


class CalculatedPayrollResponse(BaseModel):
    driver_id: int
    driver_name: str
    week_number: int
    week_start: str
    week_end: str
    gross: float
    extra: float
    dispatch_fee: float
    insurance: float
    fuel: float = 0.0
    parking: float
    trailer: float
    misc: float
    adjustments: float  # Sum of all load adjustments (positive = bonuses, negative = deductions)
    miles: int
    check_amount: float
    load_count: int
    loads: List[LoadDetail]
