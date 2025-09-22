from sqlalchemy import Column, String, Text, DateTime, Integer, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
import enum
from .base import Base


class StopType(str, enum.Enum):
    PICKUP = "pickup"
    DELIVERY = "delivery"
    FUEL = "fuel"
    REST = "rest"


class StopStatus(str, enum.Enum):
    PENDING = "pending"
    ARRIVED = "arrived"
    LOADING = "loading"
    COMPLETED = "completed"
    SKIPPED = "skipped"


class Stop(Base):
    __tablename__ = "stops"

    sequence = Column(Integer, nullable=False)  # Order of stops in the load
    stop_type = Column(Enum(StopType), nullable=False)
    status = Column(Enum(StopStatus), default=StopStatus.PENDING)

    # Location
    name = Column(String, nullable=False)  # Company/location name
    address = Column(Text, nullable=False)
    city = Column(String, nullable=False)
    state = Column(String, nullable=False)
    zip_code = Column(String, nullable=False)
    coordinates = Column(Geometry("POINT", srid=4326))  # PostGIS

    # Contact
    contact_name = Column(String)
    contact_phone = Column(String)

    # Scheduling
    scheduled_arrival = Column(DateTime)
    scheduled_departure = Column(DateTime)
    actual_arrival = Column(DateTime)
    actual_departure = Column(DateTime)

    # Geofencing
    geofence_radius = Column(Integer, default=200)  # meters
    auto_arrival_detected = Column(Boolean, default=False)

    # Documentation
    notes = Column(Text)
    pod_required = Column(Boolean, default=False)  # Proof of Delivery
    bol_required = Column(Boolean, default=False)  # Bill of Lading

    # Relationships
    load_id = Column(Integer, ForeignKey("loads.id"), nullable=False)
    load = relationship("Load", back_populates="stops")