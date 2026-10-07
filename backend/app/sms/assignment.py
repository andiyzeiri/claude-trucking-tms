"""
Text a driver the load details when an AI load (Loads AI page) is assigned
to them. Manually entered loads never trigger a text.

Called as a FastAPI background task after the load is saved, so the
dispatcher never waits on Twilio. Follows the same switches as POD
reminders (POD_REMINDERS_ENABLED / POD_REMINDERS_DRY_RUN act as the
driver-texting master switch and dry-run), plus LOAD_ASSIGNMENT_TEXTS_ENABLED.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select

from app.config import settings
from app.models.driver import Driver
from app.models.loads_ai import LIVE_AI_LOAD_STATUSES, IngestedDocument
from app.models.sms import LoadSmsMessage, SmsKind
from app.sms.ai_loads import view as ai_view
from app.sms.pod_reminders import load_label
from app.sms.util import delivery_tz, to_e164, wall_clock_to_utc

logger = logging.getLogger(__name__)


def _day(value: Optional[datetime]) -> Optional[str]:
    return value.strftime("%a %m/%d") if value else None


def _clock(value: Optional[datetime]) -> Optional[str]:
    if not value or (value.hour == 0 and value.minute == 0):
        return None
    return value.strftime("%I:%M %p").lstrip("0")


def _when(value: Optional[datetime], window: Optional[str]) -> str:
    """'Wed 10/07, 8:00 AM - 3:00 PM' - the printed window beats a single clock time."""
    day = _day(value)
    if not day:
        return "Date: not on the rate con - check with dispatch"
    time = (window or "").strip() or _clock(value)
    return f"{day}, {time}" if time else f"{day} (no time given)"


def assignment_text(load) -> str:
    """
    Everything the driver needs to run the load, as plain lines:

      Absolute Trucking: Load 132005652 is assigned to you.

      PICKUP - Schroeders Pallet
      7333 S Lockwood Ave, Bedford Park, IL 60638
      Wed 10/07, 8:00 AM - 3:00 PM
      PU#: 55821

      DELIVERY - Professional Pallet
      160 Brown St, Lawrenceburg, IN 47025
      Date: not on the rate con - check with dispatch

      Pallets, 25,000 lb
      Notes: Check in at gate 3
      Reply STOP to opt out.
    """
    def stop(title, name, location, when, number, number_label):
        out = [f"{title}" + (f" - {name}" if name else "")]
        out.append(location or "Address: check with dispatch")
        out.append(when)
        if number:
            out.append(f"{number_label}: {number}")
        return out

    lines = [f"Absolute Trucking: Load {load_label(load)} is assigned to you.", ""]
    lines += stop("PICKUP", load.shipper_name, load.pickup_location,
                  _when(load.pickup_date, load.pickup_window), load.pickup_number, "PU#")
    lines.append("")
    lines += stop("DELIVERY", load.receiver_name, load.delivery_location,
                  _when(load.delivery_date, load.delivery_window), load.delivery_number, "DEL#")
    lines.append("")
    refs = [f"{k} {v}" for k, v in (("PO", load.po_number), ("BOL", load.bol_number)) if v]
    freight = ", ".join(x for x in (load.commodity, f"{load.weight} lb" if load.weight and "lb" not in str(load.weight).lower() else load.weight) if x)
    if freight:
        lines.append(freight)
    if refs:
        lines.append(" / ".join(refs))
    notes = (getattr(load, "notes", None) or "").strip()
    instructions = (getattr(load, "instructions", None) or "").strip()
    if notes:
        lines.append(f"Ref #s: {notes[:300]}")
    if instructions and instructions != notes:
        lines.append(f"Instructions: {instructions[:300]}")
    elif not notes and load.pickup_notes:
        lines.append(f"Notes: {load.pickup_notes.strip()[:300]}")
    lines.append("Reply STOP to opt out.")
    return "\n".join(lines)


async def notify_ai_load_assigned(ai_load_id: int, driver_id: int) -> None:
    """Background task: owns its own session and never raises."""
    from app.database import AsyncSessionLocal

    s = settings
    if not (s.POD_REMINDERS_ENABLED and s.LOAD_ASSIGNMENT_TEXTS_ENABLED and s.POD_REMINDERS_COMPANY_ID):
        return
    try:
        async with AsyncSessionLocal() as db:
            doc = await db.get(IngestedDocument, ai_load_id)
            driver = await db.get(Driver, driver_id)
            if (
                not doc or not driver
                or doc.company_id != s.POD_REMINDERS_COMPANY_ID
                or driver.company_id != doc.company_id
                or doc.status not in LIVE_AI_LOAD_STATUSES
            ):
                return
            load = ai_view(doc)
            if load.driver_id != driver_id:
                return

            now = datetime.now(timezone.utc)
            # Loads are often dispatched in the TMS after they've moved; only
            # stay quiet for old loads being filled in for records.
            if load.delivery_date and wall_clock_to_utc(load.delivery_date, delivery_tz(load.delivery_location)) < now - timedelta(days=2):
                logger.info("load-assigned: AI load %s delivered over 2 days ago; not texting", doc.id)
                return
            if driver.sms_opt_out:
                logger.info("load-assigned: driver %s opted out; not texting", driver.id)
                return
            phone = to_e164(driver.phone)
            if not phone:
                logger.info("load-assigned: driver %s has no textable phone (%r)", driver.id, driver.phone)
                return

            # A double save (or quick re-assign back and forth) shouldn't text twice.
            recent = await db.execute(
                select(LoadSmsMessage.id).where(
                    LoadSmsMessage.ai_load_id == doc.id,
                    LoadSmsMessage.driver_id == driver.id,
                    LoadSmsMessage.kind == SmsKind.LOAD_ASSIGNED,
                    LoadSmsMessage.status != "failed",
                    LoadSmsMessage.created_at >= now - timedelta(minutes=10),
                )
            )
            if recent.first():
                return

            body = assignment_text(load)
            if s.POD_REMINDERS_DRY_RUN:
                logger.info("load-assigned: WOULD TEXT %s %s %s about AI load %s: %r",
                            driver.first_name, driver.last_name, phone, load_label(load), body)
                return

            from app.services.twilio_service import get_twilio_service

            result = await get_twilio_service().send_sms(phone, body)
            ok = bool(result.get("success"))
            db.add(LoadSmsMessage(
                company_id=doc.company_id, ai_load_id=doc.id, driver_id=driver.id, direction="out",
                kind=SmsKind.LOAD_ASSIGNED, phone=phone, body=body, created_at=now,
                twilio_sid=result.get("message_sid"),
                status=(result.get("status") or "sent") if ok else "failed",
                error=None if ok else str(result.get("error"))[:1000],
            ))
            if not ok and result.get("error_code") == 21610:
                driver.sms_opt_out = True
            await db.commit()
            logger.info("load-assigned: texted driver %s about AI load %s (ok=%s)", driver.id, load_label(load), ok)
    except Exception:
        logger.exception("load-assigned: failed for AI load %s", ai_load_id)
