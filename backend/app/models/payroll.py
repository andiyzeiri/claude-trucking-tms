from sqlalchemy import Column, String, Float, Integer, ForeignKey, Enum, Date
from sqlalchemy.orm import relationship
import enum
from .base import Base


class PayrollType(str, enum.Enum):
    COMPANY = "company"
    OWNER_OPERATOR = "owner_operator"


class Payroll(Base):
    __tablename__ = "payroll"

    week_start = Column(Date, nullable=False)
    week_end = Column(Date, nullable=False)
    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=False)
    type = Column(Enum(PayrollType), nullable=False)

    # Financial fields
    gross = Column(Float, default=0.0)
    extra = Column(Float, default=0.0)
    dispatch_fee = Column(Float, default=0.0)
    insurance = Column(Float, default=0.0)
    fuel = Column(Float, default=0.0)
    parking = Column(Float, default=0.0)
    trailer = Column(Float, default=0.0)
    misc = Column(Float, default=0.0)
    escrow = Column(Float, default=0.0)

    # Performance metrics
    miles = Column(Integer, default=0)

    # Multi-tenant
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    # Relationships
    driver = relationship("Driver", backref="payroll_entries")
    company = relationship("Company", backref="payroll_entries")

    @property
    def check_amount(self) -> float:
        """Calculate the check amount (gross + extra - deductions)"""
        deductions = (
            self.dispatch_fee +
            self.insurance +
            self.fuel +
            self.parking +
            self.trailer +
            self.misc +
            self.escrow
        )
        return self.gross + self.extra - deductions

    @property
    def rpm(self) -> float:
        """Calculate revenue per mile"""
        if self.miles > 0:
            return self.gross / self.miles
        return 0.0

    @property
    def week_label(self) -> str:
        """Generate week label for display"""
        return f"{self.week_start.strftime('%b %d')} - {self.week_end.strftime('%b %d')}"
