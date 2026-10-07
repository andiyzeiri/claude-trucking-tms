"""
Turn a validated extraction into TMS Load field values.

This is deterministic code on purpose. The model produced the facts; what
becomes a load is decided here, where it can be unit-tested and reasoned
about. Nothing in this module calls a model, and nothing here writes to the
database - it returns a draft for a human to accept.

Four things about the existing Load schema shape this module:

1. loads.customer_id is NOT NULL, so a draft cannot be saved until the broker
   name resolves to a customer. We return ranked candidates and a warning
   rather than inventing one.
2. pickup_location / delivery_location are single free-text strings. They must
   be composed exactly the way the loads grid's combineLocation() does, or the
   grid's parseLocation() will not round-trip the value when the cell is edited.
3. Load datetimes are stored as wall-clock UTC: the local date/time is stored
   *as* UTC rather than converted to it (see toWallClockUTC in the loads page).
   Timezone-converting an extracted date would shift it by a day.
4. Money is Decimal, never float - per the project's own rule. Values travel
   to the frontend as strings for the same reason.
"""

import logging
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal, InvalidOperation
from difflib import SequenceMatcher
from typing import Any, Dict, List, Optional, Tuple

from app.documents.extraction.schemas import ExtractedField, RateconExtraction

logger = logging.getLogger(__name__)

# Below this, a value is surfaced but flagged for review rather than trusted.
LOW_CONFIDENCE = 0.70

# Company-name noise to drop before comparing broker names to customers.
_COMPANY_SUFFIXES = {
    "inc", "incorporated", "llc", "l l c", "ltd", "limited", "corp",
    "corporation", "co", "company", "the", "lp", "llp", "plc",
}

# Words nearly every broker name contains. Two brokers sharing only these
# ("Coyote Logistics" / "Unicargo Logistics") are not similar, so fuzzy
# scoring ignores them and compares the distinctive part of the name.
_GENERIC_FREIGHT_WORDS = {
    "logistics", "logistic", "freight", "transport", "transportation",
    "trucking", "truck", "services", "service", "solutions", "group",
    "global", "worldwide", "brokerage", "broker", "carriers", "carrier",
    "express", "international", "intl", "usa", "us", "america", "american",
    "lines", "line", "shipping", "supply", "chain", "management", "and",
}


# --------------------------------------------------------------------------
# primitives
# --------------------------------------------------------------------------

def _clean(value: Optional[str]) -> Optional[str]:
    """Trim and collapse whitespace; empty becomes None."""
    if value is None:
        return None
    text = re.sub(r"\s+", " ", str(value)).strip()
    return text or None


def field_value(f: Optional[ExtractedField]) -> Optional[str]:
    return _clean(f.value) if f else None


def parse_money(value: Optional[str]) -> Optional[Decimal]:
    """
    '$2,850.00' -> Decimal('2850.00').

    Returns None rather than raising: a rate we cannot parse must show up as a
    blank field plus a warning, never as a wrong number.
    """
    text = _clean(value)
    if not text:
        return None

    negative = text.strip().startswith("(") and text.strip().endswith(")")
    stripped = re.sub(r"[^\d.\-]", "", text)
    if not stripped or stripped in {"-", ".", "-."}:
        return None

    # Guard against a mangled '1.234.56' style string.
    if stripped.count(".") > 1:
        head, _, tail = stripped.rpartition(".")
        stripped = head.replace(".", "") + "." + tail

    try:
        amount = Decimal(stripped)
    except InvalidOperation:
        return None

    if negative:
        amount = -amount
    return amount


def parse_date(value: Optional[str]) -> Optional[datetime]:
    """
    Parse a document date into a naive date (time zeroed).

    dateutil handles the range of formats brokers use (10/03/2025, 2025-10-03,
    'Oct 3 2025'). US month-first ordering, since these are US freight docs.
    A parsed year outside a sane window is treated as a failure - that is
    usually dateutil having latched onto a load or PO number.
    """
    text = _clean(value)
    if not text:
        return None

    # A bare number is an identifier, not a date.
    if re.fullmatch(r"\d{1,6}", text):
        return None

    try:
        from dateutil import parser as date_parser

        parsed = date_parser.parse(text, dayfirst=False, fuzzy=True, default=None)
    except (ValueError, OverflowError, TypeError):
        return None

    if parsed is None or not (2000 <= parsed.year <= 2100):
        return None

    return parsed.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)


