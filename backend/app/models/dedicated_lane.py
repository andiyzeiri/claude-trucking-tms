from sqlalchemy import Column, String, Integer, ForeignKey, Text, Numeric, Boolean, Time
from sqlalchemy.orm import relationship
from .base import Base


class DedicatedLane(Base):
    """
    Dedicated lane template that auto-generates loads weekly.
    Loads are created on Monday for the following week.
    """
    __tablename__ = "dedicated_lanes"

    # Lane identification
    name = Column(String, nullable=False)  # e.g., "Atlanta → Jacksonville Weekly"

    # Route info (same as Load)
    pickup_location = Column(String, nullable=False)
    delivery_location = Column(String, nullable=False)
    miles = Column(Integer)

    # Scheduling - which day of week this lane runs (0=Monday, 6=Sunday)
    day_of_week = Column(Integer, nullable=False, default=0)
    pickup_time = Column(Time)  # Default pickup time
    delivery_time = Column(Time)  # Default delivery time

    # Financial (same as Load)
    rate = Column(Numeric(10, 2))
    carrier_rate = Column(Numeric(10, 2))
    fuel_surcharge = Column(Numeric(10, 2), default=0)
    accessorial_charges = Column(Numeric(10, 2), default=0)

    # Notes
    pickup_notes = Column(Text)
    delivery_notes = Column(Text)
    reference_number = Column(String)  # Template reference number

    # Status
    is_active = Column(Boolean, default=True, nullable=False)

    # Multi-tenant
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    company = relationship("Company", backref="dedicated_lanes")

    # Relationships - required for load generation
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    customer = relationship("Customer", backref="dedicated_lanes")

    # Optional - can be assigned later
    driver_id = Column(Integer, ForeignKey("drivers.id"))
    driver = relationship("Driver", backref="dedicated_lanes")

    truck_id = Column(Integer, ForeignKey("trucks.id"))
    truck = relationship("Truck", backref="dedicated_lanes")

    @property
    def route(self) -> str:
        """Generate route string for display"""
        return f"{self.pickup_location} → {self.delivery_location}"

    @property
    def day_name(self) -> str:
        """Get the day name for the scheduled day"""
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        return days[self.day_of_week] if 0 <= self.day_of_week <= 6 else "Unknown"
