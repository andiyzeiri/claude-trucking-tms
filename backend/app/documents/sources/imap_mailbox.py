"""
IMAP mailbox reader.

Logs into the configured mailbox the way an email client would and yields
unread messages that carry attachments worth reading. Chosen over SES
inbound for the first iteration because it needs no DNS change and no new
AWS infrastructure - the same mailbox a human already watches.

Gmail / Google Workspace needs an App Password (2-step verification on, then
Security -> App passwords). A normal account password will not authenticate.

Blocking by design: imaplib is synchronous, so callers run this in a
threadpool. It is network-bound, so that costs almost nothing.
"""

import email
import imaplib
import logging
import re
from email.header import decode_header, make_header
from email.message import Message
from email.utils import parsedate_to_datetime
from typing import Iterator, List, Optional

from app.documents.sources.base import SourceAttachment, SourceMessage

logger = logging.getLogger(__name__)

# Types worth handing to the extractor. Anything else is counted and skipped.
READABLE_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/heic",
    "image/tiff",
}

# Below this an image is almost certainly a logo or a signature block, not a
# photographed document. Drivers' photos are measured in megabytes.
MIN_IMAGE_BYTES = 50 * 1024

# Guard against a pathological message. Nothing legitimate is this big.
MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024
MAX_ATTACHMENTS_PER_MESSAGE = 20


class MailboxError(RuntimeError):
    """Could not read the mailbox."""


def _decode(value: Optional[str]) -> Optional[str]:
    """RFC 2047 header -> plain text, tolerating malformed encodings."""
    if not value:
        return None
    try:
        return str(make_header(decode_header(value))).strip()
    except Exception:
        return value.strip()


def _is_readable(content_type: str, size: int, is_inline: bool) -> bool:
    if content_type not in READABLE_TYPES:
        return False
    if size > MAX_ATTACHMENT_BYTES:
        return False
    if content_type.startswith("image/"):
        # Inline images are part of the message body - signatures, logos,
        # tracking pixels. A driver attaches their photo, they do not embed it.
        if is_inline or size < MIN_IMAGE_BYTES:
            return False
    return True


def _walk_parts(msg: Message) -> Iterator[Message]:
    """
    Yield leaf parts, descending into forwarded messages.

    'Forward as attachment' wraps the original in a message/rfc822 part, so
    the actual rate confirmation is one level down. Accountants forward that
    way constantly.
    """
    if msg.get_content_maintype() == "multipart":
        for part in msg.get_payload():
            if isinstance(part, Message):
                yield from _walk_parts(part)
        return

    if msg.get_content_type() == "message/rfc822":
        payload = msg.get_payload()
        inner = payload[0] if isinstance(payload, list) and payload else None
        if isinstance(inner, Message):
            yield from _walk_parts(inner)
        return

    yield msg


def extract_attachments(msg: Message) -> tuple[List[SourceAttachment], int]:
    """Pull readable attachments out of a parsed message."""
    attachments: List[SourceAttachment] = []
    skipped = 0

    for part in _walk_parts(msg):
        content_type = (part.get_content_type() or "").lower()
        disposition = (part.get("Content-Disposition") or "").lower()
        is_inline = "inline" in disposition or part.get("Content-ID") is not None

        # A part with no filename and no attachment disposition is body text.
        filename = _decode(part.get_filename())
        if not filename and "attachment" not in disposition:
            if content_type in ("text/plain", "text/html"):
                continue

        try:
            payload = part.get_payload(decode=True)
        except Exception:
            skipped += 1
            continue
        if not payload:
            continue

        if not _is_readable(content_type, len(payload), is_inline):
            skipped += 1
            continue

        attachments.append(
            SourceAttachment(
                filename=filename,
                content=payload,
                declared_content_type=content_type,
            )
        )
        if len(attachments) >= MAX_ATTACHMENTS_PER_MESSAGE:
            break

    return attachments, skipped


def _fallback_message_id(msg: Message, uid: bytes) -> str:
    """
    Some senders omit Message-ID. Fall back to a hash of sender, date and
    subject - stable across folders and polls (a mailbox UID is not: it
    differs between INBOX and All Mail) - so the message still deduplicates.
    """
    import hashlib

    basis = "|".join(_decode(msg.get(h)) or "" for h in ("From", "Date", "Subject", "To"))
    return "no-message-id-" + hashlib.sha256(basis.encode("utf-8", "replace")).hexdigest()[:32]