def parse_time(value: Optional[str]) -> Optional[Tuple[int, int]]:
    """
    '14:00' / '2:30 PM' / '0800-1600' -> (hour, minute).

    An appointment window yields its start, which is what a dispatcher wants
    on the board.
    """
    text = _clean(value)
    if not text:
        return None

    # Window: take the first half.
    window = re.split(r"\s*(?:-|to|until|–)\s*", text, maxsplit=1)
    text = window[0].strip()

    meridiem = None
    m = re.search(r"\b([ap])\.?m\.?\b", text, re.IGNORECASE)
    if m:
        meridiem = m.group(1).lower()
        text = text[: m.start()].strip()

    m = re.match(r"^(\d{1,2})\s*:\s*(\d{2})", text)
    if m:
        hour, minute = int(m.group(1)), int(m.group(2))
    else:
        # Military style: 0800, 1430.
        m = re.match(r"^(\d{3,4})$", text)
        if m:
            raw = m.group(1).zfill(4)
            hour, minute = int(raw[:2]), int(raw[2:])
        else:
            m = re.match(r"^(\d{1,2})$", text)
            if not m:
                return None
            hour, minute = int(m.group(1)), 0

    if meridiem == "p" and hour < 12:
        hour += 12
    elif meridiem == "a" and hour == 12:
        hour = 0

    if not (0 <= hour <= 23 and 0 <= minute <= 59):
        return None
    return hour, minute


def to_wall_clock_utc(
    day: Optional[datetime], clock: Optional[Tuple[int, int]]
) -> Optional[str]:
    """
    Compose the wall-clock UTC string the TMS stores.

    The date and time from the document are the local appointment time, and
    this system stores that value *as* UTC. Converting between zones here
    would move the appointment.
    """
    if day is None:
        return None
    hour, minute = clock or (0, 0)
    return day.replace(hour=hour, minute=minute).strftime("%Y-%m-%dT%H:%M:%S")


def compose_location(
    street: Optional[str],
    city: Optional[str],
    state: Optional[str],
    zip_code: Optional[str],
) -> Optional[str]:
    """
    Mirror of the loads grid's combineLocation(): 'street, city, ST zip'
    with state and zip joined into a single comma-delimited segment.

    Must stay in sync with parseLocation() in the loads page, which splits on
    commas and expects the trailing segment to be the state/zip.
    """
    parts: List[str] = []
    street, city = _clean(street), _clean(city)
    state, zip_code = _clean(state), _clean(zip_code)

    if state:
        state = state.upper()[:2]
    if zip_code:
        m = re.search(r"\d{5}", zip_code)
        zip_code = m.group(0) if m else None

    if street:
        parts.append(street)
    if city:
        parts.append(city)
    if state and zip_code:
        parts.append(f"{state} {zip_code}")
    elif state:
        parts.append(state)
    elif zip_code:
        parts.append(zip_code)

    return ", ".join(parts) or None


def parse_int(value: Optional[str]) -> Optional[int]:
    text = _clean(value)
    if not text:
        return None
    digits = re.sub(r"[^\d]", "", text)
    if not digits:
        return None
    try:
        return int(digits)
    except ValueError:
        return None


# --------------------------------------------------------------------------
# customer resolution
# --------------------------------------------------------------------------

def normalize_company_name(name: Optional[str]) -> str:
    """Lowercase, strip punctuation and legal suffixes, for name comparison."""
    text = _clean(name)
    if not text:
        return ""
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = re.sub(r"[^\w\s]", " ", text.lower())
    tokens = [t for t in text.split() if t and t not in _COMPANY_SUFFIXES]
    return " ".join(tokens)


