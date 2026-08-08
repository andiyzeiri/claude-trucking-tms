"""
Emailed reports: recipient lists and on-demand sending.

Admin-only throughout. Sending mail from the company's address is an abuse
vector, so it is not exposed to dispatchers or viewers.
"""

import logging
from datetime import date as date_type
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.security import get_current_admin_user
from app.models.user import User
from app.models.report_recipient import ReportRecipient, REPORT_KEYS, REPORT_LABELS
from app.services import weekly_trips_report as wtr
from app.services.email import EmailService

logger = logging.getLogger(__name__)

router = APIRouter()


# --------------------------------------------------------------------------
# Schemas
# --------------------------------------------------------------------------

class RecipientCreate(BaseModel):
    report_key: str = Field(..., description="Which report this address receives")
    email: EmailStr
    name: Optional[str] = None
    is_active: bool = True


class RecipientUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None


class RecipientResponse(BaseModel):
    id: int
    report_key: str
    email: str
    name: Optional[str] = None
    is_active: bool
    company_id: int

    class Config:
        from_attributes = True


class SendResult(BaseModel):
    sent: int
    failed: int
    recipients: List[str]
    transport: str
    subject: str
    # True when nothing actually left the building because no transport is
    # configured. The UI surfaces this rather than claiming success.
    delivered: bool


def _validate_key(report_key: str) -> None:
    if report_key not in REPORT_KEYS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown report '{report_key}'. Valid: {', '.join(REPORT_KEYS)}",
        )


# --------------------------------------------------------------------------
# Recipients
# --------------------------------------------------------------------------

@router.get("/recipients", response_model=List[RecipientResponse])
async def list_recipients(
    report_key: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    query = select(ReportRecipient).where(
        ReportRecipient.company_id == current_user.company_id
    )
    if report_key:
        _validate_key(report_key)
        query = query.where(ReportRecipient.report_key == report_key)
    result = await db.execute(query.order_by(ReportRecipient.email))
    return result.scalars().all()


@router.post("/recipients", response_model=RecipientResponse, status_code=status.HTTP_201_CREATED)
async def add_recipient(
    payload: RecipientCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    _validate_key(payload.report_key)

    email = payload.email.lower().strip()
    existing = await db.execute(
        select(ReportRecipient).where(
            and_(
                ReportRecipient.company_id == current_user.company_id,
                ReportRecipient.report_key == payload.report_key,
                ReportRecipient.email == email,
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail=f"{email} already receives {REPORT_LABELS.get(payload.report_key, payload.report_key)}",
        )

    recipient = ReportRecipient(
        report_key=payload.report_key,
        email=email,
        name=payload.name,
        is_active=payload.is_active,
        company_id=current_user.company_id,
    )
    db.add(recipient)
    await db.commit()
    await db.refresh(recipient)
    return recipient


@router.patch("/recipients/{recipient_id}", response_model=RecipientResponse)
async def update_recipient(
    recipient_id: int,
    payload: RecipientUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    result = await db.execute(
        select(ReportRecipient).where(
            and_(
                ReportRecipient.id == recipient_id,
                ReportRecipient.company_id == current_user.company_id,
            )
        )
    )
    recipient = result.scalar_one_or_none()
    if recipient is None:
        raise HTTPException(status_code=404, detail="Recipient not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(recipient, field, value)

    await db.commit()
    await db.refresh(recipient)
    return recipient


@router.delete("/recipients/{recipient_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recipient(
    recipient_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    result = await db.execute(
        select(ReportRecipient).where(
            and_(
                ReportRecipient.id == recipient_id,
                ReportRecipient.company_id == current_user.company_id,
            )
        )
    )
    recipient = result.scalar_one_or_none()
    if recipient is None:
        raise HTTPException(status_code=404, detail="Recipient not found")
    await db.delete(recipient)
    await db.commit()


# --------------------------------------------------------------------------
# Weekly trips
# --------------------------------------------------------------------------

@router.get("/weekly-trips/preview")
async def preview_weekly_trips(
    week_start: Optional[date_type] = Query(None, description="Any date in the week"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Render the report without sending it, so it can be checked first."""
    week_start = week_start or date_type.today()
    report = await wtr.build_weekly_trips(db, current_user.company_id, week_start)
    return {
        "subject": wtr.render_subject(report),
        "html": wtr.render_html(report),
        "text": wtr.render_text(report),
        "week_start": report["week_start"],
        "week_end": report["week_end"],
        "total_trips": report["total_trips"],
        "total_miles": report["total_miles"],
        "total_revenue": report["total_revenue"],
        "rpm": report["rpm"],
        "driver_count": len(report["groups"]),
    }


@router.post("/weekly-trips/send", response_model=SendResult)
async def send_weekly_trips(
    week_start: Optional[date_type] = Query(None, description="Any date in the week"),
    to: Optional[str] = Query(None, description="Override: send to this address only"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    week_start = week_start or date_type.today()
    report = await wtr.build_weekly_trips(db, current_user.company_id, week_start)

    if to:
        addresses = [to.lower().strip()]
    else:
        result = await db.execute(
            select(ReportRecipient).where(
                and_(
                    ReportRecipient.company_id == current_user.company_id,
                    ReportRecipient.report_key == "weekly_trips",
                    ReportRecipient.is_active.is_(True),
                )
            )
        )
        addresses = [r.email for r in result.scalars().all()]

    if not addresses:
        raise HTTPException(
            status_code=400,
            detail="No active recipients for Weekly Trips. Add one first.",
        )

    service = EmailService()
    transport = service.resolve_transport()
    subject = wtr.render_subject(report)
    html = wtr.render_html(report)
    text = wtr.render_text(report)

    sent, failed = 0, 0
    for address in addresses:
        ok = await service.send_email(address, subject, html, text)
        if ok:
            sent += 1
        else:
            failed += 1

    logger.info(
        "weekly trips report: company=%s week=%s transport=%s sent=%s failed=%s",
        current_user.company_id, report["week_start"], transport, sent, failed,
    )

    return SendResult(
        sent=sent,
        failed=failed,
        recipients=addresses,
        transport=transport,
        subject=subject,
        # In console mode send_email returns True after merely logging, so
        # 'sent' would otherwise imply delivery that never happened.
        delivered=transport != "console",
    )
