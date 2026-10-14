from sqlalchemy import Column, String, Integer, ForeignKey, Enum, Numeric, Boolean, DateTime, false
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
import enum
from .base import Base


class TruckStatus(str, enum.Enum):
    AVAILABLE = "available"
    IN_TRANSIT = "in_transit"
    MAINTENANCE = "maintenance"
    OUT_OF_SERVICE = "out_of_service"
    IN_USE = "in_use"
    SOLD = "sold"              # company equipment only
    NOT_LEASED = "not_leased"  # owner-operator equipment only


class TruckOwnership(str, enum.Enum):
    COMPANY = "company"
    OWNER_OPERATOR = "owner_operator"


# Statuses that belong to one kind of ownership.
STATUS_OWNERSHIP = {TruckStatus.SOLD.value: TruckOwnership.COMPANY.value,
                    TruckStatus.NOT_LEASED.value: TruckOwnership.OWNER_OPERATOR.value}


class TruckType(str, enum.Enum):
    TRUCK = "truck"
    TRAILER = "trailer"


class Truck(Base):
    __tablename__ = "trucks"

    type = Column(String, default="truck", nullable=False)
    truck_number = Column(String, nullable=False)
    vin = Column(String)
    make = Column(String)
    model = Column(String)
    year = Column(Integer)
    license_plate = Column(String)
    status = Column(String, default="available")
    # Whose equipment: the company's own, or an owner-operator's leased on
    ownership = Column(String(20), nullable=False, default="company", server_default="company")
    value = Column(Numeric(12, 2), default=0)
    cargo_insurance = Column(Numeric(10, 2), default=0)
    liability_insurance = Column(Numeric(10, 2), default=0)
    physical_damage_insurance = Column(Numeric(10, 2), default=0)
    miles = Column(Integer, default=0)
    # When `miles` was last set from the Peak ELD odometer (null = typed in)
    odometer_at = Column(DateTime(timezone=True))
    # When `mpg` was last worked out from ELD miles / Fuel gallons (null = typed in)
    mpg_at = Column(DateTime(timezone=True))
    # Registration / annual inspection documents (PDF, /api/v1/uploads/s3/... like POD and ratecon)
    registration_url = Column(String)
    inspection_url = Column(String)
    mpg = Column(Numeric(5, 1), default=0)
    # Owner buys fuel on their own card: shown red at the bottom of the Fuel page
    own_fuel_card = Column(Boolean, nullable=False, default=False, server_default=false())

    # Current location (PostGIS)
    current_location = Column(Geometry("POINT", srid=4326))

    # Multi-tenant
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    company = relationship("Company", back_populates="trucks")

    # Current driver assignment
    current_driver_id = Column(Integer, ForeignKey("drivers.id"))
    current_driver = relationship("Driver", back_populates="current_truck")

    # Relationships
    loads = relationship("Load", back_populates="truck")
    expenses = relationship("Expense", back_populates="truck")
    fuel_entries = relationship("Fuel", back_populates="truck")
    ifta_entries = relationship("IFTA", back_populates="truck")