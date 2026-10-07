"""
Highway (highway.com) load notifications.

Brokers on Highway don't email the rate confirmation itself - Highway sends
a notice like:

    From:    Highway <no-reply@highway.com>
    Subject: Rate Confirmation for order # 1283004
    Body:    New rate confirmation from Triple T Transport
             James Capparuccini from Triple T Transport has issued a new
             rate confirmation to your company, ABSOLUTE TRUCKING INC.

Each becomes an *unverified* load (broker + load id) until the real rate
confirmation arrives and is matched to it. Only Highway's rate
confirmation notices are recognised; its other email is ignored.
"""

import re
from dataclasses import dataclass
from typing import Optional

_SENDER = "no-reply@highway.com"

# Highway's own body text is the same for every broker:
#   "New rate confirmation from American Transport Group"
#   "*Garret T Stelmack* from *American Transport Group* has issued a new rate confirmation"
#   "Rate Confirmation from DESTINATION TRANSPORT, LLC has been updated"
# The SUBJECT is the broker's own and varies ("Shipment ID: 132005652",
# "Carrier Confirmation for Trip #1679309", "Load Tender for Load 16536763
# from ...", "Rate Confirmation for order # 1283004", "... order: 9487363"),
# so notices are recognised by the body and the load id is read from the subject.
_NOTICE_RE = re.compile(
    r"has\s+issued\s+a\s+new\s+rate\s+confirmation|New\s+rate\s+confirmation\s+from|Rate\s+Confirmation\s+from\s+.+?\s+has\s+been\s+updated",
    re.I,
)
_BROKER_RE = re.compile(r"New\s+rate\s+confirmation\s+from\s+([^\n\r]+)", re.I)
_UPDATED_RE = re.compile(r"Rate\s+Confirmation\s+from\s+(.+?)\s+has\s+been\s+updated", re.I)
_CONTACT_RE = re.compile(r"([A-Z][^\n\r*]{1,60}?)\s*\*?\s*from\s*\*?\s*([^\n\r*]{2,80}?)\s*\*?\s+has\s+issued", re.I)
_SUBJECT_BROKER_RE = re.compile(r"^(?:(?:fwd?|fw|re)\s*:\s*)*(?:updated\s*-\s*)?(.+?)\s+(?:-\s+)?(?:Rate|Carrier)\s+Confirmation\b", re.I)
# A load id after a keyword: "order # 1283004", "order: 9487363", "Trip #1679309",
# "Load 16536763", "Shipment ID: 132005652", "PRO 55821", "Confirmation 4417".
_ID_AFTER_KEYWORD_RE = re.compile(
    r"\b(?:order|load|trip|shipment|pro|confirmation|tender|ref(?:erence)?|id)\b\s*(?:id|no\.?|number)?\s*[:#]?\s*#?\s*([A-Za-z0-9][A-Za-z0-9\-_/.]{2,})",
    re.I,
)
_ANY_ID_RE = re.compile(r"\b([A-Za-z]{0,4}\d[A-Za-z0-9\-]{3,})\b")


@dataclass
class HighwayLoad:
    load_id: str
    broker_name: Optional[str]
    contact_name: Optional[str]


def _clean(s: Optional[str]) -> Optional[str]:
    if not s:
        return None
    s = re.sub(r"[*_]+", "", s).strip(" .,:;-\t")
    return re.sub(r"\s+", " ", s) or None


def _load_id_from(text: str) -> Optional[str]:
    """The load id in a broker's subject line."""
    for m in _ID_AFTER_KEYWORD_RE.finditer(text):
        token = m.group(1).rstrip(".-/")
        if any(ch.isdigit() for ch in token):
            return token
    # No keyword: the longest token with at least 4 digits.
    tokens = [t for t in _ANY_ID_RE.findall(text) if sum(ch.isdigit() for ch in t) >= 4]
    return max(tokens, key=len) if tokens else None


def parse_highway_notification(subject: Optional[str], from_address: Optional[str], body: Optional[str]) -> Optional[HighwayLoad]:
    """A HighwayLoad if this is a Highway rate-confirmation notice (direct or forwarded), else None."""
    # Long subjects arrive folded across lines.
    subject = re.sub(r"\s+", " ", subject or "").strip()
    body = body or ""
    from_highway = _SENDER in (from_address or "").lower()
    forwarded_from_highway = bool(re.search(r"From:\s*Highway\s*<\s*no-reply@highway\.com\s*>", body, re.I))
    if not (from_highway or forwarded_from_highway):
        return None
    if not _NOTICE_RE.search(body):
        return None  # Highway's other email (invites, account notices, marketing)

    # The broker's subject; a forwarded notice carries it in the body too.
    fwd = re.search(r"^\s*Subject:\s*(.+)$", body, re.I | re.M) if forwarded_from_highway else None
    subject_text = re.sub(r"^(?:(?:fwd?|fw|re)\s*:\s*)+", "", subject, flags=re.I)
    load_id = _load_id_from(subject_text) or (_load_id_from(fwd.group(1)) if fwd else None)
    if not load_id:
        return None

    broker = None
    b = _BROKER_RE.search(body) or _UPDATED_RE.search(body)
    if b:
        broker = _clean(b.group(1))
    contact = None
    c = _CONTACT_RE.search(body)
    if c:
        contact = _clean(c.group(1))
        broker = broker or _clean(c.group(2))
    if not broker:
        s = _SUBJECT_BROKER_RE.search(subject_text)
        if s:
            broker = _clean(s.group(1))
    return HighwayLoad(load_id=load_id, broker_name=broker, contact_name=contact)
