"""
Fuel card feed (WEX Fleet One / EFS): connect to WEX's SFTP server, import
the daily transaction files into Fuel entries, and match cards to trucks.
See app/services/fuel_card_sync.py for how swipes become Fuel entries.
"""

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_active_user
from app.database import get_db
from app.models.fuel_card import FuelCardConnection, FuelCardTransaction
from app.models.truck import Truck
from app.models.user import User
from app.services import fuel_card_sync, secret_box, wex_sftp

router = APIRouter()

MAX_BACKFILL_DAYS = 400


class ConnectionOut(BaseModel):
    connected: bool
    provider: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    remote_dir: Optional[str] = None
    username: Optional[str] = None
    import_from: Optional[date] = None
    last_sync_at: Optional[datetime] = None
    last_sync_result: Optional[str] = None
    last_error: Optional[str] = None
    needs_truck: int = 0


class ConnectIn(BaseModel):
    host: str = Field(wex_sftp.DEFAULT_HOST, min_length=3, max_length=255, pattern=r"^[A-Za-z0-9.-]+$")
    port: int = Field(wex_sftp.DEFAULT_PORT, ge=1, le=65535)
    remote_dir: str = Field("/", max_length=255)
    username: str = Field(..., min_length=2, max_length=100)
    password: str = Field(..., min_length=1, max_length=200)
    import_from: date


class SyncOut(BaseModel):
    imported: int
    linked: int
    needs_truck: int
    not_fuel: int
    skipped: int
    files: int = 0
    connection: ConnectionOut


class TransactionOut(BaseModel):
    id: int
    external_id: str
    transaction_date: Optional[datetime] = None
    card_last6: Optional[str] = None
    unit: Optional[str] = None
    driver_prompt: Optional[str] = None
    location: Optional[str] = None
    fuel_gallons: Decimal
    fuel_amount: Decimal
    def_gallons: Decimal
    def_amount: Decimal
    other_items: Optional[str] = None
    net_total: Decimal
    status: str
    truck_id: Optional[int] = None
    truck_number: Optional[str] = None
    fuel_id: Optional[int] = None


class CardMapIn(BaseModel):
    card_last6: str = Field(..., min_length=4, max_length=6, pattern=r"^\d+$")
    truck_id: Optional[int] = None  # null = match by the UNIT prompt again


async def _connection(db: AsyncSession, company_id: int) -> Optional[FuelCardConnection]:
    return (await db.execute(
        select(FuelCardConnection).where(FuelCardConnection.company_id == company_id)
    )).scalar_one_or_none()


async def _out(db: AsyncSession, conn: Optional[FuelCardConnection]) -> ConnectionOut:
    if conn is None:
        return ConnectionOut(connected=False)
    waiting = (await db.execute(
        select(func.count()).select_from(FuelCardTransaction).where(
            FuelCardTransaction.company_id == conn.company_id, FuelCardTransaction.status == "needs_truck",
        )
    )).scalar() or 0
    return ConnectionOut(
        connected=True, provider=conn.provider, host=conn.host, port=conn.port, remote_dir=conn.remote_dir,
        username=conn.username, import_from=conn.import_from,
        last_sync_at=conn.last_sync_at, last_sync_result=conn.last_sync_result,
        last_error=conn.last_error, needs_truck=waiting,
    )


def _efs_http(e: wex_sftp.SftpError) -> HTTPException:
    return HTTPException(status_code=400 if e.auth else 502, detail=str(e))


