"""
Pull fuel card transactions (WEX Fleet One / EFS) into the Fuel table.

WEX drops a transaction file on its SFTP server each day (wex_sftp.py); new
files are downloaded, parsed (efs_files.py) and their swipes imported.

Each swipe is recorded once in fuel_card_transactions (unique per provider
transaction id). Swipes with diesel or DEF become Fuel entries on a truck, so
they show on the Fuel page and come out of the driver's pay through the
Payroll page's Fuel row, exactly like entries typed in by hand:
  total_amount = diesel dollars, def_gallons / def_price = DEF gallons / DEF dollars
(def_price holds DEF dollars - that's how the Fuel page and payroll use it).

Truck: the card's pinned truck (card_map) if set, else the UNIT prompt keyed
at the pump matched to a truck number. No match -> "needs_truck", imported as
soon as the card is matched in Settings.

If an entry for the same truck and day with (nearly) the same diesel amount
was already typed in by hand, the swipe is linked to it instead of creating a
second one.
"""

import logging
import re
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fuel import Fuel
from app.models.fuel_card import FuelCardConnection, FuelCardTransaction
from app.models.truck import Truck
from app.services import accounting as gl
from app.services import efs_files, secret_box, wex_sftp

logger = logging.getLogger(__name__)

LINK_TOLERANCE = Decimal("1.00")


def norm_unit(s: Optional[str]) -> str:
    """"Truck #0101" and "101" both -> "101"."""
    s = re.sub(r"[^a-z0-9]", "", (s or "").lower())
    s = re.sub(r"^(truck|unit|trk)", "", s)
    return s.lstrip("0")


class _Trucks:
    def __init__(self, trucks: List[Truck], card_map: Dict[str, int]):
        self.by_id = {t.id: t for t in trucks}
        self.by_unit: Dict[str, Truck] = {}
        for t in trucks:
            self.by_unit.setdefault(norm_unit(t.truck_number), t)
        self.card_map = card_map or {}

    def resolve(self, card_last6: Optional[str], unit: Optional[str]) -> Optional[Truck]:
        pinned = self.card_map.get(card_last6 or "")
        if pinned:
            return self.by_id.get(int(pinned))
        return self.by_unit.get(norm_unit(unit)) if unit and norm_unit(unit) else None


async def _make_fuel(db: AsyncSession, company_id: int, tx: FuelCardTransaction, truck: Truck, created: List[Fuel]) -> str:
    """Create (or link to) the Fuel entry for a swipe; returns the new status."""
    day = tx.transaction_date.date() if tx.transaction_date else date.today()
    fuel_amount = Decimal(tx.fuel_amount or 0)

    candidates = (await db.execute(
        select(Fuel).where(Fuel.company_id == company_id, Fuel.truck_id == truck.id, Fuel.date == day)
    )).scalars().all()
    taken = set((await db.execute(
        select(FuelCardTransaction.fuel_id).where(
            FuelCardTransaction.company_id == company_id, FuelCardTransaction.fuel_id.in_([c.id for c in candidates] or [0])
        )
    )).scalars().all())
    for c in candidates:
        if c.id not in taken and abs(Decimal(c.total_amount or 0) - fuel_amount) <= LINK_TOLERANCE:
            tx.fuel_id, tx.truck_id = c.id, truck.id
            return "linked"

    gallons = Decimal(tx.fuel_gallons or 0)
    notes = f"WEX card ...{tx.card_last6} · transaction {tx.external_id}"
    if tx.other_items:
        notes += f" · also on receipt: {tx.other_items}"
    fuel = Fuel(
        company_id=company_id,
        date=day,
        location=tx.location,
        gallons=gallons.quantize(Decimal("0.01")),
        price_per_gallon=(fuel_amount / gallons).quantize(Decimal("0.001")) if gallons else None,
        def_gallons=Decimal(tx.def_gallons).quantize(Decimal("0.01")) if tx.def_gallons else None,
        def_price=Decimal(tx.def_amount) if tx.def_amount else None,
        total_amount=fuel_amount,
        odometer=tx.odometer,
        notes=notes,
        truck_id=truck.id,
        driver_id=truck.current_driver_id,
    )
    db.add(fuel)
    await db.flush()
    tx.fuel_id, tx.truck_id = fuel.id, truck.id
    created.append(fuel)  # posted to the ledger after the commit
    return "imported"


