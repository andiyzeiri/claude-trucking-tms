from sqlalchemy import Column, String, Integer, ForeignKey, Enum
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
import enum
from .base import Base


class TruckStatus(str, enum.Enum):
    AVAILABLE = "available"
    IN_TRANSIT = "in_transit"
    MAINTENANCE = "maintenance"
    OUT_OF_SERVICE = "out_of_service"


class Truck(Base):
    __tablename__ = "trucks"

    truck_number = Column(String, nullable=False)
    vin = Column(String, unique=True)
    make = Column(String)
    model = Column(String)
    year = Column(Integer)
    license_plate = Column(String)
    status = Column(Enum(TruckStatus), default=TruckStatus.AVAILABLE)

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