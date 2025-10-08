from pydantic import BaseModel, ConfigDict
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from app.schemas.driver import DriverResponse
from app.schemas.truck import TruckResponse


class ExpenseBase(BaseModel):
    date: date
    category: str
    description: Optional[str] = None
    amount: Decimal
    vendor: Optional[str] = None
    payment_method: Optional[str] = None
    receipt_number: Optional[str] = None
    driver_id: Optional[int] = None
    truck_id: Optional[int] = None
    load_id: Optional[int] = None


class ExpenseCreate(ExpenseBase):
    pass


class ExpenseUpdate(BaseModel):
    date: Optional[date] = None
    category: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[Decimal] = None
    vendor: Optional[str] = None
    payment_method: Optional[str] = None
    receipt_number: Optional[str] = None
    driver_id: Optional[int] = None
    truck_id: Optional[int] = None
    load_id: Optional[int] = None


class ExpenseResponse(ExpenseBase):
    id: int
    company_id: int
    driver: Optional[DriverResponse] = None
    truck: Optional[TruckResponse] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
