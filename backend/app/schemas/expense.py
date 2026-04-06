from pydantic import BaseModel, ConfigDict
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, Union, Any
from app.schemas.driver import DriverResponse
from app.schemas.truck import TruckResponse


class ExpenseBase(BaseModel):
    date: date
    category: str
    cost_type: str = 'variable'
    expense_group: str = 'company'
    description: Optional[str] = None
    amount: Decimal
    vendor: Optional[str] = None
    payment_method: Optional[str] = None
    receipt_number: Optional[str] = None
    driver_id: Optional[int] = None
    truck_id: Optional[int] = None
    load_id: Optional[int] = None
    frequency: Optional[str] = None
    pay_day: Optional[int] = None
    is_template: bool = False
    template_id: Optional[int] = None


class ExpenseCreate(ExpenseBase):
    pass


class ExpenseUpdate(BaseModel):
    model_config = ConfigDict(extra='forbid')

    date: Any = None
    category: Any = None
    cost_type: Any = None
    expense_group: Any = None
    description: Any = None
    amount: Any = None
    vendor: Any = None
    payment_method: Any = None
    receipt_number: Any = None
    driver_id: Any = None
    truck_id: Any = None
    load_id: Any = None
    frequency: Any = None
    pay_day: Any = None
    is_template: Any = None
    template_id: Optional[int] = None


class ExpenseResponse(ExpenseBase):
    id: int
    company_id: int
    frequency: Optional[str] = None
    pay_day: Optional[int] = None
    is_template: bool = False
    template_id: Optional[int] = None
    driver: Optional[DriverResponse] = None
    truck: Optional[TruckResponse] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
