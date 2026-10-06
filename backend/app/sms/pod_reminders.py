"""
POD reminder texts, for AI loads (the Loads AI page) only.

After a load's delivery appointment, text the driver asking whether they're
unloaded and for a photo of the signed POD; keep reminding until a POD is on
the load, then stop and flag the load for dispatch.

The decision for a single load is a pure function (`decide`) so it can be
tested without a database or Twilio; `run_pod_reminders` applies it to the
loads that qualify and records every text in load_sms_messages, which is
both the audit trail and what keeps a load from being texted twice.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Callable, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.models.driver import Driver
from app.models.loads_ai import LIVE_AI_LOAD_STATUSES, IngestedDocument
from app.models.sms import POD_PROMPT_KINDS, LoadSmsMessage, SmsKind
from app.sms.ai_loads import update_draft
from app.sms.ai_loads import view as ai_view
from app.sms.util import city_state, delivery_tz, to_e164, wall_clock_to_utc

logger = logging.getLogger(__name__)

UTC = timezone.utc
TWILIO_UNSUBSCRIBED = 21610  # "Attempt to send to unsubscribed recipient"


def load_label(load) -> str:
    return load.load_number or load.reference_number or load.broker_load_number or f"#{load.id}"


def first_text(load) -> str:
    return (
        f"Absolute Trucking: Load {load_label(load)} delivering to {city_state(load.delivery_location)} "
        f"- are you unloaded? Please reply with a photo of the signed POD. Reply STOP to opt out."
    )


def reminder_text(load) -> str:
    return (
        f"Absolute Trucking: Reminder - we still need the signed POD for load {load_label(load)}. "
        f"Please reply with a photo of it. Reply STOP to opt out."
    )


def manual_request_text(load) -> str:
    return (
        f"Absolute Trucking: Please send a photo of the signed POD for load {load_label(load)} "
        f"(delivered to {city_state(load.delivery_location)}). Reply with the photo. Reply STOP to opt out."
    )


def ack_text(load) -> str:
    return f"Absolute Trucking: Thanks, we received the POD for load {load_label(load)}. Reply STOP to opt out."


@dataclass
class Decision:
    action: Optional[str]  # "first" | "reminder" | "escalate" | None
    reason: str


def decide(
    *,
    delivery_date: datetime,
    delivery_location: Optional[str],
    now: datetime,
    sent_count: int,
    last_attempt: Optional[datetime],
    escalated: bool,
    first_after_h: float,
    every_h: float,
    max_texts: int,
    quiet_start: int,
    quiet_end: int,
    lookback_days: int,
) -> Decision:
    """What to do for one load right now. `now` and `last_attempt` are aware UTC."""
    tz = delivery_tz(delivery_location)
    delivered_at = wall_clock_to_utc(delivery_date, tz)

    if delivered_at < now - timedelta(days=lookback_days):
        return Decision(None, "delivery older than the lookback window")
    if now < delivered_at + timedelta(hours=first_after_h):
        return Decision(None, "not due yet")

    if sent_count >= max_texts:
        if escalated:
            return Decision(None, "reminders exhausted, already flagged")
        # Give the driver the usual interval to answer the last text first.
        if last_attempt is not None and now - last_attempt < timedelta(hours=every_h):
            return Decision(None, "waiting on a reply to the final reminder")
        return Decision("escalate", f"no POD after {max_texts} texts")

    local_hour = now.astimezone(tz).hour
    if local_hour >= quiet_start or local_hour < quiet_end:
        return Decision(None, f"quiet hours ({local_hour}:00 at delivery)")

    if last_attempt is not None and now - last_attempt < timedelta(hours=every_h):
        return Decision(None, "texted recently")

    return Decision("first" if sent_count == 0 else "reminder", "due")


@dataclass
class ReminderSummary:
    enabled: bool = True
    dry_run: bool = True
    checked: int = 0
    sent: int = 0
    would_send: int = 0
    escalated: int = 0
    skipped_no_phone: int = 0
    skipped_opted_out: int = 0
    failed: int = 0
    details: List[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {k: v for k, v in self.__dict__.items() if k != "details"} | {"details": self.details[:50]}


async def run_pod_reminders(
    session: AsyncSession,
    now: Optional[datetime] = None,
    send: Optional[Callable[[str, str], dict]] = None,
) -> ReminderSummary:
    """
    One pass over AI loads (Loads AI page) that are waiting on a POD.

    Manually entered loads are never texted. An AI load qualifies when it
    has a driver, isn't invoiced, has no POD yet, and its delivery falls in
    the lookback window.

    `send(to, body) -> {"success", "message_sid", "status", "error", "error_code"}`
    defaults to Twilio; tests pass a fake.
    """
    s = settings
    summary = ReminderSummary(enabled=s.POD_REMINDERS_ENABLED, dry_run=s.POD_REMINDERS_DRY_RUN)
    if not s.POD_REMINDERS_ENABLED or not s.POD_REMINDERS_COMPANY_ID:
        summary.enabled = False
        return summary

    now = now or datetime.now(UTC)
    company_id = s.POD_REMINDERS_COMPANY_ID

    if send is None and not s.POD_REMINDERS_DRY_RUN:
        from app.services.twilio_service import get_twilio_service

        twilio = get_twilio_service()
        if not twilio.configured:
            summary.details.append("Twilio is not configured; nothing sent.")
            logger.warning("pod-reminders: Twilio not configured")
            return summary

        def send(to: str, body: str) -> dict:  # noqa: F811 - blocking call, run in a thread
            import asyncio
            return asyncio.run(twilio.send_sms(to, body))

    naive_now = now.replace(tzinfo=None)
    window_start = naive_now - timedelta(days=s.POD_LOOKBACK_DAYS + 1)

    docs = (
        await session.execute(
            select(IngestedDocument).where(
                IngestedDocument.company_id == company_id,
                IngestedDocument.status.in_(LIVE_AI_LOAD_STATUSES),
                IngestedDocument.draft.isnot(None),
            )
        )
    ).scalars().all()

    for doc in docs:
        load = ai_view(doc)
        if (
            not load.driver_id
            or load.pod_url
            or load.status == "invoiced"
            or load.delivery_date is None
            or not (window_start <= load.delivery_date <= naive_now)
        ):
            continue
        driver = await session.get(Driver, load.driver_id)
        if driver is None or driver.company_id != company_id:
            continue

        summary.checked += 1
        prompts = (
            await session.execute(
                select(LoadSmsMessage.status, LoadSmsMessage.created_at, LoadSmsMessage.kind).where(
                    LoadSmsMessage.ai_load_id == doc.id,
                    LoadSmsMessage.direction == "out",
                    LoadSmsMessage.kind.in_(POD_PROMPT_KINDS + (SmsKind.ESCALATED,)),
                )
            )
        ).all()
        sent_count = sum(1 for st, _, k in prompts if k in POD_PROMPT_KINDS and st not in ("failed",))
        attempts = [c for st, c, k in prompts if k in POD_PROMPT_KINDS]
        last_attempt = max(attempts) if attempts else None
        escalated = any(k == SmsKind.ESCALATED for _, _, k in prompts)

        d = decide(
            delivery_date=load.delivery_date,
            delivery_location=load.delivery_location,
            now=now,
            sent_count=sent_count,
            last_attempt=last_attempt,
            escalated=escalated,
            first_after_h=s.POD_FIRST_TEXT_AFTER_HOURS,
            every_h=s.POD_REMINDER_EVERY_HOURS,
            max_texts=s.POD_MAX_TEXTS,
            quiet_start=s.POD_QUIET_START_HOUR,
            quiet_end=s.POD_QUIET_END_HOUR,
            lookback_days=s.POD_LOOKBACK_DAYS,
        )
        if d.action is None:
            continue

        label = load_label(load)
        driver_name = f"{driver.first_name} {driver.last_name}".strip()

        if d.action == "escalate":
            summary.escalated += 1
            summary.details.append(f"AI load {label}: {d.reason} - flagged for dispatch")
            if not s.POD_REMINDERS_DRY_RUN:
                update_draft(doc, needs_attention=True)
                session.add(LoadSmsMessage(
                    company_id=company_id, ai_load_id=doc.id, driver_id=driver.id, direction="out",
                    kind=SmsKind.ESCALATED, status="internal", created_at=now,
                    body=f"No POD after {s.POD_MAX_TEXTS} texts; AI load flagged needs attention.",
                ))
                await session.commit()
            continue

        if driver.sms_opt_out:
            summary.skipped_opted_out += 1
            summary.details.append(f"AI load {label}: {driver_name} opted out of texts")
            continue
        phone = to_e164(driver.phone)
        if not phone:
            summary.skipped_no_phone += 1
            summary.details.append(f"AI load {label}: {driver_name} has no textable phone ({driver.phone!r})")
            continue

        kind = SmsKind.POD_REQUEST if d.action == "first" else SmsKind.POD_REMINDER
        body = first_text(load) if d.action == "first" else reminder_text(load)

        if s.POD_REMINDERS_DRY_RUN:
            summary.would_send += 1
            summary.details.append(f"WOULD TEXT {driver_name} {phone} about AI load {label}: {body}")
            continue

        result = await run_in_threadpool(send, phone, body)
        ok = bool(result.get("success"))
        session.add(LoadSmsMessage(
            company_id=company_id, ai_load_id=doc.id, driver_id=driver.id, direction="out",
            kind=kind, phone=phone, body=body, created_at=now,
            twilio_sid=result.get("message_sid"),
            status=(result.get("status") or "sent") if ok else "failed",
            error=None if ok else str(result.get("error"))[:1000],
        ))
        if ok:
            summary.sent += 1
            summary.details.append(f"texted {driver_name} about AI load {label} ({kind})")
        else:
            summary.failed += 1
            summary.details.append(f"AI load {label}: send to {driver_name} failed: {result.get('error')}")
            if result.get("error_code") == TWILIO_UNSUBSCRIBED:
                driver.sms_opt_out = True
        await session.commit()

    return summary


async def run_pod_reminder_job() -> None:
    """Scheduler entry point. Owns its own session; never raises."""
    from app.database import AsyncSessionLocal

    if not settings.POD_REMINDERS_ENABLED:
        return
    async with AsyncSessionLocal() as session:
        try:
            summary = await run_pod_reminders(session)
            if summary.checked or summary.details:
                logger.info("pod-reminders: %s", summary.as_dict())
        except Exception:
            logger.exception("pod-reminders: job crashed")
