from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from app.database import get_db
from app.models.invoice import Invoice
from app.models.load import Load
from app.schemas.invoice import InvoiceCreate, InvoiceUpdate, InvoiceResponse
from app.core.security import get_current_active_user
from app.models.user import User
from app.services import accounting as gl

router = APIRouter()


@router.get("/", response_model=List[InvoiceResponse])
async def get_invoices(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # Join with loads to filter by company_id
    query = (
        select(Invoice)
        .join(Load)
        .where(Load.company_id == current_user.company_id)
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(query)
    invoices = result.scalars().all()
    return invoices


@router.post("/", response_model=InvoiceResponse)
async def create_invoice(
    invoice: InvoiceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # Verify the load belongs to the user's company
    load_query = select(Load).where(
        Load.id == invoice.load_id,
        Load.company_id == current_user.company_id
    )
    load_result = await db.execute(load_query)
    load = load_result.scalar_one_or_none()
    if not load:
        raise HTTPException(status_code=404, detail="Load not found")

    db_invoice = Invoice(**invoice.dict())
    db.add(db_invoice)
    await db.commit()
    await db.refresh(db_invoice)

    # Ledger: debit A/R, credit Revenue. Runs after the commit in its own
    # transaction and cannot fail the invoice.
    await gl.auto_post_safe(
        company_id=current_user.company_id,
        event_key="invoice",
        source_id=db_invoice.id,
        amount=db_invoice.total_amount,
        entry_date=db_invoice.issue_date,
        memo=f"Invoice {db_invoice.invoice_number}",
        user_id=current_user.id,
    )
    return db_invoice


@router.get("/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = (
        select(Invoice)
        .join(Load)
        .where(
            Invoice.id == invoice_id,
            Load.company_id == current_user.company_id
        )
    )
    result = await db.execute(query)
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@router.put("/{invoice_id}", response_model=InvoiceResponse)
async def update_invoice(
    invoice_id: int,
    invoice_update: InvoiceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = (
        select(Invoice)
        .join(Load)
        .where(
            Invoice.id == invoice_id,
            Load.company_id == current_user.company_id
        )
    )
    result = await db.execute(query)
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # If updating load_id, verify the new load belongs to the user's company
    if invoice_update.load_id is not None:
        load_query = select(Load).where(
            Load.id == invoice_update.load_id,
            Load.company_id == current_user.company_id
        )
        load_result = await db.execute(load_query)
        load = load_result.scalar_one_or_none()
        if not load:
            raise HTTPException(status_code=404, detail="Load not found")

    for field, value in invoice_update.dict(exclude_unset=True).items():
        setattr(invoice, field, value)

    await db.commit()
    await db.refresh(invoice)

    # Ledger: if the amount or date moved, the old entry is reversed and a
    # corrected one posted. Unchanged invoices are a no-op.
    await gl.auto_post_safe(
        company_id=current_user.company_id,
        event_key="invoice",
        source_id=invoice.id,
        amount=invoice.total_amount,
        entry_date=invoice.issue_date,
        memo=f"Invoice {invoice.invoice_number}",
        user_id=current_user.id,
    )
    return invoice


@router.delete("/{invoice_id}")
async def delete_invoice(
    invoice_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = (
        select(Invoice)
        .join(Load)
        .where(
            Invoice.id == invoice_id,
            Load.company_id == current_user.company_id
        )
    )
    result = await db.execute(query)
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Capture before the row is gone.
    deleted_id = invoice.id
    issue_date = invoice.issue_date

    await db.delete(invoice)
    await db.commit()

    # Ledger: reverse the entry rather than deleting it. The original
    # posting stays on the books; the reversal cancels it.
    await gl.auto_post_safe(
        company_id=current_user.company_id,
        event_key="invoice",
        source_id=deleted_id,
        amount=None,
        entry_date=issue_date,
        memo=f"Invoice #{deleted_id} deleted",
        user_id=current_user.id,
    )
    return {"message": "Invoice deleted successfully"}