from sqlalchemy import Column, String, Text, Numeric, DateTime, ForeignKey, Integer, Date, Boolean
from sqlalchemy.orm import relationship
from .base import Base


class Expense(Base):
    __tablename__ = "expenses"

    date = Column(Date, nullable=False)
    category = Column(String, nullable=False)
    cost_type = Column(String, nullable=False, default='variable')  # 'fixed' or 'variable'
    expense_group = Column(String, nullable=False, default='company')  # 'company', 'driver', 'owner', 'insurance', 'misc'
    description = Column(Text)
    amount = Column(Numeric(10, 2), nullable=False)

    # Recurring expense settings (for fixed costs)
    frequency = Column(String, nullable=True)  # 'weekly', 'monthly', 'yearly'
    pay_day = Column(Integer, nullable=True)  # day of week (1-7) for weekly, day of month (1-31) for monthly, day of year (1-365) for yearly
    is_template = Column(Boolean, default=False)  # True = recurring template, False = actual expense entry
    template_id = Column(Integer, ForeignKey("expenses.id"), nullable=True)  # links auto-created entries back to template
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
    # load = relationship("Load", back_populates="expenses")
