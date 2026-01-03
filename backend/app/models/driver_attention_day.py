from sqlalchemy import Column, Integer, Date, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from .base import Base


class DriverAttentionDay(Base):
    """
    Tracks days where a driver needs attention (dispatcher should find a load).
    Similar to driver_days_off but for attention flagging.
    """
    __tablename__ = "driver_attention_days"

    driver_id = Column(Integer, ForeignKey("drivers.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    # Relationships
    driver = relationship("Driver", backref="attention_days")
    company = relationship("Company")

    __table_args__ = (
        UniqueConstraint('driver_id', 'date', name='uq_driver_attention_date'),
    )
