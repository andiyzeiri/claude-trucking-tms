from sqlalchemy import Column, String, Text, ForeignKey, Integer
from sqlalchemy.orm import relationship
from .base import Base


class Receiver(Base):
    __tablename__ = "receivers"

    name = Column(String, nullable=False)
    address = Column(Text)
    city = Column(String)
    state = Column(String)
    zip_code = Column(String)
    phone = Column(String)
    contact_person = Column(String)
    email = Column(String)
    product_type = Column(String)  # Type of products handled
    average_wait_time = Column(String)  # e.g., "30 minutes", "1 hour"
    appointment_type = Column(String)  # e.g., "Required", "Walk-in", "FCFS"
    notes = Column(Text)

    # Multi-tenant
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    company = relationship("Company", back_populates="receivers")
