from sqlalchemy import Column, Integer, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from .base import Base


class DriverPayrollSettings(Base):
    __tablename__ = "driver_payroll_settings"

    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=False, unique=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    # Dispatch fee as a percentage (e.g., 10.5 for 10.5%)
    dispatch_fee_percent = Column(Numeric(5, 2), default=0)

    # Weekly flat rates
    insurance_weekly = Column(Numeric(10, 2), default=0)
    parking_weekly = Column(Numeric(10, 2), default=0)
    trailer_weekly = Column(Numeric(10, 2), default=0)
    misc_weekly = Column(Numeric(10, 2), default=0)

    # Relationships
    driver = relationship("Driver", backref="payroll_settings")
    company = relationship("Company")
