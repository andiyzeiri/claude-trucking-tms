"""
Equipment page MPG: each truck's Peak ELD miles over the last 90 days divided
by the gallons on its Fuel entries over the same 90 days. A long window evens
out fill-up timing (a tank bought on day 1 burned over the next week). Run
once a day; a truck without enough miles or fuel in the window keeps its MPG.
"""
import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Dict

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.eld_connection import EldConnection
from app.models.fuel import Fuel
from app.models.truck import Truck
from app.services import peak_eld, secret_box
from app.services.eld_match import TruckMatcher

logger = logging.getLogger(__name__)

WINDOW_DAYS = 90
MIN_MILES = 500
MIN_GALLONS = 50
SANE_MPG = (3.0, 15.0)  # outside this the miles or the fuel is incomplete


async def update(db: AsyncSession, conn: EldConnection) -> int:
    key = secret_box.decrypt(conn.api_key_encrypted)
    if not key:
        return 0
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=WINDOW_DAYS)
    vehicles, unit = await peak_eld.vehicles(key)
    # A week at a time, as the mileage report asks Peak.
    miles: Dict[str, float] = {}
    t = start
    while t < end:
        t2 = min(t + timedelta(days=7), end)
        for vid, m in (await peak_eld.miles_by_vehicle(key, int(t.timestamp() * 1000), int(t2.timestamp() * 1000), unit)).items():
            miles[vid] = miles.get(vid, 0.0) + m
        t = t2

    trucks = (await db.execute(
        select(Truck).where(Truck.company_id == conn.company_id, Truck.type == "truck")
    )).scalars().all()
    matcher = TruckMatcher(trucks, conn.truck_map)
    info = {str(v.get("id") or ""): v for v in vehicles}
    truck_miles: Dict[int, float] = {}
    for vid, m in miles.items():
        truck, _ = matcher.match(vid, info.get(vid) or {"vehicleId": vid})
        if truck is not None:
            truck_miles[truck.id] = truck_miles.get(truck.id, 0.0) + m

    gallons = dict((await db.execute(
        select(Fuel.truck_id, func.sum(Fuel.gallons))
        .where(Fuel.company_id == conn.company_id, Fuel.truck_id.isnot(None), Fuel.date >= start.date())
        .group_by(Fuel.truck_id)
    )).all())

    updated = 0
    skipped = {"miles": 0, "fuel": 0, "range": []}
    for truck in trucks:
        m, g = truck_miles.get(truck.id, 0.0), float(gallons.get(truck.id) or 0)
        if m < MIN_MILES:
            skipped["miles"] += 1
            continue
        if g < MIN_GALLONS:
            skipped["fuel"] += 1
            continue
        mpg = m / g
        if not SANE_MPG[0] <= mpg <= SANE_MPG[1]:
            skipped["range"].append(f"{truck.truck_number}: {m:.0f} mi / {g:.0f} gal")
            continue
        truck.mpg = Decimal(str(round(mpg, 1)))
        truck.mpg_at = end
        updated += 1
    await db.commit()
    logger.info("truck_mpg: company %s: %s of %s trucks updated; skipped - under %s ELD mi: %s, under %s gal: %s, "
                "outside %s-%s MPG: %s", conn.company_id, updated, len(trucks), MIN_MILES, skipped["miles"],
                MIN_GALLONS, skipped["fuel"], SANE_MPG[0], SANE_MPG[1], skipped["range"][:20])
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
            except peak_eld.PeakError as e:
                logger.warning("truck_mpg: company %s: %s", conn.company_id, e)
            except Exception:
                logger.exception("truck_mpg: company %s crashed", conn.company_id)
