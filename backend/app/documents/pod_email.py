"""
Email a load's POD back to the broker, from the PODs inbox (pods@).

Who it goes to is offered, not decided: the people the rate confirmation
came from (sender, Reply-To and CC of its email) and every email address
printed on the rate confirmation itself. A person ticks who gets it on the
Loads AI page and presses Send.

Sent through Gmail SMTP with the pods@ App Password already used to read
that inbox. The copy lands in pods@'s Sent mail, which ingestion skips (it
ignores messages the mailbox sent itself).
"""

import logging
import re
import smtplib
from dataclasses import dataclass, field
from datetime import datetime, timezone
from email.message import EmailMessage
from email.utils import formataddr, getaddresses, make_msgid
from typing import List, Optional

from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.documents.text_check import pdf_text
from app.models.loads_ai import InboundEmail, IngestedDocument
from app.services.s3 import s3_service

logger = logging.getLogger(__name__)

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 465
MAX_RECIPIENTS = 15
_EMAIL = re.compile(r"[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_NOREPLY = re.compile(r"no-?reply|do-?not-?reply|donotreply|mailer-daemon|notifications?@", re.IGNORECASE)


class PodEmailError(Exception):
    """Can't send: a message for the person, not a crash."""


@dataclass
class Candidate:
    email: str
    source: str            # "sender" | "reply_to" | "cc" | "ratecon"
    checked: bool
    note: Optional[str] = None


@dataclass
class Preview:
    from_address: Optional[str]
    candidates: List[Candidate] = field(default_factory=list)
    subject: str = ""
    body: str = ""
    attachment_name: Optional[str] = None
    can_send: bool = True
    blocker: Optional[str] = None


def s3_key(url: Optional[str]) -> Optional[str]:
    """'/api/v1/uploads/s3/<key>' (or an old full S3 URL) -> the S3 key."""
    if not url:
        return None
    marker = "/uploads/s3/"
    if marker in url:
        return url.split(marker, 1)[1] or None
    if url.startswith("http") and "amazonaws.com" in url:
        return url.rsplit("/", 1)[-1] or None
    return None


def _addresses(header: Optional[str]) -> List[str]:
    return [a.strip().lower() for _, a in getaddresses([header or ""]) if a and "@" in a]


def own_domains(company_email: Optional[str] = None) -> set:
    out = set()
    for a in (settings.LOADS_AI_IMAP_USERNAME, settings.LOADS_AI_POD_IMAP_USERNAME, company_email):
        if a and "@" in a:
            out.add(a.strip().lower().rsplit("@", 1)[1])
    return out


def load_label(draft: dict) -> str:
    return str(draft.get("broker_load_number") or draft.get("load_number") or "").strip()


def _city(location: Optional[str]) -> str:
    """'123 Main St, Stow, OH 44224' -> 'Stow, OH'."""
    parts = [p.strip() for p in str(location or "").split(",") if p.strip()]
    if len(parts) >= 2:
        state = re.sub(r"\s*\d{5}(-\d{4})?$", "", parts[-1]).strip()
        return f"{parts[-2]}, {state}" if state else parts[-2]
    return parts[0] if parts else ""


def default_text(draft: dict, company_name: str) -> tuple[str, str]:
    num = load_label(draft)
    subject = f"POD - Load {num}" if num else "POD"
    lane = " to ".join(c for c in (_city(draft.get("pickup_location")), _city(draft.get("delivery_location"))) if c)
    bits = f"load {num}" if num else "this load"
    if lane:
        bits += f" ({lane})"
    if draft.get("delivery_date"):
        bits += f", delivered {str(draft['delivery_date'])[:10]}"
    sender = settings.LOADS_AI_POD_IMAP_USERNAME or ""
    body = (
        "Hello,\n\n"
        f"Please find attached the signed POD for {bits}.\n\n"
        "Thank you,\n"
        f"{company_name}\n"
        f"{sender}".rstrip()
    )
    return subject, body


async def build_preview(doc: IngestedDocument, email_row: Optional[InboundEmail],
                        company_name: str, company_email: Optional[str]) -> Preview:
    draft = doc.draft if isinstance(doc.draft, dict) else {}
    subject, body = default_text(draft, company_name)
    num = load_label(draft)
    preview = Preview(
        from_address=settings.LOADS_AI_POD_IMAP_USERNAME,
        subject=subject,
        body=body,
        attachment_name=f"POD_{num or doc.id}.pdf",
    )
    if not settings.LOADS_AI_POD_IMAP_USERNAME or not settings.LOADS_AI_POD_IMAP_PASSWORD:
        preview.can_send, preview.blocker = False, "The PODs inbox (pods@) isn't connected, so there's nothing to send from."
    elif not s3_key(draft.get("pod_url")):
        preview.can_send, preview.blocker = False, "This load has no stored POD to attach."

    ours = own_domains(company_email)
    seen: dict = {}

    def add(address: str, source: str):
        a = address.strip().strip(".").lower()
        if not a or a in seen or len(seen) >= 40:
            return
        domain = a.rsplit("@", 1)[-1]
        note, checked = None, True
        if domain in ours:
            note, checked = "your company", False
        elif _NOREPLY.search(a):
            note, checked = "no-reply address", False
        seen[a] = Candidate(email=a, source=source, checked=checked, note=note)

    if email_row is not None:
        for a in _addresses(email_row.from_address):
            add(a, "sender")
        for a in _addresses(getattr(email_row, "reply_to", None)):
            add(a, "reply_to")
        for a in _addresses(getattr(email_row, "cc_address", None)):
            add(a, "cc")

    key = s3_key(draft.get("ratecon_url")) or doc.s3_key
    if key and settings.USE_S3:
        content = await run_in_threadpool(s3_service.download_bytes, key)
        if content:
            text = await run_in_threadpool(pdf_text, content, 6)
            for a in _EMAIL.findall(text or ""):
                add(a, "ratecon")

    preview.candidates = list(seen.values())
    return preview


def _valid(address: str) -> bool:
    return bool(_EMAIL.fullmatch(address.strip()))


def _send_blocking(msg: EmailMessage) -> None:
    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=30) as server:
        server.login(settings.LOADS_AI_POD_IMAP_USERNAME, settings.LOADS_AI_POD_IMAP_PASSWORD)
        server.send_message(msg)


