from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from .base import Base


class EldConnection(Base):
    """
    A company's link to its ELD provider (Peak ELD today), used for mileage.

    The API key is stored encrypted (app/services/secret_box.py) and never
    sent back to the browser - only its last 4 characters are.
    truck_map pins ELD vehicles to TMS trucks when the unit number / VIN
    doesn't match on its own: {"<eld vehicle id>": truck_id or null}.
    """

    __tablename__ = "eld_connections"

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, unique=True, index=True)
    provider = Column(String(20), nullable=False, default="peak")
    api_key_encrypted = Column(Text, nullable=False)
    key_last4 = Column(String(4))
    truck_map = Column(JSONB, nullable=False, default=dict)
    connected_by = Column(Integer, ForeignKey("users.id"))
    last_ok_at = Column(DateTime(timezone=True))
    last_error = Column(String(255))
    # When odometer recording started (app/services/eld_odometer.py); weeks
    # starting after this get Total Miles from the recorded odometer.
    odometer_since = Column(DateTime(timezone=True))


class EldOdometerReading(Base):
    """
    A truck's odometer as reported live by the ELD (Peak /api/v0/locations),
    recorded every few minutes. recorded_at is the ELD's own location time, so
    a parked truck isn't recorded again until it reports something new.
    Odometer is stored in miles.
    """

    __tablename__ = "eld_odometer_readings"
    __table_args__ = (
        UniqueConstraint("company_id", "eld_vehicle_id", "recorded_at", name="uq_eld_odometer_reading"),
    )

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    eld_vehicle_id = Column(String(64), nullable=False)
    recorded_at = Column(DateTime(timezone=True), nullable=False)
    odometer = Column(Numeric(12, 1), nullable=False)
