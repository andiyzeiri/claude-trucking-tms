from sqlalchemy import Column, String, Text, Numeric, DateTime, ForeignKey, Integer, Date
from sqlalchemy.orm import relationship
from .base import Base


class Expense(Base):
    __tablename__ = "expenses"

    date = Column(Date, nullable=False)
    category = Column(String, nullable=False)
    description = Column(Text)
    amount = Column(Numeric(10, 2), nullable=False)
    vendor = Column(String)
    payment_method = Column(String)
    receipt_number = Column(String)

    # Multi-tenant
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    company = relationship("Company", back_populates="expenses")

    # Optional relationships
    driver_id = Column(Integer, ForeignKey("drivers.id"))
    driver = relationship("Driver", back_populates="expenses")

    truck_id = Column(Integer, ForeignKey("trucks.id"))
    truck = relationship("Truck", back_populates="expenses")

    load_id = Column(Integer, ForeignKey("loads.id"))
    load = relationship("Load", back_populates="expenses")
