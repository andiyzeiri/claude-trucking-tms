"""
Inbound driver texts (Twilio webhook).

Configured in the Twilio console on the Messaging Service:
    Incoming messages -> Send a webhook -> POST https://absolutetms.com/api/v1/sms/inbound

Driver texting runs on AI loads only (the Loads AI page; ingested_documents
rows). A photo or PDF reply is saved to S3 and set as the POD on the AI load
the driver was last texted about; a plain text reply is appended to that AI
load's notes. STOP / START keep drivers.sms_opt_out in step with Twilio's
own opt-out handling (Twilio blocks sends to opted-out numbers regardless).
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.database import get_db
from app.models.driver import Driver
from app.models.loads_ai import LIVE_AI_LOAD_STATUSES, IngestedDocument
from app.models.sms import POD_PROMPT_KINDS, LoadSmsMessage, SmsKind
from app.services.s3 import s3_service
from app.sms.ai_loads import append_note, update_draft
from app.documents.lumper import scan_media_for_lumper
from app.services.pdf_convert import image_to_pdf, is_image
from app.sms.ai_loads import view as ai_view
from app.sms.pod_reminders import ack_text
from app.sms.pod_pages import add_pages, window_open
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


async def _route(db: AsyncSession, company_id: int, phone: str, now: datetime):
    """
    Which AI load an incoming photo/text belongs to, and what to do:

      ("start", doc)   - the load we most recently texted this driver about
                         has no POD yet: this begins its POD
      ("append", doc)  - its texted POD is still within the 2-hour window
                         (and we haven't texted them about another load since):
                         add as more pages
      ("start", other) - else another recently texted load still missing a POD
      ("flag", doc)    - nothing open: keep the photo, note it on the load
    """
    recent = (
        await db.execute(
            select(LoadSmsMessage.ai_load_id)
            .where(
                LoadSmsMessage.company_id == company_id,
                LoadSmsMessage.phone == phone,
                LoadSmsMessage.direction == "out",
                # Drivers often reply to the assignment text with the POD.
                LoadSmsMessage.kind.in_(POD_PROMPT_KINDS + (SmsKind.LOAD_ASSIGNED,)),
                LoadSmsMessage.ai_load_id.isnot(None),
            )
            .order_by(LoadSmsMessage.created_at.desc())
            .limit(10)
        )
    ).scalars().all()
    docs: List[IngestedDocument] = []
    for doc_id in dict.fromkeys(recent):  # keep order, drop repeats
        doc = await db.get(IngestedDocument, doc_id)
        if doc is not None and doc.company_id == company_id and doc.status in LIVE_AI_LOAD_STATUSES:
            docs.append(doc)
    if not docs:
        return "flag", None
    latest = docs[0]
    if not ai_view(latest).pod_url:
        return "start", latest
    if await window_open(db, latest, phone, now):
        return "append", latest
    for doc in docs[1:]:
        if not ai_view(doc).pod_url:
            return "start", doc
    return "flag", latest


@router.post("/inbound")
async def twilio_inbound(request: Request, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
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

    now = datetime.now(timezone.utc)
    action, load = await _route(db, company_id, phone, now) if phone else ("flag", None)

    if num_media:
        stored = []
        scan = []  # (bytes, content type, name) to check for a lumper receipt
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
            ctype = ctype or declared
            ext = MEDIA_EXT.get(ctype) or MEDIA_EXT[declared]
            # Store photos as PDFs so the POD column always opens a PDF.
            pdf = await run_in_threadpool(image_to_pdf, data) if is_image(ctype) else None
            body_bytes, body_type, ext = (pdf, "application/pdf", "pdf") if pdf else (data, ctype, ext)
            key = f"pod-sms-ai{load.id if load else '-unmatched'}-{uuid.uuid4().hex}.{ext}"
            ok = await run_in_threadpool(s3_service.upload_bytes, key, body_bytes, body_type)
            if ok:
                # The lumper check reads the original photo when the model can
                # (JPEG/PNG/...), else the PDF (e.g. iPhone HEIC).
                readable_image = ctype in ("image/jpeg", "image/png", "image/gif", "image/webp")
                scan.append((data, ctype, key) if readable_image or not pdf else (pdf, "application/pdf", key))
                stored.append({"key": key, "url": f"/api/v1/uploads/s3/{key}", "content_type": body_type, "bytes": len(body_bytes)})

        page_keys = [m["key"] for m in stored if m["content_type"] == "application/pdf"]
        pages = 0
        if load is not None and page_keys and action in ("start", "append"):
            if action == "start":
                update_draft(load, pod_window_started=now.isoformat(), pod_pages=[], pod_source="sms")
            pages = await add_pages(load, page_keys, now, driver.id if driver else None)
        elif load is not None and stored:
            # Nothing open for more pages: keep the photo, change nothing.
            _append_note(load, f"Driver texted {len(stored)} more photo(s) after the POD was complete - saved, not added to the POD.")
        record(kind=SmsKind.POD_MEDIA, body=body or None, media=stored or None,
               ai_load_id=load.id if load else None,
               error=None if stored else "no media could be saved")
        if body and load is not None:
            _append_note(load, body)
        await db.commit()

        if pages:
            await _send_ack(db, company_id, driver, phone, load, pages)
        newly_attached = bool(pages)
        # Look for a lumper receipt among the photos, after Twilio has its reply.
        if load is not None and scan:
            background_tasks.add_task(scan_media_for_lumper, load.id, scan)
        logger.info("sms-inbound: %s media from %s -> load %s (attached=%s)",
                    len(stored), phone, load.id if load else None, newly_attached)
        return _twiml()

    # Plain text reply.
    if load is not None and body:
        _append_note(load, body)
    record(kind=SmsKind.REPLY, body=body, ai_load_id=load.id if load else None)
    await db.commit()
    return _twiml()


def _append_note(doc: IngestedDocument, text: str) -> None:
    v = ai_view(doc)
    stamp = datetime.now(timezone.utc).astimezone(delivery_tz(v.delivery_location)).strftime("%m/%d %I:%M %p")
    append_note(doc, f"[Driver text {stamp}] {text[:500]}")


async def _send_ack(db: AsyncSession, company_id: int, driver: Optional[Driver], phone: str, doc: IngestedDocument, pages: int = 1) -> None:
    from app.services.twilio_service import get_twilio_service

    body = ack_text(ai_view(doc), pages)
    result = await get_twilio_service().send_sms(phone, body)
    ok = bool(result.get("success"))
    db.add(LoadSmsMessage(
        company_id=company_id, ai_load_id=doc.id, driver_id=driver.id if driver else None,
        direction="out", kind=SmsKind.POD_ACK, phone=phone, body=body,
        twilio_sid=result.get("message_sid"), status=(result.get("status") or "sent") if ok else "failed",
        error=None if ok else str(result.get("error"))[:1000],
    ))
    await db.commit()
