from pydantic import BaseModel, ConfigDict
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, Union
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
    date: Union[date, None] = None
    category: Union[str, None] = None
    cost_type: Union[str, None] = None
    expense_group: Union[str, None] = None
    description: Union[str, None] = None
    amount: Union[Decimal, None] = None
    vendor: Union[str, None] = None
    payment_method: Union[str, None] = None
    receipt_number: Union[str, None] = None
    driver_id: Union[int, None] = None
    truck_id: Union[int, None] = None
    load_id: Union[int, None] = None
    frequency: Union[str, None] = None
    pay_day: Union[int, None] = None
    is_template: Union[bool, None] = None
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