async def _post_ledger(created: List[Fuel]) -> None:
    """Ledger: debit Fuel Expense, credit Cash/AP - same as a hand-entered receipt. After commit only."""
    for fuel in created:
        await gl.auto_post_safe(
            company_id=fuel.company_id, event_key="fuel", source_id=fuel.id,
            amount=fuel.total_amount, entry_date=fuel.date,
            memo=f"Fuel purchase #{fuel.id} (WEX card)", user_id=None,
        )


async def _process(db: AsyncSession, company_id: int, tx: FuelCardTransaction, trucks: _Trucks, created: List[Fuel]) -> None:
    if not (tx.fuel_gallons or tx.def_gallons):
        tx.status = "not_fuel"
        return
    truck = trucks.resolve(tx.card_last6, tx.unit)
    if truck is None:
        tx.status = "needs_truck"
        return
    tx.status = await _make_fuel(db, company_id, tx, truck, created)


async def _trucks(db: AsyncSession, conn: FuelCardConnection) -> _Trucks:
    rows = (await db.execute(
        select(Truck).where(Truck.company_id == conn.company_id, Truck.type == "truck")
    )).scalars().all()
    return _Trucks(rows, conn.card_map or {})


MAX_REMEMBERED_FILES = 1000


async def sync(db: AsyncSession, conn: FuelCardConnection, reread: bool = False) -> Dict[str, int]:
    """Download transaction files not imported yet (dated on/after import_from) and import their swipes.

    reread=True looks at every file again; swipes already imported are still skipped.
    """
    counts = {"imported": 0, "linked": 0, "needs_truck": 0, "not_fuel": 0, "skipped": 0, "files": 0}
    password = secret_box.decrypt(conn.password_encrypted)
    if not password:
        raise wex_sftp.SftpError("The saved WEX SFTP password can't be read - reconnect in Settings", auth=True)

    done = set() if reread else set(conn.processed_files or [])
    try:
        # A day's file holds that day's swipes; one day early in case of time zones.
        files, _ = await wex_sftp.fetch_new_files(
            conn.host, conn.port, conn.username, password, conn.remote_dir,
            since=conn.import_from - timedelta(days=1), done=done,
        )
    except wex_sftp.SftpError as e:
        conn.last_error = str(e)[:255]
        conn.last_sync_at = datetime.now(timezone.utc)
        await db.commit()
        raise

    swipes: List[efs_files.CardTransaction] = []
    bad_files: List[str] = []
    for remote, data in files:
        try:
            swipes.extend(efs_files.parse_file(data))
        except Exception as e:
            logger.warning("fuel_card_sync: can't read %s: %s", remote.path, e)
            bad_files.append(remote.name)
    counts["files"] = len(files) - len(bad_files)

    known = set((await db.execute(
        select(FuelCardTransaction.external_id).where(
            FuelCardTransaction.company_id == conn.company_id, FuelCardTransaction.provider == conn.provider,
            FuelCardTransaction.external_id.in_([s.transaction_id for s in swipes] or [""]),
        )
    )).scalars().all())
    trucks = await _trucks(db, conn)
    created: List[Fuel] = []

    for s in swipes:
        if s.transaction_id in known or (s.transaction_date and s.transaction_date.date() < conn.import_from):
            counts["skipped"] += 1
            continue
        tx = FuelCardTransaction(
            company_id=conn.company_id, provider=conn.provider, external_id=s.transaction_id,
            transaction_date=s.transaction_date.replace(tzinfo=None) if s.transaction_date else None,
            card_last6=s.card_last6, unit=(s.unit or "")[:40] or None,
            driver_prompt=(s.driver_prompt or "")[:60] or None, odometer=s.odometer,
            location=s.location, fuel_gallons=s.fuel_gallons, fuel_amount=s.fuel_amount,
            def_gallons=s.def_gallons, def_amount=s.def_amount, other_amount=s.other_amount,
            other_items=", ".join(s.other_items)[:255] or None, net_total=s.net_total, status="needs_truck",
        )
        n_before = len(created)
        try:
            async with db.begin_nested():  # a parallel sync may have just taken it
                db.add(tx)
                await db.flush()
                await _process(db, conn.company_id, tx, trucks, created)
                await db.flush()
        except IntegrityError:
            del created[n_before:]
            counts["skipped"] += 1
            continue
        counts[tx.status] += 1

    remembered = list(conn.processed_files or [])
    for remote, _ in files:
        if remote.name not in bad_files and remote.key not in remembered:
            remembered.append(remote.key)
    conn.processed_files = remembered[-MAX_REMEMBERED_FILES:]
    conn.last_sync_at = datetime.now(timezone.utc)
    conn.last_error = f"Couldn't read {', '.join(bad_files)}"[:255] if bad_files else None
    conn.last_sync_result = (
        f"{counts['files']} new file{'s' if counts['files'] != 1 else ''}: {counts['imported']} imported, "
        f"{counts['linked']} matched to entries already typed in, {counts['needs_truck']} need a truck"
    )
    await db.commit()
    await _post_ledger(created)
    return counts


