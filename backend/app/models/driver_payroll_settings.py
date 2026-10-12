from sqlalchemy import Column, Date, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
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


class DriverPayRateVersion(Base):
    """
    A driver's pay rates from effective_from onward (app/services/pay_rates.py).

    Saved whenever a rate in DriverPayrollSettings changes, so a new rate
    applies from the week it was changed and earlier weeks keep the old one.
    values holds the rate fields (pay_rates.RATE_FIELDS) as strings.
    """

    __tablename__ = "driver_pay_rate_versions"
    __table_args__ = (UniqueConstraint("driver_id", "effective_from", name="uq_driver_pay_rate_version"),)

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    driver_id = Column(Integer, ForeignKey("drivers.id", ondelete="CASCADE"), nullable=False, index=True)
    effective_from = Column(Date, nullable=False)
    values = Column(JSONB, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"))
