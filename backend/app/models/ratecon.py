"""
Ratecon (Rate Confirmation) model
"""
from sqlalchemy import Column, Integer, String, Text, Float, Date, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base


class Ratecon(Base):
    """
    Rate confirmation documents for loads
    Stores pricing agreements between carrier and broker/shipper
    """
    __tablename__ = "ratecons"

    id = Column(Integer, primary_key=True, index=True)

    # Basic Information
    ratecon_number = Column(String, unique=True, nullable=False, index=True)
    load_number = Column(String, nullable=True)  # Reference to load
    broker_name = Column(String, nullable=False)
    carrier_name = Column(String, nullable=True)

    # Dates
    date_issued = Column(Date, nullable=True)
    pickup_date = Column(Date, nullable=True)
    delivery_date = Column(Date, nullable=True)

    # Locations
    pickup_location = Column(Text, nullable=True)
    delivery_location = Column(Text, nullable=True)

    # Financial Details
    total_rate = Column(Float, nullable=True)  # Total amount
    fuel_surcharge = Column(Float, nullable=True)
    detention_rate = Column(Float, nullable=True)  # Per hour
    layover_rate = Column(Float, nullable=True)  # Per day

    # Load Details
    commodity = Column(String, nullable=True)  # What's being hauled
    weight = Column(Float, nullable=True)  # In pounds
    pieces = Column(Integer, nullable=True)  # Number of pieces
    equipment_type = Column(String, nullable=True)  # Dry Van, Reefer, Flatbed, etc.

    # Contact Information
    broker_contact = Column(String, nullable=True)
    broker_phone = Column(String, nullable=True)
    broker_email = Column(String, nullable=True)

    # Additional Terms
    payment_terms = Column(String, nullable=True)  # e.g., "Net 30", "Quick Pay"
    special_instructions = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    # Status
    status = Column(String, nullable=True, default='pending')  # pending, confirmed, completed, cancelled

    # Document Storage
    document_url = Column(String, nullable=True)  # S3 URL or file path

    # Multi-tenant
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    company = relationship("Company", back_populates="ratecons")
