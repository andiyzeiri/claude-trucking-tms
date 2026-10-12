from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from .base import Base


class FuelCardConnection(Base):
    """
    A company's fuel card feed: WEX Fleet One / EFS daily transaction files
    read from WEX's SFTP server (app/services/wex_sftp.py).

    The password is encrypted (app/services/secret_box.py) and never sent back.
    processed_files lists the files already imported ("path:size").
    card_map pins a card (last 6 digits) to a truck when the UNIT prompt keyed
    at the pump doesn't match a truck number: {"123456": truck_id}.
    Transactions dated before import_from are never imported, so turning the
    feed on doesn't double up fuel already entered by hand for past weeks.
    """

    __tablename__ = "fuel_card_connections"

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, unique=True, index=True)
    provider = Column(String(20), nullable=False, default="wex_sftp")
    host = Column(String(255), nullable=False)
    port = Column(Integer, nullable=False, default=22)
    remote_dir = Column(String(255), nullable=False, default="/")
    username = Column(String(100), nullable=False)
    password_encrypted = Column(Text, nullable=False)
    import_from = Column(Date, nullable=False)
    card_map = Column(JSONB, nullable=False, default=dict)
    processed_files = Column(JSONB, nullable=False, default=list)
    connected_by = Column(Integer, ForeignKey("users.id"))
    last_sync_at = Column(DateTime(timezone=True))
    last_sync_result = Column(String(255))
    last_error = Column(String(255))


class FuelCardTransaction(Base):
    """
    One card swipe as received from the provider, and what became of it:
      imported     -> a Fuel entry was created (fuel_id)
      linked       -> matched a Fuel entry already typed in by hand (fuel_id)
      needs_truck  -> no truck matched yet; imported once the card is matched
      not_fuel     -> no diesel or DEF on it (cash advance, scale, oil...)
    Kept so a sync never imports the same swipe twice, even if its Fuel entry
    is later edited or deleted.
    """

    __tablename__ = "fuel_card_transactions"
    __table_args__ = (
        UniqueConstraint("company_id", "provider", "external_id", name="uq_fuel_card_tx_external"),
    )

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    provider = Column(String(20), nullable=False, default="wex_sftp")
    external_id = Column(String(40), nullable=False)
    transaction_date = Column(DateTime)  # as reported by the provider (their local time)
    card_last6 = Column(String(6))
    unit = Column(String(40))  # UNIT prompt keyed at the pump
    driver_prompt = Column(String(60))
    odometer = Column(Integer)
    location = Column(String(255))
    fuel_gallons = Column(Numeric(10, 3), default=0)
    fuel_amount = Column(Numeric(12, 2), default=0)
    def_gallons = Column(Numeric(10, 3), default=0)
    def_amount = Column(Numeric(12, 2), default=0)
    other_amount = Column(Numeric(12, 2), default=0)
    other_items = Column(String(255))
    net_total = Column(Numeric(12, 2), default=0)
    status = Column(String(20), nullable=False)
    truck_id = Column(Integer, ForeignKey("trucks.id"))
    fuel_id = Column(Integer, ForeignKey("fuel.id", ondelete="SET NULL"))
