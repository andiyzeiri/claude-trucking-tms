from sqlalchemy import Column, String, Text, Numeric, DateTime, ForeignKey, Integer, Enum
from sqlalchemy.orm import relationship
import enum
from .base import Base


class LoadStatus(str, enum.Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    IN_TRANSIT = "in_transit"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class Load(Base):
    __tablename__ = "loads"

    load_number = Column(String, unique=True, nullable=False, index=True)
    reference_number = Column(String)
    description = Column(Text)
    pickup_location = Column(String)
    delivery_location = Column(String)
    miles = Column(Integer)

    # Financial
    rate = Column(Numeric(10, 2))
    fuel_surcharge = Column(Numeric(10, 2), default=0)
    accessorial_charges = Column(Numeric(10, 2), default=0)
    total_amount = Column(Numeric(10, 2))

    # Scheduling
    pickup_date = Column(DateTime)
    delivery_date = Column(DateTime)
    pickup_deadline = Column(DateTime)
    delivery_deadline = Column(DateTime)

    # Status
    status = Column(Enum(LoadStatus), default=LoadStatus.PENDING)

    # Documents
    pod_url = Column(String)
    ratecon_url = Column(String)

    # Multi-tenant
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    company = relationship("Company", back_populates="loads")

    # Relationships
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    customer = relationship("Customer", back_populates="loads")

    truck_id = Column(Integer, ForeignKey("trucks.id"))
    truck = relationship("Truck", back_populates="loads")

    driver_id = Column(Integer, ForeignKey("drivers.id"))
    driver = relationship("Driver", back_populates="loads")

    stops = relationship("Stop", back_populates="load", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="load")
    expenses = relationship("Expense", back_populates="load")