class ImapMailboxReader:
    """Reads unseen messages with attachments from an IMAP mailbox."""

    def __init__(
        self,
        host: str,
        port: int,
        username: str,
        password: str,
        folder: str = "INBOX",
        mark_seen: bool = True,
    ):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.folder = folder
        self.mark_seen = mark_seen

    def fetch_unseen(self, limit: int = 10) -> List[SourceMessage]:
        """
        Return up to `limit` unseen messages that carry readable attachments.

        Messages are marked as seen only after their attachments have been
        handed back, so a crash mid-poll means the message is retried rather
        than silently lost.
        """
        try:
            conn = imaplib.IMAP4_SSL(self.host, self.port)
        except Exception as e:
            raise MailboxError(f"Could not connect to {self.host}:{self.port}: {e}") from e

        try:
            try:
                conn.login(self.username, self.password)
            except imaplib.IMAP4.error as e:
                # Gmail returns a generic failure for app-password problems,
                # so say the likely cause rather than echoing the raw error.
                raise MailboxError(
                    f"Mailbox login failed for {self.username}. For Gmail this usually "
                    f"means an App Password is required (Google Account -> Security -> "
                    f"2-Step Verification -> App passwords), not the account password. "
                    f"Server said: {e}"
                ) from e

            status, _ = conn.select(self.folder)
            if status != "OK":
                raise MailboxError(f"Could not open folder {self.folder!r}.")

            status, data = conn.search(None, "UNSEEN")
            if status != "OK":
                raise MailboxError("Mailbox search failed.")

            uids = data[0].split() if data and data[0] else []
            logger.info("loads-ai: %s unseen message(s) in %s", len(uids), self.folder)

            messages: List[SourceMessage] = []
            for uid in uids[:limit]:
                try:
                    # BODY.PEEK leaves the \Seen flag alone; we set it
                    # ourselves only once the message is actually handled.
                    status, payload = conn.fetch(uid, "(BODY.PEEK[])")
                    if status != "OK" or not payload or not isinstance(payload[0], tuple):
                        continue

                    msg = email.message_from_bytes(payload[0][1])
                    attachments, skipped = extract_attachments(msg)

                    received = None
                    if msg.get("Date"):
                        try:
                            received = parsedate_to_datetime(msg["Date"])
                            if received and received.tzinfo:
                                received = received.replace(tzinfo=None)
                        except Exception:
                            received = None

                    message_id = (msg.get("Message-ID") or "").strip() or _fallback_message_id(msg, uid)

                    messages.append(
                        SourceMessage(
                            message_id=message_id,
                            from_address=_decode(msg.get("From")),
                            to_address=_decode(msg.get("To")),
                            subject=_decode(msg.get("Subject")),
                            received_at=received,
                            attachments=attachments,
                            skipped_attachments=skipped,
                            body_text=body_text(msg),
                        )
                    )

                    if self.mark_seen:
                        conn.store(uid, "+FLAGS", "\\Seen")

                except Exception as e:
                    logger.exception("loads-ai: failed reading message uid=%s: %s", uid, e)
                    continue

            return messages

        finally:
            try:
                conn.close()
            except Exception:
                pass
            try:
                conn.logout()
            except Exception:
                pass


def body_text(msg, limit: int = 20000) -> str:
    """The message body as plain text: text/plain if present, else stripped HTML."""
    import html as _html
    import re as _re

    plain, rich = None, None
    for part in msg.walk():
        if part.get_content_maintype() == "multipart" or part.get_filename():
            continue
        ctype = part.get_content_type()
        try:
            payload = part.get_payload(decode=True)
            if payload is None:
                continue
            text = payload.decode(part.get_content_charset() or "utf-8", errors="ignore")
        except Exception:
            continue
        if ctype == "text/plain" and plain is None:
            plain = text
        elif ctype == "text/html" and rich is None:
            rich = text
    if plain is None and rich is not None:
        rich = _re.sub(r"<(style|script)[^>]*>.*?</\1>", " ", rich, flags=_re.S | _re.I)
        plain = _html.unescape(_re.sub(r"<[^>]+>", "\n", rich))
    return (plain or "")[:limit]


