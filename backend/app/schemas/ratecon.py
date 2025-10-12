"""
Ratecon Pydantic schemas
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime


class RateconBase(BaseModel):
    """Base Ratecon schema with common fields"""
    ratecon_number: str = Field(..., description="Unique rate confirmation number")
    load_number: Optional[str] = Field(None, description="Associated load number")
    broker_name: str = Field(..., description="Broker company name")
    carrier_name: Optional[str] = Field(None, description="Carrier company name")

    date_issued: Optional[date] = Field(None, description="Date ratecon was issued")
    pickup_date: Optional[date] = Field(None, description="Scheduled pickup date")
    delivery_date: Optional[date] = Field(None, description="Scheduled delivery date")

    pickup_location: Optional[str] = Field(None, description="Pickup address or location")
    delivery_location: Optional[str] = Field(None, description="Delivery address or location")

    total_rate: Optional[float] = Field(None, description="Total payment amount")
    fuel_surcharge: Optional[float] = Field(None, description="Fuel surcharge amount")
    detention_rate: Optional[float] = Field(None, description="Detention rate per hour")
    layover_rate: Optional[float] = Field(None, description="Layover rate per day")

    commodity: Optional[str] = Field(None, description="Type of cargo")
    weight: Optional[float] = Field(None, description="Weight in pounds")
    pieces: Optional[int] = Field(None, description="Number of pieces/pallets")
    equipment_type: Optional[str] = Field(None, description="Equipment type (Dry Van, Reefer, etc.)")

    broker_contact: Optional[str] = Field(None, description="Broker contact person name")
    broker_phone: Optional[str] = Field(None, description="Broker phone number")
    broker_email: Optional[str] = Field(None, description="Broker email address")

    payment_terms: Optional[str] = Field(None, description="Payment terms (Net 30, Quick Pay, etc.)")
    special_instructions: Optional[str] = Field(None, description="Special instructions")
    notes: Optional[str] = Field(None, description="Additional notes")

    status: Optional[str] = Field("pending", description="Status: pending, confirmed, completed, cancelled")
    document_url: Optional[str] = Field(None, description="URL to uploaded document")


class RateconCreate(RateconBase):
    """Schema for creating a new ratecon"""
    pass


class RateconUpdate(BaseModel):
    """Schema for updating a ratecon - all fields optional"""
    ratecon_number: Optional[str] = None
    load_number: Optional[str] = None
    broker_name: Optional[str] = None
    carrier_name: Optional[str] = None

    date_issued: Optional[date] = None
    pickup_date: Optional[date] = None
    delivery_date: Optional[date] = None

    pickup_location: Optional[str] = None
    delivery_location: Optional[str] = None

    total_rate: Optional[float] = None
    fuel_surcharge: Optional[float] = None
    detention_rate: Optional[float] = None
    layover_rate: Optional[float] = None

    commodity: Optional[str] = None
    weight: Optional[float] = None
    pieces: Optional[int] = None
    equipment_type: Optional[str] = None

    broker_contact: Optional[str] = None
    broker_phone: Optional[str] = None
    broker_email: Optional[str] = None

    payment_terms: Optional[str] = None
    special_instructions: Optional[str] = None
    notes: Optional[str] = None

    status: Optional[str] = None
    document_url: Optional[str] = None


class RateconResponse(RateconBase):
    """Schema for ratecon responses"""
    id: int
    company_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
