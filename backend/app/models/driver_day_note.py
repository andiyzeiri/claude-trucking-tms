from sqlalchemy import Column, Integer, Date, String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from .base import Base


class DriverDayNote(Base):
    """
    Stores notes for driver days on the dispatch board.
    Notes can be added to any day regardless of status (Available, Attention, OFF).
    """
    __tablename__ = "driver_day_notes"

    driver_id = Column(Integer, ForeignKey("drivers.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    note = Column(String(500), nullable=False)  # Max 500 chars for notes
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    # Relationships
    driver = relationship("Driver", backref="day_notes")
    company = relationship("Company")

    __table_args__ = (
        UniqueConstraint('driver_id', 'date', name='uq_driver_day_note'),
    )
