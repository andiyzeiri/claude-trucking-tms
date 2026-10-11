from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, Numeric, String
from .base import Base


class DriverDebtEntry(Base):
    """
    Money a driver owes the company (kind="debt": an advance, a loan, damage)
    or a payment against it made outside payroll (kind="payment": cash, check).
    Amounts are always positive; the kind says which way they go. Payments
    taken through payroll aren't stored here - they come from the Payroll
    page's "Debt Payment" row (see app/api/v1/endpoints/driver_debts.py).
    Soft-deleted via deleted_at.
    """

    __tablename__ = "driver_debt_entries"

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=False, index=True)
    kind = Column(String(10), nullable=False)  # debt | payment
    amount = Column(Numeric(12, 2), nullable=False)
    entry_date = Column(Date, nullable=False)
    note = Column(String(255))
    created_by = Column(Integer, ForeignKey("users.id"))
    deleted_at = Column(DateTime(timezone=True))


class DriverDebtPlan(Base):
    """How much comes out of a driver's pay each week toward what they owe."""

    __tablename__ = "driver_debt_plans"

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=False, unique=True)
    weekly_amount = Column(Numeric(12, 2), nullable=False, default=0)
