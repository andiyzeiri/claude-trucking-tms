from sqlalchemy import Column, String, Text
from sqlalchemy.orm import relationship
from .base import Base


class Company(Base):
    __tablename__ = "companies"

    name = Column(String, nullable=False)
    mc_number = Column(String, unique=True, index=True)
    dot_number = Column(String, unique=True, index=True)
    address = Column(Text)
    city = Column(String)
    state = Column(String)
    zip_code = Column(String)
    phone = Column(String)
    email = Column(String)

    # Relationships
    users = relationship("User", back_populates="company")
    trucks = relationship("Truck", back_populates="company")
    drivers = relationship("Driver", back_populates="company")
    customers = relationship("Customer", back_populates="company")
    loads = relationship("Load", back_populates="company")