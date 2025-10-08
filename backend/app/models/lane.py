from sqlalchemy import Column, String, Integer, ForeignKey, Text
from sqlalchemy.orm import relationship
from .base import Base


class Lane(Base):
    __tablename__ = "lanes"

    pickup_location = Column(String, nullable=False)
    delivery_location = Column(String, nullable=False)
    broker = Column(String, nullable=False)
    email = Column(String)
    phone = Column(String)
    notes = Column(Text)

    # Multi-tenant
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    company = relationship("Company", backref="lanes")

    @property
    def route(self) -> str:
        """Generate route string for display"""
        return f"{self.pickup_location} → {self.delivery_location}"
