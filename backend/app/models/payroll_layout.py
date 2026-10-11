from sqlalchemy import Column, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from .base import Base


class PayrollLayout(Base):
    """
    Which line items the Payroll page shows, per company, in order.

    `rows` is a list of {key, label, kind, mode, hidden, builtin, amounts}:
      kind    earning | deduction | info (miles - shown, never added to net pay)
      mode    auto (calculated from loads / fuel cards), fixed (the same weekly
              amount every week, per driver) or variable (entered each week)
      amounts per-driver weekly amounts for a fixed custom row, {driver_id: amount};
              the built-in fixed rows keep theirs in driver_payroll_settings.
    A hidden row is left out of the table and out of net pay. Week-by-week
    edits live in payroll_overrides with field = the row key.
    """

    __tablename__ = "payroll_layouts"

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, unique=True, index=True)
    rows = Column(JSONB, nullable=False)