def _distinctive(normalized: str) -> str:
    """The name without generic freight words, spaces removed ("ch robinson" -> "chrobinson")."""
    core = "".join(t for t in normalized.split() if t not in _GENERIC_FREIGHT_WORDS)
    return core or normalized.replace(" ", "")


@dataclass
class CustomerCandidate:
    id: int
    name: str
    mc: Optional[str]
    score: float
    reason: str


def rank_customers(
    broker_name: Optional[str],
    broker_mc: Optional[str],
    customers: List[Any],
    limit: int = 5,
) -> List[CustomerCandidate]:
    """
    Rank existing customers against the broker named on the document.

    An MC number match is decisive - it is an exact identifier. Name
    similarity is a suggestion only, which is why the caller still requires a
    human to confirm the choice.
    """
    target = normalize_company_name(broker_name)
    mc = _clean(broker_mc)
    mc_digits = re.sub(r"[^\d]", "", mc) if mc else None

    ranked: List[CustomerCandidate] = []
    for customer in customers:
        cust_mc = re.sub(r"[^\d]", "", _clean(getattr(customer, "mc", None)) or "")
        if mc_digits and cust_mc and cust_mc == mc_digits:
            ranked.append(
                CustomerCandidate(
                    id=customer.id,
                    name=customer.name,
                    mc=getattr(customer, "mc", None),
                    score=1.0,
                    reason=f"MC {mc_digits} matches exactly",
                )
            )
            continue

        if not target:
            continue

        candidate_name = normalize_company_name(getattr(customer, "name", None))
        if not candidate_name:
            continue

        target_core = _distinctive(target)
        candidate_core = _distinctive(candidate_name)
        shorter = min(len(target_core), len(candidate_core))

        if candidate_name == target:
            score, reason = 0.95, "Name matches exactly"
        elif shorter >= 4 and (target_core in candidate_core or candidate_core in target_core):
            score, reason = 0.85, "Name contains the other"
        else:
            score = SequenceMatcher(None, target_core, candidate_core).ratio()
            reason = f"Name {int(score * 100)}% similar"

        if score >= 0.60:
            ranked.append(
                CustomerCandidate(
                    id=customer.id,
                    name=customer.name,
                    mc=getattr(customer, "mc", None),
                    score=round(score, 3),
                    reason=reason,
                )
            )

    ranked.sort(key=lambda c: c.score, reverse=True)
    return ranked[:limit]


# --------------------------------------------------------------------------
# the draft
# --------------------------------------------------------------------------

@dataclass
class LoadDraft:
    """Load column values proposed from a document. Not persisted."""

    load_number: Optional[str] = None
    reference_number: Optional[str] = None
    broker_load_number: Optional[str] = None
    bol_number: Optional[str] = None
    po_number: Optional[str] = None
    customer_id: Optional[int] = None
    # The broker as printed on the document, kept so the customer can be
    # re-matched later against the current customer list.
    broker_name: Optional[str] = None
    broker_mc: Optional[str] = None
    pickup_location: Optional[str] = None
    delivery_location: Optional[str] = None
    pickup_date: Optional[str] = None
    delivery_date: Optional[str] = None
    rate: Optional[str] = None
    fuel_surcharge: Optional[str] = None
    accessorial_charges: Optional[str] = None
    miles: Optional[int] = None
    description: Optional[str] = None
    pickup_notes: Optional[str] = None
    # Shown to the driver in the assignment text.
    notes: Optional[str] = None
    pickup_number: Optional[str] = None
    delivery_number: Optional[str] = None
    shipper_name: Optional[str] = None
    receiver_name: Optional[str] = None
    pickup_window: Optional[str] = None
    delivery_window: Optional[str] = None
    status: str = "available"


@dataclass
class MappingResult:
    draft: LoadDraft
    customer_candidates: List[CustomerCandidate] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    low_confidence_fields: List[str] = field(default_factory=list)


def _money_str(amount: Optional[Decimal]) -> Optional[str]:
    """Decimal to a wire string. Never a float."""
    return format(amount, "f") if amount is not None else None


