from sqlalchemy import Column, String, Numeric, Integer, ForeignKey
from .base import Base


class RateToOperate(Base):
    __tablename__ = "rate_to_operate"

    # section: 'variable', 'fixed', or 'summary'
    section = Column(String, nullable=False)
    expense = Column(String, nullable=False, default='')
    miles = Column(Numeric(12, 2), nullable=False, default=0)
    rate_per_mile = Column(Numeric(12, 4), nullable=False, default=0)
    total = Column(Numeric(12, 2), nullable=False, default=0)
    sort_order = Column(Integer, nullable=False, default=0)

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