async def reprocess_waiting(db: AsyncSession, conn: FuelCardConnection) -> int:
    """Import swipes that were waiting for a truck (after a card is matched)."""
    waiting = (await db.execute(
        select(FuelCardTransaction).where(
            FuelCardTransaction.company_id == conn.company_id, FuelCardTransaction.status == "needs_truck",
        )
    )).scalars().all()
    trucks = await _trucks(db, conn)
    created: List[Fuel] = []
    done = 0
    for tx in waiting:
        await _process(db, conn.company_id, tx, trucks, created)
        if tx.status != "needs_truck":
            done += 1
    await db.commit()
    await _post_ledger(created)
    return done


class TruckChoiceError(ValueError):
    """A truck change a person has to fix (shown as is)."""


async def _move(db: AsyncSession, company_id: int, tx: FuelCardTransaction, truck: Truck, created: List[Fuel]) -> None:
    """Put a swipe - and the Fuel entry it became - on `truck`."""
    if tx.status == "needs_truck":
        tx.status = await _make_fuel(db, company_id, tx, truck, created)
        return
    tx.truck_id = truck.id
    if tx.fuel_id:
        fuel = await db.get(Fuel, tx.fuel_id)
        if fuel is not None and fuel.company_id == company_id:
            fuel.truck_id = truck.id
            fuel.driver_id = truck.current_driver_id


async def set_transaction_truck(db: AsyncSession, conn: FuelCardConnection, tx: FuelCardTransaction,
                                truck_id: Optional[int]) -> None:
    """
    One swipe on a chosen truck (e.g. two trucks sharing a card), or with
    truck_id None back on the card's truck. Moves its Fuel entry too, so the
    Fuel page and payroll follow.
    """
    if tx.status == "not_fuel":
        raise TruckChoiceError("This transaction has no fuel or DEF on it")
    trucks = await _trucks(db, conn)
    if truck_id is None:
        truck = trucks.resolve(tx.card_last6, tx.unit)
        if truck is None:
            raise TruckChoiceError("This card has no truck yet - assign the card a truck first")
        tx.manual_truck = False
    else:
        truck = trucks.by_id.get(truck_id)
        if truck is None:
            raise TruckChoiceError("Truck not found")
        tx.manual_truck = True
    created: List[Fuel] = []
    await _move(db, conn.company_id, tx, truck, created)
    await db.commit()
    await _post_ledger(created)


async def apply_card_truck(db: AsyncSession, conn: FuelCardConnection, card_last6: str) -> int:
    """After a card's truck changes: move its earlier swipes (not ones set by hand) to it."""
    trucks = await _trucks(db, conn)
    rows = (await db.execute(
        select(FuelCardTransaction).where(
            FuelCardTransaction.company_id == conn.company_id,
            FuelCardTransaction.card_last6 == card_last6,
            FuelCardTransaction.manual_truck.is_(False),
            FuelCardTransaction.status.in_(("imported", "linked")),
        )
    )).scalars().all()
    created: List[Fuel] = []
    moved = 0
    for tx in rows:
        truck = trucks.resolve(tx.card_last6, tx.unit)
        if truck is not None and truck.id != tx.truck_id:
            await _move(db, conn.company_id, tx, truck, created)
            moved += 1
    await db.commit()
    return moved


async def sync_all() -> None:
    """Scheduler job: sync every connected company. Never raises."""
    from app.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        ids = (await db.execute(select(FuelCardConnection.id))).scalars().all()
    for conn_id in ids:
        async with AsyncSessionLocal() as db:
            conn = await db.get(FuelCardConnection, conn_id)
            if conn is None:
                continue
            try:
                counts = await sync(db, conn)
                logger.info("fuel_card_sync: company %s %s", conn.company_id, counts)
            except wex_sftp.SftpError as e:
                logger.warning("fuel_card_sync: company %s failed: %s", conn.company_id, e)
            except Exception:
                logger.exception("fuel_card_sync: company %s crashed", conn.company_id)
