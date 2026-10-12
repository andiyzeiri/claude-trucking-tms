from sqlalchemy import Column, Integer, Numeric, String, ForeignKey
from sqlalchemy.orm import relationship
from .base import Base


class DriverPayrollSettings(Base):
    __tablename__ = "driver_payroll_settings"

    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=False, unique=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    # Dispatch fee as a percentage (e.g., 10.5 for 10.5%)
    dispatch_fee_percent = Column(Numeric(5, 2), default=0)

    # Assigned truck for fuel tracking
    truck_id = Column(Integer, ForeignKey("trucks.id"), nullable=True)

    # Driver pay settings
    pay_type = Column(String, default='flat')  # 'flat' or 'per_mile'
    pay_rate = Column(Numeric(10, 2), default=0)  # flat weekly amount or rate per mile

    # Company drivers' pay structure on the Payroll page (Pay Structure row).
    # pay_structure picks which one pays: 'fixed' (pay_fixed a week),
    # 'per_mile' (pay_per_mile x Trip Miles) or 'percent' (pay_percent % of
    # Gross). The other two are shown under Net Pay for comparison. Null = not
    # set: the driver is paid Gross, as before.
    pay_structure = Column(String(20), nullable=True)
    pay_fixed = Column(Numeric(10, 2), nullable=True)
    pay_per_mile = Column(Numeric(10, 3), nullable=True)
    pay_percent = Column(Numeric(5, 2), nullable=True)

    # Weekly flat rates
    insurance_weekly = Column(Numeric(10, 2), default=0)
    parking_weekly = Column(Numeric(10, 2), default=0)
    trailer_weekly = Column(Numeric(10, 2), default=0)
    misc_weekly = Column(Numeric(10, 2), default=0)

    # Relationships
    driver = relationship("Driver", backref="payroll_settings")
    company = relationship("Company")
    truck = relationship("Truck")
