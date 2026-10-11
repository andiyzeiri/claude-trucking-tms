from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
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
