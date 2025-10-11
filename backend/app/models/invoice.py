from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey, Integer, Enum, Boolean, Text
from sqlalchemy.orm import relationship
import enum
from .base import Base


class InvoiceStatus(str, enum.Enum):
    DRAFT = "draft"
    SENT = "sent"
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


class Invoice(Base):
    __tablename__ = "invoices"

    invoice_number = Column(String, unique=True, nullable=False, index=True)
    issue_date = Column(DateTime, nullable=False)
    due_date = Column(DateTime, nullable=False)
    status = Column(Enum(InvoiceStatus), default=InvoiceStatus.DRAFT)

    # Amounts
    subtotal = Column(Numeric(10, 2), nullable=False)
    tax_amount = Column(Numeric(10, 2), default=0)
    total_amount = Column(Numeric(10, 2), nullable=False)
    amount_paid = Column(Numeric(10, 2), default=0)

    # Payment
    payment_date = Column(DateTime)
    payment_method = Column(String)
    payment_reference = Column(String)

    # Details
    notes = Column(Text)
    terms = Column(Text)

    # Relationships
    load_id = Column(Integer, ForeignKey("loads.id"), nullable=False)
    # load = relationship("Load", back_populates="invoices")

    @property
    def amount_due(self) -> float:
        return float(self.total_amount - self.amount_paid)

    @property
    def is_paid(self) -> bool:
        return self.amount_paid >= self.total_amount