def build_load_draft(
    extraction: RateconExtraction,
    customers: Optional[List[Any]] = None,
) -> MappingResult:
    """Map a rate-confirmation extraction onto Load field values."""
    customers = customers or []
    warnings: List[str] = []
    low_confidence: List[str] = []

    def take(name: str) -> Optional[str]:
        """Read a field, noting it when the model was unsure."""
        f: Optional[ExtractedField] = getattr(extraction, name, None)
        value = field_value(f)
        if value and f and f.confidence < LOW_CONFIDENCE:
            low_confidence.append(name)
        return value

    draft = LoadDraft()

    # --- identifiers. Each stays in its own column; reference_number keeps
    # whatever the broker called a plain "reference" so existing views that
    # read it still see something.
    draft.load_number = take("internal_load_number")
    draft.broker_load_number = take("broker_load_number")
    draft.bol_number = take("bol_number")
    draft.po_number = take("po_number")
    draft.reference_number = draft.broker_load_number or draft.bol_number or draft.po_number

    # --- money
    rate_total = parse_money(take("rate_total"))
    linehaul = parse_money(take("linehaul_rate"))
    fsc = parse_money(take("fuel_surcharge"))
    accessorials = parse_money(take("accessorial_total"))

    if rate_total is None and linehaul is not None:
        # No stated total: fall back to the sum of the parts and say so.
        rate_total = linehaul + (fsc or Decimal(0)) + (accessorials or Decimal(0))
        warnings.append(
            "No total rate stated on the document; summed linehaul, fuel surcharge "
            "and accessorials. Verify before accepting."
        )

    draft.rate = _money_str(rate_total)
    draft.fuel_surcharge = _money_str(fsc)
    draft.accessorial_charges = _money_str(accessorials)

    if draft.rate is None:
        warnings.append("No rate could be read from this document.")

    # --- locations, composed to match the grid's own format
    draft.pickup_location = compose_location(
        take("origin_street"), take("origin_city"),
        take("origin_state"), take("origin_zip"),
    )
    draft.delivery_location = compose_location(
        take("destination_street"), take("destination_city"),
        take("destination_state"), take("destination_zip"),
    )
    if not draft.pickup_location:
        warnings.append("No pickup location could be read from this document.")
    if not draft.delivery_location:
        warnings.append("No delivery location could be read from this document.")

    # --- dates, stored as wall-clock UTC
    pickup_day = parse_date(take("pickup_date"))
    delivery_day = parse_date(take("delivery_date"))
    draft.pickup_date = to_wall_clock_utc(pickup_day, parse_time(take("pickup_time")))
    draft.delivery_date = to_wall_clock_utc(delivery_day, parse_time(take("delivery_time")))

    raw_pickup = field_value(extraction.pickup_date)
    raw_delivery = field_value(extraction.delivery_date)
    if raw_pickup and pickup_day is None:
        warnings.append(f"Could not read a pickup date from {raw_pickup!r}.")
    if raw_delivery and delivery_day is None:
        warnings.append(f"Could not read a delivery date from {raw_delivery!r}.")
    if pickup_day and delivery_day and delivery_day < pickup_day:
        warnings.append(
            "Delivery date is before the pickup date - one of them was read wrong."
        )

    # --- freight details
    draft.miles = parse_int(take("miles"))
    commodity = take("commodity")
    equipment = take("equipment_type")
    weight = take("weight")
    description_bits = [b for b in (commodity, equipment, weight) if b]
    draft.description = " / ".join(description_bits) or None
    draft.pickup_notes = take("special_instructions")
    # Notes column: every reference number on the rate con, grouped by label.
    draft.notes = reference_notes(extraction)
    draft.pickup_number = take("pickup_number")
    draft.delivery_number = take("delivery_number")
    draft.shipper_name = take("origin_company")
    draft.receiver_name = take("destination_company")
    # Appointment windows as printed ("8:00 AM - 3:00 PM"), for the driver.
    draft.pickup_window = take("pickup_time")
    draft.delivery_window = take("delivery_time")

    # --- customer. NOT NULL on loads, so this gates saving.
    broker_name = take("broker_name")
    broker_mc = take("broker_mc_number")
    candidates = rank_customers(broker_name, broker_mc, customers)
    draft.broker_name = broker_name
    draft.broker_mc = broker_mc

    if candidates and candidates[0].score >= 0.95:
        draft.customer_id = candidates[0].id
    elif broker_name:
        warnings.append(
            f"Broker {broker_name!r} did not match an existing customer closely enough "
            "- pick or create one before saving."
        )
    else:
        warnings.append(
            "No broker name could be read, so no customer could be matched."
        )

    # --- extra stops are reported, not modelled: the Load table has no stops
    if extraction.additional_stops:
        warnings.append(
            f"Document lists {len(extraction.additional_stops)} additional stop(s), "
            "which this load record cannot represent yet."
        )

    if low_confidence:
        warnings.append(
            "Low confidence on: " + ", ".join(sorted(set(low_confidence))) + "."
        )

    return MappingResult(
        draft=draft,
        customer_candidates=candidates,
        warnings=warnings,
        low_confidence_fields=sorted(set(low_confidence)),
    )


