"""
Pickup / delivery times as the rate confirmation states them.

    window       "8:00 AM - 3:00 PM", "FCFS 7-3", "0800-1500"  -> green  "8 AM - 3 PM"
    appointment  "Appt 8:00 AM", a single time, or a time typed in the TMS -> orange "8 AM appt"
    none         no time, "TBD", "call to schedule"             -> red    "N/A"
"""

import re
from datetime import datetime
from typing import List, Optional, Tuple

_TBD_RE = re.compile(r"\b(tbd|tba|call|schedul|n/?a|unknown|pending)\b", re.I)
_TIME_RE = re.compile(r"(?<![\d/])(\d{1,2})(?::?(\d{2}))?\s*(a\.?m\.?|p\.?m\.?|a|p)?(?![\d/])", re.I)


def _times(text: str) -> List[Tuple[int, int, Optional[str]]]:
    out = []
    for h, m, ap in _TIME_RE.findall(text):
        h_i, m_i = int(h), int(m or 0)
        if len(h) <= 2 and not m and not ap and h_i > 12:
            continue  # a bare number like "53" is not a time
        if (h_i > 23 and not ap) or m_i > 59:
            continue
        # "0800" style: 4 digits run together
        out.append((h_i, m_i, (ap or "").lower().replace(".", "")[:1] or None))
    return out


def _fmt(h: int, m: int, ap: Optional[str]) -> str:
    """12-hour clock: (15, 0, None) -> '3 PM', (8, 30, 'a') -> '8:30 AM'."""
    if h >= 13:
        h, ap = h - 12, "p"
    elif ap is None:
        ap = "p" if h == 12 else "a"
    if h == 0:
        h, ap = 12, "a"
    clock = f"{h}" if m == 0 else f"{h}:{m:02d}"
    return f"{clock} {'AM' if ap == 'a' else 'PM'}"


def _from_4digit(text: str) -> List[Tuple[int, int, Optional[str]]]:
    """'0800-1500' (24h, no colon)."""
    return [(int(h), int(m), None) for h, m in re.findall(r"(?<![\d/])([01]\d|2[0-3])([0-5]\d)(?![\d/])", text)]


def _infer_ampm(a, b):
    """Fill in a missing AM/PM on a range as a dispatcher would read it."""
    (ah, am, ap), (bh, bm, bp) = a, b
    if ah > 12 or bh > 12:  # 24h clock: leave as is
        return a, b
    if ap is None and bp is None:          # "FCFS 7-3", "8-11"
        ap = "p" if ah < 6 else "a"
        bp = "p" if (bh <= ah or bh < 6 or bh == 12) else ap
    elif ap is None:                       # "8-3 PM" -> 8 AM; "1-5 PM" -> 1 PM
        ap = "a" if (bp == "p" and ah % 12 > bh % 12) else bp
    elif bp is None:                       # "8 AM-3" -> 3 PM
        bp = "p" if (ap == "a" and bh % 12 <= ah % 12) else ap
    return (ah, am, ap), (bh, bm, bp)


def describe_time(window: Optional[str], when: Optional[datetime], manual: bool = False) -> dict:
    """{"kind": "window"|"appointment"|"none", "text": "..."} for display."""
    if manual and when is not None:
        if when.hour or when.minute:
            return {"kind": "appointment", "text": f"{_fmt(when.hour, when.minute, 'a' if when.hour < 12 else 'p')} appt"}
        return {"kind": "none", "text": "N/A"}

    text = (window or "").strip()
    if text:
        found = _from_4digit(text) if re.search(r"\b\d{4}\b", text) and ":" not in text else _times(text)
        # Fill in AM/PM on the start of a range from the end ("8-3 PM" -> 8 AM? no: keep as printed).
        if len(found) >= 2:
            a, b = found[0], found[-1]
            a, b = _infer_ampm(a, b)
            return {"kind": "window", "text": f"{_fmt(*a)} \u2013 {_fmt(*b)}"}
        if len(found) == 1 and not _TBD_RE.search(text):
            h, m, ap = found[0]
            if ap is None and when is not None and when.hour == h % 24:
                ap = "a" if when.hour < 12 else "p"
            return {"kind": "appointment", "text": f"{_fmt(h, m, ap)} appt"}
        if _TBD_RE.search(text):
            return {"kind": "none", "text": "N/A"}

    if when is not None and (when.hour or when.minute):
        return {"kind": "appointment", "text": f"{_fmt(when.hour, when.minute, 'a' if when.hour < 12 else 'p')} appt"}
    return {"kind": "none", "text": "N/A"}
