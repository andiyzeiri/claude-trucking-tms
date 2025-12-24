from pydantic import BaseModel
from datetime import datetime
from decimal import Decimal
from typing import Optional
from app.schemas.truck import TruckResponse


class IFTABase(BaseModel):
    year: int
    quarter: int  # 1-4
    jurisdiction: str  # State/province code (TX, CA, ON, etc.)
    total_miles: int = 0
    taxable_miles: int = 0
    tax_paid_gallons: Decimal = Decimal("0")
    mpg: Optional[Decimal] = None
    notes: Optional[str] = None
    truck_id: Optional[int] = None


class IFTACreate(IFTABase):
    pass


class IFTAUpdate(BaseModel):
    year: Optional[int] = None
    quarter: Optional[int] = None
    jurisdiction: Optional[str] = None
    total_miles: Optional[int] = None
    taxable_miles: Optional[int] = None
    tax_paid_gallons: Optional[Decimal] = None
    mpg: Optional[Decimal] = None
    notes: Optional[str] = None
    truck_id: Optional[int] = None


class IFTAResponse(BaseModel):
    id: int
    year: int
    quarter: int
    jurisdiction: str
    total_miles: int
    taxable_miles: int
    tax_paid_gallons: Decimal
    mpg: Optional[Decimal] = None
    notes: Optional[str] = None
    truck_id: Optional[int] = None
    truck: Optional[TruckResponse] = None
    company_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class IFTASummary(BaseModel):
    """Summary of IFTA data for a quarter."""
    year: int
    quarter: int
    total_miles: int
    total_taxable_miles: int
    total_gallons: Decimal
    overall_mpg: Optional[Decimal] = None
    jurisdiction_count: int
