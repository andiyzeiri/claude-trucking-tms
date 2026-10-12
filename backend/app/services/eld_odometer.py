"""
Record each truck's live odometer from Peak ELD, so Total Miles for a week is
the odometer at the end of the week minus the odometer at its start - the
same as reading the first and last log events by hand.

Peak's Open API has no log-event history, only the current odometer
(/api/v0/locations), so it is recorded every few minutes from the moment the
feature is on (EldConnection.odometer_since). A week that started before then
falls back to inspection (DVIR) odometers in app/services/peak_eld.py.

A reading is stored once per ELD location time: a parked truck with its ELD
asleep keeps the same reading, which stays correct because the odometer
hasn't moved either.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional

from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.eld_connection import EldConnection, EldOdometerReading
from app.services import peak_eld, secret_box

logger = logging.getLogger(__name__)

KEEP_DAYS = 400


async def record(db: AsyncSession, conn: EldConnection) -> int:
    """Store the current odometer of every truck; returns how many new readings."""
    key = secret_box.decrypt(conn.api_key_encrypted)
    if not key:
        return 0
    _, unit = await peak_eld.vehicles(key)
    readings = await peak_eld.live_odometers(key, unit)
    rows = [
        {
            "company_id": conn.company_id, "eld_vehicle_id": vid[:64],
            "recorded_at": datetime.fromtimestamp(ms / 1000, timezone.utc), "odometer": round(odo, 1),
        }
        for vid, ms, odo in readings
    ]
    added = 0
    if rows:
        result = await db.execute(
            insert(EldOdometerReading).values(rows).on_conflict_do_nothing(constraint="uq_eld_odometer_reading")
        )
        added = result.rowcount or 0
    if conn.odometer_since is None:
        conn.odometer_since = datetime.now(timezone.utc)
    await db.commit()
    return added


async def record_all() -> None:
    """Scheduler job: record odometers for every connected company. Never raises."""
    from app.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        ids = (await db.execute(select(EldConnection.id))).scalars().all()
        await db.execute(
            text("DELETE FROM eld_odometer_readings WHERE recorded_at < :cutoff"),
            {"cutoff": datetime.now(timezone.utc) - timedelta(days=KEEP_DAYS)},
        )
        await db.commit()
    for conn_id in ids:
        async with AsyncSessionLocal() as db:
            conn = await db.get(EldConnection, conn_id)
            if conn is None:
                continue
            try:
                await record(db, conn)
            except peak_eld.PeakError as e:
                logger.warning("eld_odometer: company %s: %s", conn.company_id, e)
            except Exception:
                logger.exception("eld_odometer: company %s crashed", conn.company_id)


async def spans(db: AsyncSession, conn: EldConnection, start: datetime, end: datetime) -> Dict[str, dict]:
    """Peak vehicle id -> odometer at `start` and at `end`, from recorded readings.

    Only when recording had started by `start`. The start reading is the last
    one at or before `start` (or the first one in the week, for a truck that
    first reported mid-week); the end reading is the last one at or before `end`.
    """
    if conn.odometer_since is None or conn.odometer_since > start:
        return {}
    params = {"c": conn.company_id, "s": start, "e": end}
    before_start = (await db.execute(text("""
        SELECT DISTINCT ON (eld_vehicle_id) eld_vehicle_id, recorded_at, odometer
        FROM eld_odometer_readings WHERE company_id = :c AND recorded_at <= :s
        ORDER BY eld_vehicle_id, recorded_at DESC
    """), params)).all()
    first_in = (await db.execute(text("""
        SELECT DISTINCT ON (eld_vehicle_id) eld_vehicle_id, recorded_at, odometer
        FROM eld_odometer_readings WHERE company_id = :c AND recorded_at > :s AND recorded_at <= :e
        ORDER BY eld_vehicle_id, recorded_at ASC
    """), params)).all()
    at_end = (await db.execute(text("""
        SELECT DISTINCT ON (eld_vehicle_id) eld_vehicle_id, recorded_at, odometer
        FROM eld_odometer_readings WHERE company_id = :c AND recorded_at <= :e
        ORDER BY eld_vehicle_id, recorded_at DESC
    """), params)).all()

    starts = {r.eld_vehicle_id: r for r in first_in}
    starts.update({r.eld_vehicle_id: r for r in before_start})  # a reading before the week wins
    out: Dict[str, dict] = {}
    for r in at_end:
        s: Optional[object] = starts.get(r.eld_vehicle_id)
        if s is None or r.odometer < s.odometer:
            continue
        out[r.eld_vehicle_id] = {
            "start_time": s.recorded_at, "start_odometer": round(float(s.odometer)),
            "end_time": r.recorded_at, "end_odometer": round(float(r.odometer)),
            "miles": round(float(r.odometer - s.odometer), 1),
        }
    return out
