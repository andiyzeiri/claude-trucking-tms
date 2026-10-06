"""
Multi-page PODs sent by text.

Drivers photograph each page of a POD and often send them as several
texts. Each page is kept as its own PDF and the load's POD is a single
merged PDF of all pages, in arrival order.

A load's POD stays open for more pages for POD_PAGE_WINDOW after its first
texted page - unless we text that driver about a different load (a POD
request, reminder or assignment), which closes it at once. A POD that came
from an upload or email is never changed by texted photos.
"""

import io
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.models.loads_ai import IngestedDocument
from app.models.sms import POD_PROMPT_KINDS, LoadSmsMessage, SmsKind
from app.services.s3 import s3_service

logger = logging.getLogger(__name__)

POD_PAGE_WINDOW = timedelta(hours=2)
_TEXTS_ABOUT_A_LOAD = POD_PROMPT_KINDS + (SmsKind.LOAD_ASSIGNED,)


def _parse(ts: Optional[str]) -> Optional[datetime]:
    try:
        return datetime.fromisoformat(ts) if ts else None
    except ValueError:
        return None


async def window_open(db: AsyncSession, doc: IngestedDocument, phone: str, now: datetime) -> bool:
    """Is this AI load's texted POD still accepting more pages from this driver?"""
    d = doc.draft or {}
    if d.get("pod_source") != "sms" or not d.get("pod_pages"):
        return False
    started = _parse(d.get("pod_window_started"))
    if started is None or now - started > POD_PAGE_WINDOW:
        return False
    # Cut off as soon as we text this driver about any other load.
    other = (
        await db.execute(
            select(LoadSmsMessage.id).where(
                LoadSmsMessage.phone == phone,
                LoadSmsMessage.direction == "out",
                LoadSmsMessage.kind.in_(_TEXTS_ABOUT_A_LOAD),
                LoadSmsMessage.ai_load_id.isnot(None),
                LoadSmsMessage.ai_load_id != doc.id,
                LoadSmsMessage.created_at > started,
            )
        )
    ).first()
    return other is None


def merge_pdfs(parts: List[bytes]) -> Optional[bytes]:
    """One PDF of all parts' pages, in order. None if nothing could be merged."""
    from pypdf import PdfReader, PdfWriter

    writer = PdfWriter()
    for part in parts:
        try:
            for page in PdfReader(io.BytesIO(part)).pages:
                writer.add_page(page)
        except Exception as e:
            logger.warning("pod-pages: skipped an unreadable page: %s", e)
    if not writer.pages:
        return None
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


async def add_pages(doc: IngestedDocument, new_keys: List[str], now: datetime, driver_id: Optional[int]) -> int:
    """
    Append page PDFs (already in S3) to the AI load's texted POD and rebuild
    the merged POD. Returns the total page count.
    """
    d = dict(doc.draft or {})
    keys = list(d.get("pod_pages") or []) + list(new_keys)
    parts = []
    for k in keys:
        data = await run_in_threadpool(s3_service.download_bytes, k)
        if data:
            parts.append(data)
    merged = await run_in_threadpool(merge_pdfs, parts) if len(parts) > 1 else (parts[0] if parts else None)
    if merged is None:
        return len(d.get("pod_pages") or [])
    if len(parts) > 1:
        key = f"pod-sms-ai{doc.id}-merged-{uuid.uuid4().hex}.pdf"
        await run_in_threadpool(s3_service.upload_bytes, key, merged, "application/pdf")
    else:
        key = keys[0]
    from pypdf import PdfReader

    try:
        pages = len(PdfReader(io.BytesIO(merged)).pages)
    except Exception:
        pages = len(keys)
    d.update({
        "pod_url": f"/api/v1/uploads/s3/{key}",
        "pod_pages": keys,
        "pod_page_count": pages,
        "pod_source": "sms",
        "pod_window_started": d.get("pod_window_started") or now.isoformat(),
        "pod_driver_id": d.get("pod_driver_id") or driver_id,
    })
    doc.draft = d
    return pages