async def send(doc: IngestedDocument, email_row: Optional[InboundEmail], to: List[str], cc: List[str],
               subject: str, body: str, company_name: str) -> List[str]:
    """Send the POD; returns everyone it went to. Raises PodEmailError for anything a person can fix."""
    sender = settings.LOADS_AI_POD_IMAP_USERNAME
    if not sender or not settings.LOADS_AI_POD_IMAP_PASSWORD:
        raise PodEmailError("The PODs inbox (pods@) isn't connected, so there's nothing to send from.")
    to = list(dict.fromkeys(a.strip().lower() for a in to if a.strip()))
    cc = [a for a in dict.fromkeys(a.strip().lower() for a in cc if a.strip()) if a not in to]
    if not to:
        raise PodEmailError("Pick at least one person to send the POD to.")
    bad = [a for a in to + cc if not _valid(a)]
    if bad:
        raise PodEmailError(f"Not a valid email address: {', '.join(bad[:3])}")
    if len(to) + len(cc) > MAX_RECIPIENTS:
        raise PodEmailError(f"Too many recipients (at most {MAX_RECIPIENTS}).")
    subject = (subject or "").strip() or "POD"
    if "\n" in subject or "\r" in subject:
        raise PodEmailError("The subject must be one line.")

    draft = doc.draft if isinstance(doc.draft, dict) else {}
    key = s3_key(draft.get("pod_url"))
    if not key or not settings.USE_S3:
        raise PodEmailError("This load has no stored POD to attach.")
    pod = await run_in_threadpool(s3_service.download_bytes, key)
    if not pod:
        raise PodEmailError("Couldn't read the POD file - try again, or replace the POD and send.")

    msg = EmailMessage()
    msg["From"] = formataddr((company_name, sender))
    msg["To"] = ", ".join(to)
    if cc:
        msg["Cc"] = ", ".join(cc)
    msg["Subject"] = subject
    msg["Message-ID"] = make_msgid(domain=sender.rsplit("@", 1)[-1])
    # Reply in the rate confirmation's thread when it came from outside.
    original = (email_row.message_id if email_row is not None else "") or ""
    if original.startswith("<") and not original.startswith("<no-message-id"):
        msg["In-Reply-To"] = original
        msg["References"] = original
    msg.set_content(body or "")
    num = load_label(draft)
    is_pdf = b"%PDF" in pod[:1024]
    msg.add_attachment(pod, maintype="application" if is_pdf else "image", subtype="pdf" if is_pdf else "jpeg",
                       filename=f"POD_{num or doc.id}.{'pdf' if is_pdf else 'jpg'}")
    try:
        await run_in_threadpool(_send_blocking, msg)
    except smtplib.SMTPAuthenticationError as e:
        logger.warning("pod-email: login failed for %s: %s", sender, e)
        raise PodEmailError(f"Gmail refused the login for {sender} - check its App Password.")
    except (smtplib.SMTPException, OSError) as e:
        logger.warning("pod-email: send failed: %s", e)
        raise PodEmailError(f"Couldn't send the email ({e.__class__.__name__}). Try again in a minute.")
    return to + cc


def record_sent(doc: IngestedDocument, recipients: List[str], user_id: Optional[int]) -> None:
    draft = dict(doc.draft or {})
    draft["pod_emailed_at"] = datetime.now(timezone.utc).isoformat()
    draft["pod_emailed_to"] = recipients
    draft["pod_emailed_by"] = user_id
    doc.draft = draft
