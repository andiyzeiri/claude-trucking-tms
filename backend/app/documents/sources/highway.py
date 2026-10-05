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
_ORDER_RE = re.compile(r"Rate\s+Confirmation\s+for\s+order\s*#\s*([A-Za-z0-9][A-Za-z0-9\-_/.]*)", re.I)
_BROKER_RE = re.compile(r"New\s+rate\s+confirmation\s+from\s+([^\n\r]+)", re.I)
_CONTACT_RE = re.compile(r"([A-Z][^\n\r*]{1,60}?)\s*\*?\s*from\s*\*?\s*([^\n\r*]{2,80}?)\s*\*?\s+has\s+issued", re.I)


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


def parse_highway_notification(subject: Optional[str], from_address: Optional[str], body: Optional[str]) -> Optional[HighwayLoad]:
    """A HighwayLoad if this is a Highway rate-confirmation notice (direct or forwarded), else None."""
    subject = subject or ""
    body = body or ""
    from_highway = _SENDER in (from_address or "").lower()
    forwarded_from_highway = bool(re.search(r"From:\s*Highway\s*<\s*no-reply@highway\.com\s*>", body, re.I))
    if not (from_highway or forwarded_from_highway):
        return None

    m = _ORDER_RE.search(subject) or _ORDER_RE.search(body)
    if not m:
        return None  # some other Highway email (account notices, marketing)
    load_id = m.group(1).rstrip(".")

    broker = None
    b = _BROKER_RE.search(body)
    if b:
        broker = _clean(b.group(1))
    contact = None
    c = _CONTACT_RE.search(body)
    if c:
        contact = _clean(c.group(1))
        broker = broker or _clean(c.group(2))
    return HighwayLoad(load_id=load_id, broker_name=broker, contact_name=contact)
