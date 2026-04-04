from sqlalchemy import Column, Integer, String, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from .base import Base


class PayrollOverride(Base):
    __tablename__ = "payroll_overrides"

    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    year = Column(Integer, nullable=False)
    week_number = Column(Integer, nullable=False)
    field = Column(String(50), nullable=False)  # e.g. "fuel"
    value = Column(Numeric(12, 2), nullable=False, default=0)

    driver = relationship("Driver")
    company = relationship("Company")
