"""
Driver pay rates by date: a changed rate applies from the week it was changed
and earlier weeks keep the rate they had.

DriverPayrollSettings holds the current rates. Each change saves a
DriverPayRateVersion dated the day of the change (company time); the first
change also saves the old rates as a baseline covering everything before.
A pay week uses the latest version dated on or before its Sunday, so a change
made mid-week counts for that whole week. A driver whose rates were never
changed has no versions and uses the current settings everywhere, as before.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Dict, List, Optional
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.driver_payroll_settings import DriverPayRateVersion, DriverPayrollSettings

RATE_FIELDS = (
    "dispatch_fee_percent", "insurance_weekly", "parking_weekly", "trailer_weekly", "misc_weekly",
    "pay_structure", "pay_fixed", "pay_per_mile", "pay_percent",
)
BASELINE = date(2000, 1, 1)  # "always" - the rates before the first recorded change
COMPANY_TZ = ZoneInfo("America/Chicago")


def company_today() -> date:
    return datetime.now(COMPANY_TZ).date()


def _str(v) -> Optional[str]:
    if v is None:
        return None
    if isinstance(v, (Decimal, float, int)):
        return format(Decimal(str(v)).normalize(), "f")  # 350.00 -> "350", 0.650 -> "0.65"
    return str(v)


def snapshot(st: Optional[DriverPayrollSettings]) -> Dict[str, Optional[str]]:
    """The rate fields of a settings row (None row = nothing set yet: zeros / no structure)."""
    if st is None:
        return {f: (None if f.startswith("pay_") else "0") for f in RATE_FIELDS}
    return {f: _str(getattr(st, f, None)) for f in RATE_FIELDS}


async def record_change(db: AsyncSession, company_id: int, driver_id: int,
                        before: Dict[str, Optional[str]], after: Dict[str, Optional[str]],
                        user_id: Optional[int], today: Optional[date] = None) -> None:
    """Save a dated version if any rate changed. Call before committing the settings change."""
    if before == after:
        return
    today = today or company_today()
    existing = {
        v.effective_from: v for v in (await db.execute(
            select(DriverPayRateVersion).where(DriverPayRateVersion.driver_id == driver_id)
        )).scalars()
    }
    if not existing:
        db.add(DriverPayRateVersion(company_id=company_id, driver_id=driver_id, effective_from=BASELINE,
                                    values=before, created_by=user_id))
    if today in existing:
        existing[today].values = after  # changed again the same day
    else:
        db.add(DriverPayRateVersion(company_id=company_id, driver_id=driver_id, effective_from=today,
                                    values=after, created_by=user_id))


class RateBook:
    """Rates in effect for any driver and week, for one company."""

    def __init__(self, versions: Dict[int, List[DriverPayRateVersion]]):
        self.versions = versions

    @classmethod
    async def load(cls, db: AsyncSession, company_id: int) -> "RateBook":
        by: Dict[int, List[DriverPayRateVersion]] = {}
        for v in (await db.execute(
            select(DriverPayRateVersion).where(DriverPayRateVersion.company_id == company_id)
            .order_by(DriverPayRateVersion.driver_id, DriverPayRateVersion.effective_from)
        )).scalars():
            by.setdefault(v.driver_id, []).append(v)
        return cls(by)

    def at(self, driver_id: int, current: Optional[DriverPayrollSettings], week_end: date) -> Dict[str, Optional[str]]:
        """Rate fields for the pay week ending `week_end`."""
        found = None
        for v in self.versions.get(driver_id, []):
            if v.effective_from <= week_end:
                found = v
            else:
                break
        return dict(found.values) if found is not None else snapshot(current)

    def money(self, driver_id: int, current: Optional[DriverPayrollSettings], week_end: date, field: str) -> Decimal:
        value = self.at(driver_id, current, week_end).get(field)
        return Decimal(value) if value not in (None, "") else Decimal(0)
