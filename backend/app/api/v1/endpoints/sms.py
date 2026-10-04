"""
Inbound driver texts (Twilio webhook).

Configured in the Twilio console on the Messaging Service:
    Incoming messages -> Send a webhook -> POST https://absolutetms.com/api/v1/sms/inbound

A photo or PDF reply is saved to S3 and set as the POD on the load the
driver was last texted about; a plain text reply is appended to that load's
delivery notes. STOP / START keep drivers.sms_opt_out in step with Twilio's
own opt-out handling (Twilio blocks sends to opted-out numbers regardless).
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.database import get_db
from app.models.driver import Driver
from app.models.load import Load
from app.models.sms import POD_PROMPT_KINDS, LoadSmsMessage, SmsKind
from app.services.s3 import s3_service
from app.sms.pod_reminders import ack_text
from app.sms.util import delivery_tz, to_e164

logger = logging.getLogger(__name__)
router = APIRouter()

STOP_WORDS = {"STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "REVOKE", "OPTOUT"}
START_WORDS = {"START", "UNSTOP", "YES", "OPTIN"}
MAX_MEDIA_BYTES = 10 * 1024 * 1024
MEDIA_EXT = {"image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/heic": "heic",
             "image/heif": "heif", "image/webp": "webp", "image/gif": "gif", "application/pdf": "pdf"}

EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'


def _twiml() -> Response:
    return Response(content=EMPTY_TWIML, media_type="text/xml")


def _download_media(url: str) -> tuple[bytes, str]:
    """Twilio media URLs require the account credentials; they redirect to storage."""
    import requests

    r = requests.get(url, auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
                     timeout=20, allow_redirects=True, stream=True)
    r.raise_for_status()
    data = r.raw.read(MAX_MEDIA_BYTES + 1, decode_content=True)
    if len(data) > MAX_MEDIA_BYTES:
        raise ValueError("media too large")
    return data, (r.headers.get("Content-Type") or "").split(";")[0].strip().lower()


async def _target_load(db: AsyncSession, company_id: int, phone: str) -> Optional[Load]:
    """The load this driver was most recently asked about; prefer one still missing its POD."""
    recent = (
        await db.execute(
            select(LoadSmsMessage.load_id)
            .where(
                LoadSmsMessage.company_id == company_id,
                LoadSmsMessage.phone == phone,
                LoadSmsMessage.direction == "out",
                # Drivers often reply to the assignment text with the POD
                # once they've delivered, so that counts as well.
                LoadSmsMessage.kind.in_(POD_PROMPT_KINDS + (SmsKind.LOAD_ASSIGNED,)),
                LoadSmsMessage.load_id.isnot(None),
            )
            .order_by(LoadSmsMessage.created_at.desc())
            .limit(10)
        )
    ).scalars().all()
    loads: List[Load] = []
    for load_id in dict.fromkeys(recent):  # keep order, drop repeats
        load = await db.get(Load, load_id)
        if load is not None and load.company_id == company_id:
            loads.append(load)
    for load in loads:
        if not load.pod_url:
            return load
    return loads[0] if loads else None


@router.post("/inbound")
async def twilio_inbound(request: Request, db: AsyncSession = Depends(get_db)):
    if not settings.TWILIO_AUTH_TOKEN or not settings.POD_REMINDERS_COMPANY_ID:
        raise HTTPException(status_code=503, detail="SMS is not configured")

    form = await request.form()
    params = {k: v for k, v in form.items()}

    from twilio.request_validator import RequestValidator

    signature = request.headers.get("X-Twilio-Signature", "")
    if not RequestValidator(settings.TWILIO_AUTH_TOKEN).validate(
        settings.TWILIO_INBOUND_WEBHOOK_URL, params, signature
    ):
        logger.warning("sms-inbound: rejected request with invalid Twilio signature")
        raise HTTPException(status_code=403, detail="Invalid signature")

    company_id = settings.POD_REMINDERS_COMPANY_ID
    sid = params.get("MessageSid") or params.get("SmsSid")
    if sid:
        seen = await db.execute(select(LoadSmsMessage.id).where(LoadSmsMessage.twilio_sid == sid))
        if seen.first():
            return _twiml()  # Twilio retry of a message already handled

    phone = to_e164(params.get("From")) or params.get("From")
    body = (params.get("Body") or "").strip()
    keyword = body.upper().strip(" .!")
    num_media = int(params.get("NumMedia") or 0)

    drivers = (await db.execute(select(Driver).where(Driver.company_id == company_id))).scalars().all()
    driver = next((d for d in drivers if to_e164(d.phone) == phone), None)

    def record(**kw):
        db.add(LoadSmsMessage(company_id=company_id, driver_id=driver.id if driver else None,
                              direction="in", phone=phone, twilio_sid=sid, status="received", **kw))

    if keyword in STOP_WORDS or keyword in START_WORDS:
        opted_out = keyword in STOP_WORDS
        if driver:
            driver.sms_opt_out = opted_out
        record(kind=SmsKind.OPT_OUT if opted_out else SmsKind.OPT_IN, body=body)
        await db.commit()
        return _twiml()

    load = await _target_load(db, company_id, phone) if phone else None

    if num_media:
        stored = []
        for i in range(min(num_media, 10)):
            url = params.get(f"MediaUrl{i}")
            declared = (params.get(f"MediaContentType{i}") or "").lower()
            if not url or declared not in MEDIA_EXT:
                continue
            try:
                data, ctype = await run_in_threadpool(_download_media, url)
            except Exception as e:
                logger.warning("sms-inbound: media %s download failed: %s", i, e)
                continue
            ext = MEDIA_EXT.get(ctype) or MEDIA_EXT[declared]
            key = f"pod-sms-{load.id if load else 'unmatched'}-{uuid.uuid4().hex}.{ext}"
            ok = await run_in_threadpool(s3_service.upload_bytes, key, data, ctype or declared)
            if ok:
                stored.append({"key": key, "url": f"/api/v1/uploads/s3/{key}", "content_type": ctype or declared, "bytes": len(data)})

        newly_attached = False
        if load is not None and stored and not load.pod_url:
            load.pod_url = stored[0]["url"]
            newly_attached = True
        record(kind=SmsKind.POD_MEDIA, body=body or None, media=stored or None,
               load_id=load.id if load else None,
               error=None if stored else "no media could be saved")
        if body and load is not None:
            _append_note(load, body)
        await db.commit()

        if newly_attached:
            await _send_ack(db, company_id, driver, phone, load)
        logger.info("sms-inbound: %s media from %s -> load %s (attached=%s)",
                    len(stored), phone, load.id if load else None, newly_attached)
        return _twiml()

    # Plain text reply.
    if load is not None and body:
        _append_note(load, body)
    record(kind=SmsKind.REPLY, body=body, load_id=load.id if load else None)
    await db.commit()
    return _twiml()


def _append_note(load: Load, text: str) -> None:
    stamp = datetime.now(timezone.utc).astimezone(delivery_tz(load.delivery_location)).strftime("%m/%d %I:%M %p")
    line = f"[Driver text {stamp}] {text[:500]}"
    load.delivery_notes = f"{load.delivery_notes}\n{line}" if load.delivery_notes else line


async def _send_ack(db: AsyncSession, company_id: int, driver: Optional[Driver], phone: str, load: Load) -> None:
    from app.services.twilio_service import get_twilio_service

    body = ack_text(load)
    result = await get_twilio_service().send_sms(phone, body)
    ok = bool(result.get("success"))
    db.add(LoadSmsMessage(
        company_id=company_id, load_id=load.id, driver_id=driver.id if driver else None,
        direction="out", kind=SmsKind.POD_ACK, phone=phone, body=body,
        twilio_sid=result.get("message_sid"), status=(result.get("status") or "sent") if ok else "failed",
        error=None if ok else str(result.get("error"))[:1000],
    ))
    await db.commit()
