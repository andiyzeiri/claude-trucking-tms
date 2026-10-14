"""
Equipment page MPG: the average of each truck's weekly MPG on the Fuel tab.

A week's MPG is worked out exactly as the Fuel tab does it: the week's Peak
ELD miles (the /eld/mileage numbers the Fuel tab and Payroll show - live
odometer, else first/last inspection, else GPS miles) divided by the gallons
on the truck's Fuel entries dated in that Monday-Sunday week. Weeks where
either is missing (the Fuel tab shows "-") are left out of the average.

A finished week's ELD miles don't change, so each is asked of Peak once and
kept in truck_week_miles. Runs daily (only weeks not fetched yet go to Peak)
and once after start-up.
"""
import asyncio
import logging
import types
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Dict, List, Tuple

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.eld_connection import EldConnection
from app.models.fuel import Fuel
from app.models.truck import Truck

logger = logging.getLogger(__name__)

WEEKS_BACK = 52
PAUSE_SECONDS = 5
TZ = "America/Chicago"  # the Fuel tab asks for the browser's zone; the office is on Central


def _monday(d: date) -> date:
    return d - timedelta(days=d.weekday())


async def _week_miles(db: AsyncSession, company_id: int, monday: date) -> Dict[int, float]:
    """TMS truck id -> that week's ELD miles, as the Fuel tab shows them."""
    from app.api.v1.endpoints.eld import mileage

    out = await mileage(start=monday, end=monday + timedelta(days=6), tz=TZ, odometer=True, db=db,
                        current_user=types.SimpleNamespace(company_id=company_id))
    miles: Dict[int, float] = {}
    for v in out.vehicles:
        if v.truck_id:
            # Same choice as the Fuel tab: odometer miles when there are any, else GPS miles.
            miles[v.truck_id] = float(v.odometer_miles if v.odometer_miles is not None else v.miles)
    return miles


async def update(db: AsyncSession, conn: EldConnection) -> int:
    company_id = conn.company_id
    this_monday = _monday(datetime.now(timezone.utc).date())
    first = this_monday - timedelta(weeks=WEEKS_BACK)

    # Gallons per truck per finished week, from the Fuel entries.
    gallons: Dict[Tuple[int, date], float] = {}
    for truck_id, day, g in (await db.execute(
        select(Fuel.truck_id, Fuel.date, Fuel.gallons)
        .where(Fuel.company_id == company_id, Fuel.truck_id.isnot(None), Fuel.date >= first, Fuel.date < this_monday)
    )).all():
        key = (truck_id, _monday(day))
        gallons[key] = gallons.get(key, 0.0) + float(g or 0)

    # ELD miles for the weeks that have fuel and haven't been fetched yet.
    have = {r[0] for r in (await db.execute(text(
        "SELECT DISTINCT week_start FROM truck_week_miles WHERE company_id = :c AND week_start >= :f"
    ), {"c": company_id, "f": first})).all()}
    missing = sorted({m for (_, m) in gallons} - have, reverse=True)  # newest first
    for i, monday in enumerate(missing):
        if i:
            await asyncio.sleep(PAUSE_SECONDS)  # go easy on Peak while catching up
        try:
            miles = await _week_miles(db, company_id, monday)
        except Exception as e:  # Peak busy / down: keep what we have, the next run carries on
            await db.rollback()
            logger.warning("truck_mpg: company %s: week of %s not fetched (%s); %s week(s) left for the next run",
                           company_id, monday, getattr(e, "detail", e), len(missing) - i)
            break
        rows = [{"c": company_id, "t": t, "w": monday, "m": round(m, 1)} for t, m in miles.items()]
        rows.append({"c": company_id, "t": None, "w": monday, "m": 0})  # marks the week fetched
        await db.execute(text(
            "INSERT INTO truck_week_miles (company_id, truck_id, week_start, miles) VALUES (:c, :t, :w, :m) "
            "ON CONFLICT DO NOTHING"
        ), rows)
        await db.commit()

    miles: Dict[Tuple[int, date], float] = {
        (t, w): float(m) for t, w, m in (await db.execute(text(
            "SELECT truck_id, week_start, miles FROM truck_week_miles "
            "WHERE company_id = :c AND week_start >= :f AND truck_id IS NOT NULL"
        ), {"c": company_id, "f": first})).all()
    }

    weekly: Dict[int, List[float]] = {}
    for (truck_id, monday), g in gallons.items():
        m = miles.get((truck_id, monday), 0.0)
        if m > 0 and g > 0:
            weekly.setdefault(truck_id, []).append(m / g)

    now = datetime.now(timezone.utc)
    updated = 0
    for truck in (await db.execute(select(Truck).where(Truck.company_id == company_id, Truck.type == "truck"))).scalars():
        mpgs = weekly.get(truck.id)
        if not mpgs:
            continue
        truck.mpg = Decimal(str(round(sum(mpgs) / len(mpgs), 1)))
        truck.mpg_at = now
        updated += 1
    await db.commit()
    logger.info("truck_mpg: company %s: %s truck(s) set to their average weekly Fuel-tab MPG", company_id, updated)
    return updated


async def update_all() -> None:
    """Scheduler job: every company with Peak ELD connected. Never raises."""
    from app.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        ids = (await db.execute(select(EldConnection.id))).scalars().all()
    for conn_id in ids:
        async with AsyncSessionLocal() as db:
            conn = await db.get(EldConnection, conn_id)
            if conn is None:
                continue
            try:
                await update(db, conn)
            except Exception:
                logger.exception("truck_mpg: company %s failed", conn.company_id)