@router.get("/connection", response_model=ConnectionOut)
async def get_connection(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return await _out(db, await _connection(db, current_user.company_id))


@router.put("/connection", response_model=SyncOut)
async def connect(
    body: ConnectIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Check the SFTP login, save it (password encrypted) and import files dated from import_from."""
    if body.import_from > date.today():
        raise HTTPException(status_code=400, detail="The import start date can't be in the future")
    if (date.today() - body.import_from).days > MAX_BACKFILL_DAYS:
        raise HTTPException(status_code=400, detail=f"Import at most {MAX_BACKFILL_DAYS} days back")
    username = body.username.strip()
    host = body.host.strip().lower()
    remote_dir = "/" + body.remote_dir.strip().strip("/") if body.remote_dir.strip().strip("/") else "/"
    try:
        await wex_sftp.check_login(host, body.port, username, body.password, remote_dir)
    except wex_sftp.SftpError as e:
        raise _efs_http(e)

    conn = await _connection(db, current_user.company_id)
    if conn is None:
        conn = FuelCardConnection(company_id=current_user.company_id, provider="wex_sftp", card_map={}, processed_files=[])
        db.add(conn)
    if conn.import_from and body.import_from < conn.import_from:
        conn.processed_files = []  # earlier start date: look at older files again
    conn.host, conn.port, conn.remote_dir = host, body.port, remote_dir
    conn.username = username
    conn.password_encrypted = secret_box.encrypt(body.password)
    conn.import_from = body.import_from
    conn.connected_by = current_user.id
    conn.last_error = None
    await db.commit()
    await db.refresh(conn)

    try:
        counts = await fuel_card_sync.sync(db, conn)
    except wex_sftp.SftpError as e:
        raise _efs_http(e)
    return SyncOut(**counts, connection=await _out(db, conn))


@router.delete("/connection", response_model=ConnectionOut)
async def disconnect(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Stop the feed. Fuel entries already imported stay, as do the swipe records (so a reconnect won't re-import)."""
    conn = await _connection(db, current_user.company_id)
    if conn is not None:
        await db.delete(conn)
        await db.commit()
    return ConnectionOut(connected=False)


@router.post("/sync", response_model=SyncOut)
async def sync_now(
    reread: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    conn = await _connection(db, current_user.company_id)
    if conn is None:
        raise HTTPException(status_code=409, detail="WEX fuel card isn't connected")
    try:
        counts = await fuel_card_sync.sync(db, conn, reread=reread)
    except wex_sftp.SftpError as e:
        raise _efs_http(e)
    return SyncOut(**counts, connection=await _out(db, conn))


@router.get("/transactions", response_model=List[TransactionOut])
async def list_transactions(
    status: Optional[str] = Query(None, pattern="^(imported|linked|needs_truck|not_fuel)$"),
    limit: int = Query(200, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    q = select(FuelCardTransaction, Truck.truck_number).outerjoin(Truck, Truck.id == FuelCardTransaction.truck_id).where(
        FuelCardTransaction.company_id == current_user.company_id
    )
    if status:
        q = q.where(FuelCardTransaction.status == status)
    q = q.order_by(FuelCardTransaction.transaction_date.desc().nullslast()).limit(limit)
    out = []
    for tx, truck_number in (await db.execute(q)).all():
        out.append(TransactionOut(
            id=tx.id, external_id=tx.external_id, transaction_date=tx.transaction_date,
            card_last6=tx.card_last6, unit=tx.unit, driver_prompt=tx.driver_prompt, location=tx.location,
            fuel_gallons=tx.fuel_gallons or 0, fuel_amount=tx.fuel_amount or 0,
            def_gallons=tx.def_gallons or 0, def_amount=tx.def_amount or 0,
            other_items=tx.other_items, net_total=tx.net_total or 0, status=tx.status,
            truck_id=tx.truck_id, truck_number=truck_number, fuel_id=tx.fuel_id,
        ))
    return out


@router.put("/card-map", response_model=ConnectionOut)
async def set_card_truck(
    body: CardMapIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Pin a card to a truck, then import that card's swipes that were waiting for one."""
    conn = await _connection(db, current_user.company_id)
    if conn is None:
        raise HTTPException(status_code=409, detail="WEX fuel card isn't connected")
    if body.truck_id is not None:
        truck = await db.get(Truck, body.truck_id)
        if truck is None or truck.company_id != current_user.company_id:
            raise HTTPException(status_code=404, detail="Truck not found")
    mapping = dict(conn.card_map or {})
    if body.truck_id is None:
        mapping.pop(body.card_last6, None)
    else:
        mapping[body.card_last6] = body.truck_id
    conn.card_map = mapping
    await db.commit()
    await fuel_card_sync.reprocess_waiting(db, conn)
    return await _out(db, conn)
