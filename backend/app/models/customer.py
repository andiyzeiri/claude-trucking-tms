from sqlalchemy import Column, String, Text, ForeignKey, Integer
from sqlalchemy.orm import relationship
from .base import Base


class Customer(Base):
    __tablename__ = "customers"

    name = Column(String, nullable=False)
    mc = Column(String)  # Motor Carrier number
    contact_person = Column(String)
    email = Column(String)
    phone = Column(String)
    address = Column(Text)
    city = Column(String)
    state = Column(String)
    zip_code = Column(String)
    billing_address = Column(Text)
    payment_terms = Column(String)  # Net 30, Net 60, etc.
    credit_limit = Column(String)

    # Multi-tenant
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    company = relationship("Company", back_populates="customers")

    # Relationships
    loads = relationship("Load", back_populates="customer")