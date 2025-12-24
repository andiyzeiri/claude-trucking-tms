from sqlalchemy import Column, String, Text, Numeric, Integer, ForeignKey
from sqlalchemy.orm import relationship
from .base import Base


class IFTA(Base):
    __tablename__ = "ifta"

    year = Column(Integer, nullable=False)
    quarter = Column(Integer, nullable=False)  # 1-4
    jurisdiction = Column(String(2), nullable=False)  # State/province code (TX, CA, ON, etc.)
    total_miles = Column(Integer, default=0)
    taxable_miles = Column(Integer, default=0)
    tax_paid_gallons = Column(Numeric(10, 2), default=0)
    mpg = Column(Numeric(10, 3))  # Calculated: total_miles / tax_paid_gallons
    notes = Column(Text)

    # Multi-tenant
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    company = relationship("Company", back_populates="ifta_entries")

    # Optional: track per truck
    truck_id = Column(Integer, ForeignKey("trucks.id"))
    truck = relationship("Truck", back_populates="ifta_entries")
