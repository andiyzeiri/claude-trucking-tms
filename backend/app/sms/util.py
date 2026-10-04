"""
Small pure helpers for driver texting: phone numbers and delivery time zones.

Load times in this TMS are stored as wall-clock values at the stop itself
(a 2:00 PM appointment in Ohio is stored as 14:00 with no zone). To know
when "two hours after delivery" is, the delivery's time zone has to come
from the delivery address, so it is derived from the state.
"""

import re
from datetime import datetime
from typing import Optional
from zoneinfo import ZoneInfo

# Primary IANA zone per state. Split states (e.g. TN, KY, IN, FL panhandle,
# TX far west) use the zone covering most freight; off by at most an hour,
# which only shifts when a reminder goes out.
STATE_TZ = {
    "CT": "America/New_York", "DE": "America/New_York", "DC": "America/New_York",
    "FL": "America/New_York", "GA": "America/New_York", "IN": "America/Indiana/Indianapolis",
    "KY": "America/New_York", "ME": "America/New_York", "MD": "America/New_York",
    "MA": "America/New_York", "MI": "America/Detroit", "NH": "America/New_York",
    "NJ": "America/New_York", "NY": "America/New_York", "NC": "America/New_York",
    "OH": "America/New_York", "PA": "America/New_York", "RI": "America/New_York",
    "SC": "America/New_York", "VT": "America/New_York", "VA": "America/New_York",
    "WV": "America/New_York",
    "AL": "America/Chicago", "AR": "America/Chicago", "IL": "America/Chicago",
    "IA": "America/Chicago", "KS": "America/Chicago", "LA": "America/Chicago",
    "MN": "America/Chicago", "MS": "America/Chicago", "MO": "America/Chicago",
    "NE": "America/Chicago", "ND": "America/Chicago", "OK": "America/Chicago",
    "SD": "America/Chicago", "TN": "America/Chicago", "TX": "America/Chicago",
    "WI": "America/Chicago",
    "AZ": "America/Phoenix", "CO": "America/Denver", "ID": "America/Boise",
    "MT": "America/Denver", "NM": "America/Denver", "UT": "America/Denver",
    "WY": "America/Denver",
    "CA": "America/Los_Angeles", "NV": "America/Los_Angeles", "OR": "America/Los_Angeles",
    "WA": "America/Los_Angeles",
    "AK": "America/Anchorage", "HI": "Pacific/Honolulu",
}
HOME_TZ = "America/Chicago"  # carrier's base; used when the state can't be read

STATE_NAMES = {
    "ALABAMA": "AL", "ALASKA": "AK", "ARIZONA": "AZ", "ARKANSAS": "AR", "CALIFORNIA": "CA",
    "COLORADO": "CO", "CONNECTICUT": "CT", "DELAWARE": "DE", "FLORIDA": "FL", "GEORGIA": "GA",
    "HAWAII": "HI", "IDAHO": "ID", "ILLINOIS": "IL", "INDIANA": "IN", "IOWA": "IA", "KANSAS": "KS",
    "KENTUCKY": "KY", "LOUISIANA": "LA", "MAINE": "ME", "MARYLAND": "MD", "MASSACHUSETTS": "MA",
    "MICHIGAN": "MI", "MINNESOTA": "MN", "MISSISSIPPI": "MS", "MISSOURI": "MO", "MONTANA": "MT",
    "NEBRASKA": "NE", "NEVADA": "NV", "NEW HAMPSHIRE": "NH", "NEW JERSEY": "NJ", "NEW MEXICO": "NM",
    "NEW YORK": "NY", "NORTH CAROLINA": "NC", "NORTH DAKOTA": "ND", "OHIO": "OH", "OKLAHOMA": "OK",
    "OREGON": "OR", "PENNSYLVANIA": "PA", "RHODE ISLAND": "RI", "SOUTH CAROLINA": "SC",
    "SOUTH DAKOTA": "SD", "TENNESSEE": "TN", "TEXAS": "TX", "UTAH": "UT", "VERMONT": "VT",
    "VIRGINIA": "VA", "WASHINGTON": "WA", "WEST VIRGINIA": "WV", "WISCONSIN": "WI", "WYOMING": "WY",
}

_STATE_RE = re.compile(r"\b([A-Z]{2})\b(?:\s+\d{5}(?:-\d{4})?)?\s*$")


def parse_state(location: Optional[str]) -> Optional[str]:
    """
    State code from a stored location.

    The loads page saves "street, city, ST 12345" (parts optional), so the
    state is the two letters starting the last comma-separated part.
    """
    if not location:
        return None
    last = location.split(",")[-1].strip().upper()
    m = _STATE_RE.search(last)
    if m and m.group(1) in STATE_TZ:
        return m.group(1)
    name = re.sub(r"\s*\d{5}(-\d{4})?$", "", last).strip()
    return STATE_NAMES.get(name)


def city_state(location: Optional[str]) -> str:
    """'Stow, OH' for the message text; falls back to the raw location."""
    if not location:
        return "your delivery"
    parts = [p.strip() for p in location.split(",") if p.strip()]
    state = parse_state(location)
    if state and len(parts) >= 2:
        return f"{parts[-2]}, {state}"
    return location.strip()[:60]


def delivery_tz(location: Optional[str]) -> ZoneInfo:
    return ZoneInfo(STATE_TZ.get(parse_state(location) or "", HOME_TZ))


def wall_clock_to_utc(value: datetime, tz: ZoneInfo) -> datetime:
    """A stored naive stop time, interpreted in the stop's zone, as aware UTC."""
    if value.tzinfo is not None:
        # Some rows were written with an explicit zone; respect it as-is.
        return value.astimezone(ZoneInfo("UTC"))
    return value.replace(tzinfo=tz).astimezone(ZoneInfo("UTC"))


def to_e164(phone: Optional[str]) -> Optional[str]:
    """
    US/Canada number as +1XXXXXXXXXX, or None if it isn't a textable number.

    Driver phones are free text in this TMS and some are incomplete
    (e.g. "(1"), so anything that isn't ten digits after the country code
    is rejected rather than guessed at.
    """
    if not phone:
        return None
    digits = re.sub(r"\D", "", phone)
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    if len(digits) != 10 or digits[0] in "01":
        return None
    return "+1" + digits
