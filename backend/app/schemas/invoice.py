from pydantic import BaseModel
from datetime import datetime
from decimal import Decimal
from typing import Optional
from app.models.invoice import InvoiceStatus


class InvoiceBase(BaseModel):
    invoice_number: str
    issue_date: datetime
    due_date: datetime
    status: InvoiceStatus = InvoiceStatus.DRAFT
    subtotal: Decimal
    tax_amount: Decimal = Decimal(0)
    total_amount: Decimal
    amount_paid: Decimal = Decimal(0)
    payment_date: Optional[datetime] = None
    payment_method: Optional[str] = None
    payment_reference: Optional[str] = None
    notes: Optional[str] = None
    terms: Optional[str] = None
    load_id: int


class InvoiceCreate(InvoiceBase):
    pass


class InvoiceUpdate(BaseModel):
    invoice_number: Optional[str] = None
    issue_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    status: Optional[InvoiceStatus] = None
    subtotal: Optional[Decimal] = None
    tax_amount: Optional[Decimal] = None
    total_amount: Optional[Decimal] = None
    amount_paid: Optional[Decimal] = None
    payment_date: Optional[datetime] = None
    payment_method: Optional[str] = None
    payment_reference: Optional[str] = None
    notes: Optional[str] = None
    terms: Optional[str] = None
    load_id: Optional[int] = None


class InvoiceResponse(InvoiceBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
