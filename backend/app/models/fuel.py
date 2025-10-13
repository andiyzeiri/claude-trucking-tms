from sqlalchemy import Column, String, Text, Numeric, DateTime, ForeignKey, Integer, Date
from sqlalchemy.orm import relationship
from .base import Base


class Fuel(Base):
    __tablename__ = "fuel"

    date = Column(Date, nullable=False)
    location = Column(String)  # Gas station name/location
    gallons = Column(Numeric(10, 2), nullable=False)
    price_per_gallon = Column(Numeric(10, 3))  # Allow 3 decimals for precise pricing
    total_amount = Column(Numeric(10, 2), nullable=False)
    odometer = Column(Integer)  # Odometer reading
    notes = Column(Text)

    # Multi-tenant
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    company = relationship("Company", back_populates="fuel_entries")

    # Relationships
    driver_id = Column(Integer, ForeignKey("drivers.id"))
    driver = relationship("Driver", back_populates="fuel_entries")

    truck_id = Column(Integer, ForeignKey("trucks.id"))
    truck = relationship("Truck", back_populates="fuel_entries")

    load_id = Column(Integer, ForeignKey("loads.id"))
    # Optional: link to a specific load if applicable