def extraction_field_map(extraction: RateconExtraction) -> Dict[str, Dict[str, Any]]:
    """
    Flatten the extraction into {field: {value, confidence, source_text}} so
    the review UI can show what was read and where it came from.
    """
    out: Dict[str, Dict[str, Any]] = {}
    for name, value in extraction.model_dump().items():
        if isinstance(value, dict) and "confidence" in value:
            out[name] = {
                "value": value.get("value"),
                "confidence": value.get("confidence"),
                "source_text": value.get("source_text"),
            }
    return out

_LABEL_ORDER = ["PO", "BOL", "PU", "DEL", "Appt", "Order", "Load", "Shipment", "Trip", "PRO", "Confirmation", "Ref", "Seal"]


def reference_notes(extraction) -> Optional[str]:
    """
    'PO# 5521-A, 5521-B · BOL# 88217643 · PU# 55821 · Order# 1283004'.

    Every number the model listed, de-duplicated and grouped by label, plus
    the dedicated identifier fields in case a number wasn't repeated there.
    """
    groups: dict = {}
    seen: set = set()

    def add(label: Optional[str], value: Optional[str]) -> None:
        lab = (label or "Ref").strip().rstrip("#:. ") or "Ref"
        # Not reference numbers, whatever the model labelled them.
        if re.search(r"phone|fax|tel|cell|mobile|\bmc\b|\bdot\b|scac|zip|postal|nmfc|weight|amount|rate", lab, re.I):
            return
        for known in _LABEL_ORDER:  # normalise case, e.g. 'po' -> 'PO'
            if lab.lower() == known.lower():
                lab = known
        # A field sometimes holds a list ("SYSTEM_AUTO,7364143449,7365399820"):
        # one entry per number, and only tokens that contain a digit.
        for v in re.split(r"[,;/\s]+", value or ""):
            v = v.strip(" .#:")
            key = re.sub(r"[^A-Za-z0-9]", "", v).upper()
            if len(key) < 3 or not any(ch.isdigit() for ch in v) or key in seen:
                continue
            seen.add(key)
            groups.setdefault(lab, []).append(v)

    for item in getattr(extraction, "reference_numbers", None) or []:
        add(getattr(item, "label", None), getattr(item, "value", None))
    for label, name in (("PO", "po_number"), ("BOL", "bol_number"), ("PU", "pickup_number"),
                        ("DEL", "delivery_number"), ("Load", "broker_load_number"), ("Ref", "internal_load_number")):
        add(label, field_value(getattr(extraction, name, None)))

    if not groups:
        return None
    order = {k: i for i, k in enumerate(_LABEL_ORDER)}
    parts = [f"{lab}# {', '.join(vals)}" for lab, vals in sorted(groups.items(), key=lambda kv: order.get(kv[0], 99))]
    return " · ".join(parts)
