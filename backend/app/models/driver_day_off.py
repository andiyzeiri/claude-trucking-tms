from sqlalchemy import Column, Integer, Date, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from .base import Base


class DriverDayOff(Base):
    __tablename__ = "driver_days_off"

    driver_id = Column(Integer, ForeignKey("drivers.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    # Relationships
    driver = relationship("Driver", backref="days_off")
    company = relationship("Company")

    # Ensure a driver can only have one entry per date
    __table_args__ = (
        UniqueConstraint('driver_id', 'date', name='uq_driver_date'),
    )
