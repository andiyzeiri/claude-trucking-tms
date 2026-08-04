from sqlalchemy import (
    Column, String, Integer, ForeignKey, Text, Date, DateTime, Numeric,
    CheckConstraint, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship
from .base import Base


JOURNAL_STATUSES = ("draft", "posted", "void")

# Where the entry came from. 'manual' is hand-keyed; the rest are
# auto-posted from the operational subledgers.
JOURNAL_SOURCES = ("manual", "invoice", "fuel", "expense", "payroll")


class JournalEntry(Base):
    """
    Header of a double-entry journal entry.

    Lifecycle: draft -> posted -> (void via reversing entry).

    A posted entry is immutable. Corrections are made by posting a
    reversing entry that mirrors the original with debits and credits
    swapped, linked back through reverses_id. This keeps the ledger an
    append-only audit trail, which is the whole point of a GL.
    """

    __tablename__ = "journal_entries"

    # Assigned at post time (not at draft creation) so abandoned drafts
    # don't burn numbers and the posted sequence has no gaps.
    entry_number = Column(String(30), nullable=True, index=True)
    entry_date = Column(Date, nullable=False, index=True)
    memo = Column(Text)

    status = Column(String(10), nullable=False, default="draft")

    # Provenance for auto-posted entries. (source, source_id) identifies
    # the originating record, e.g. ('invoice', 42).
    source = Column(String(20), nullable=False, default="manual")
    source_id = Column(Integer, nullable=True)

    posted_at = Column(DateTime(timezone=True), nullable=True)
    posted_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Set on a reversing entry, pointing at the entry it reverses.
    reverses_id = Column(Integer, ForeignKey("journal_entries.id"), nullable=True)

    # Multi-tenant. Held directly on the row rather than inferred through
    # a join - the ledger is the audit record and must stand alone.
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)

    lines = relationship(
        "JournalLine",
        back_populates="entry",
        cascade="all, delete-orphan",
        order_by="JournalLine.line_number",
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('draft','posted','void')",
            name="je_status_chk",
        ),
        CheckConstraint(
            "source IN ('manual','invoice','fuel','expense','payroll')",
            name="je_source_chk",
        ),
        UniqueConstraint("company_id", "entry_number", name="je_company_number_uniq"),
        Index("ix_je_company_date", "company_id", "entry_date"),
        Index("ix_je_company_source", "company_id", "source", "source_id"),
    )

    @property
    def is_posted(self) -> bool:
        return self.status == "posted"


class JournalLine(Base):
    """
    One debit or credit against a single account.

    A line is either a debit or a credit, never both - enforced by
    jl_one_side_chk. The entry-level rule (sum of debits == sum of
    credits) spans rows so it cannot be a column constraint; it is
    enforced in the posting service inside the same transaction that
    flips the entry to 'posted'.
    """

    __tablename__ = "journal_lines"

    journal_entry_id = Column(
        Integer,
        ForeignKey("journal_entries.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    line_number = Column(Integer, nullable=False, default=1)

    # numeric(12,4) per the project money rule. Existing subledger tables
    # use numeric(10,2); posting into (12,4) is a widening cast, so no
    # rounding occurs on the way in.
    debit = Column(Numeric(12, 4), nullable=False, default=0)
    credit = Column(Numeric(12, 4), nullable=False, default=0)

    memo = Column(Text)

    # Denormalized from the parent entry so every ledger and trial-balance
    # query filters by tenant without joining the header.
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)

    entry = relationship("JournalEntry", back_populates="lines")
    account = relationship("Account")

    __table_args__ = (
        CheckConstraint("debit >= 0 AND credit >= 0", name="jl_nonneg_chk"),
        CheckConstraint("NOT (debit > 0 AND credit > 0)", name="jl_one_side_chk"),
        Index("ix_jl_company_account", "company_id", "account_id"),
    )
