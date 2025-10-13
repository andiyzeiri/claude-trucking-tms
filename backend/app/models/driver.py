from sqlalchemy import Column, String, Date, ForeignKey, Integer, Enum
from sqlalchemy.orm import relationship
import enum
from .base import Base


class DriverStatus(str, enum.Enum):
    AVAILABLE = "available"
    ON_DUTY = "on_duty"
    DRIVING = "driving"
    OFF_DUTY = "off_duty"
    SLEEPER = "sleeper"


class Driver(Base):
    __tablename__ = "drivers"

    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    license_number = Column(String, unique=True, nullable=False)
    license_expiry = Column(Date)
    phone = Column(String)
    email = Column(String)
    status = Column(Enum(DriverStatus), default=DriverStatus.OFF_DUTY)

    # Multi-tenant
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    company = relationship("Company", back_populates="drivers")

    # Relationships
    current_truck = relationship("Truck", back_populates="current_driver", uselist=False)
    loads = relationship("Load", back_populates="driver")
    expenses = relationship("Expense", back_populates="driver")
    fuel_entries = relationship("Fuel", back_populates="driver")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"