def _parse_message(raw: bytes, uid: bytes) -> SourceMessage:
    msg = email.message_from_bytes(raw)
    attachments, skipped = extract_attachments(msg)
    received = None
    if msg.get("Date"):
        try:
            received = parsedate_to_datetime(msg["Date"])
            if received and received.tzinfo:
                received = received.replace(tzinfo=None)
        except Exception:
            received = None
    return SourceMessage(
        message_id=(msg.get("Message-ID") or "").strip() or _fallback_message_id(msg, uid),
        from_address=_decode(msg.get("From")),
        to_address=_decode(msg.get("To")),
        subject=_decode(msg.get("Subject")),
        received_at=received,
        attachments=attachments,
        skipped_attachments=skipped,
        body_text=body_text(msg),
    )


def fetch_recent(reader: "ImapMailboxReader", days: int, known_ids, limit: int = 10) -> List[SourceMessage]:
    """
    Every message from the last `days` days that isn't in `known_ids`,
    oldest first, read or unread. Nothing is marked as read.

    Reading by date rather than by the unread flag means a message someone
    already opened in Gmail - or one that arrived while this service was
    down - is still picked up; dedup is by Message-ID against `known_ids`.
    On Gmail the "All Mail" folder is used, so an archived message counts
    too; messages the mailbox sent itself are skipped.
    """
    import datetime as _dt

    conn = imaplib.IMAP4_SSL(reader.host, reader.port)
    try:
        try:
            conn.login(reader.username, reader.password)
        except imaplib.IMAP4.error as e:
            raise MailboxError(
                f"Mailbox login failed for {reader.username}. For Gmail this usually means an "
                f"App Password is required, not the account password. Server said: {e}"
            ) from e

        folder = reader.folder
        if "gmail" in reader.host.lower():
            status, _ = conn.select('"[Gmail]/All Mail"', readonly=True)
            if status != "OK":
                status, _ = conn.select(folder, readonly=True)
        else:
            status, _ = conn.select(folder, readonly=True)
        if status != "OK":
            raise MailboxError(f"Could not open folder {folder!r}.")

        since = (_dt.date.today() - _dt.timedelta(days=days)).strftime("%d-%b-%Y")
        status, data = conn.uid("search", None, "SINCE", since)
        if status != "OK":
            raise MailboxError("Mailbox search failed.")
        uids = data[0].split() if data and data[0] else []

        own = reader.username.strip().lower()
        new_uids = []
        # Headers only first: cheap, and enough to skip what we've already seen.
        for i in range(0, len(uids), 100):
            chunk = b",".join(uids[i:i + 100])
            status, rows = conn.uid("fetch", chunk, "(UID BODY.PEEK[HEADER.FIELDS (MESSAGE-ID FROM DATE SUBJECT TO)])")
            if status != "OK":
                continue
            for row in rows:
                if not isinstance(row, tuple):
                    continue
                m = re.search(rb"UID (\d+)", row[0])
                if not m:
                    continue
                uid = m.group(1)
                hdr = email.message_from_bytes(row[1])
                mid = (hdr.get("Message-ID") or "").strip() or _fallback_message_id(hdr, uid)
                if mid in known_ids:
                    continue
                if own and own in (_decode(hdr.get("From")) or "").lower():
                    continue  # sent by this mailbox, not received
                new_uids.append(uid)

        logger.info("loads-ai: %s message(s) in the last %s day(s) of %s, %s new", len(uids), days, reader.username, len(new_uids))
        out: List[SourceMessage] = []
        for uid in new_uids[:limit]:
            try:
                status, payload = conn.uid("fetch", uid, "(BODY.PEEK[])")
                if status != "OK" or not payload or not isinstance(payload[0], tuple):
                    continue
                out.append(_parse_message(payload[0][1], uid))
            except Exception as e:
                logger.exception("loads-ai: failed reading message uid=%s: %s", uid, e)
        return out
    finally:
        try:
            conn.logout()
        except Exception:
            pass
