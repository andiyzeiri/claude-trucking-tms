"""
Structured output schemas for document extraction.

These are the contract handed to the model as a JSON Schema, so the response
is constrained to this shape rather than parsed out of prose. Three rules
drive the design:

1. Every field is optional. "Not present on the document" is a valid and
   common answer; a guessed broker load number is worse than a blank one.
2. Every field carries its own confidence and the verbatim text it was read
   from, so the review UI can show *why* a value is what it is.
3. Money and dates stay strings here. They are parsed into Decimal/datetime
   by deterministic code in mapping.py - never by the model, and never via
   float.
"""

from typing import Any, Dict, List, Literal, Optional, Type

from pydantic import BaseModel, Field

# Keywords Pydantic emits that the structured-output schema validator rejects.
# Numeric and string constraints are not supported; they are enforced by
# Pydantic on the way back in instead, which is where we want them anyway.
_UNSUPPORTED_SCHEMA_KEYWORDS = {
    "minimum",
    "maximum",
    "exclusiveMinimum",
    "exclusiveMaximum",
    "multipleOf",
    "minLength",
    "maxLength",
    "minItems",
    "maxItems",
    "uniqueItems",
    "patternProperties",
}


def strict_json_schema(model: Type[BaseModel]) -> Dict[str, Any]:
    """
    Produce a JSON Schema the structured-output API will accept.

    Pydantic's own `model_json_schema()` is close but not compliant: every
    object needs `additionalProperties: false` explicitly, unsupported
    validation keywords must be stripped, and every property must be listed
    in `required`.

    Marking everything required does not make fields mandatory in the useful
    sense - optional fields are typed `anyOf: [..., null]`, so the model must
    emit the key but may emit null. That is what we want: a complete object
    with explicit nulls, rather than silently absent keys.
    """
    schema = model.model_json_schema()

    def walk(node: Any) -> None:
        if isinstance(node, list):
            for item in node:
                walk(item)
            return
        if not isinstance(node, dict):
            return

        for keyword in list(node):
            if keyword in _UNSUPPORTED_SCHEMA_KEYWORDS:
                node.pop(keyword)

        if node.get("type") == "object" or "properties" in node:
            node["additionalProperties"] = False
            properties = node.get("properties") or {}
            if properties:
                node["required"] = sorted(properties)

        for value in node.values():
            walk(value)

    walk(schema)
    return schema


class ExtractedField(BaseModel):
    """A single value lifted off a document, with its provenance."""

    value: Optional[str] = Field(
        default=None,
        description="The extracted value, verbatim from the document. Null if not present.",
    )
    confidence: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="0.0-1.0 confidence that this value is correct and correctly labelled.",
    )
    source_text: Optional[str] = Field(
        default=None,
        description="The surrounding text on the document this was read from, for human review.",
    )


class ExtractedStop(BaseModel):
    """An additional pickup or delivery beyond the primary origin/destination."""

    sequence: Optional[int] = Field(default=None, description="Order of this stop, 1-based.")
    stop_type: Optional[Literal["pickup", "delivery"]] = None
    company_name: ExtractedField = Field(default_factory=ExtractedField)
    city: ExtractedField = Field(default_factory=ExtractedField)
    state: ExtractedField = Field(default_factory=ExtractedField)
    scheduled_date: ExtractedField = Field(default_factory=ExtractedField)


class DocumentClassification(BaseModel):
    """What kind of document this is."""

    doc_type: Literal["ratecon", "pod", "bol", "invoice", "other", "unknown"] = Field(
        description="The document type. Use 'unknown' when genuinely unclear."
    )
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: Optional[str] = Field(
        default=None, description="One sentence on what identified it."
    )
    has_signature: bool = Field(
        default=False,
        description="True if a handwritten signature (or signed initials) appears, e.g. a receiver/consignee signing for the freight.",
    )
    appears_scanned: bool = Field(
        default=False,
        description="True if the page looks like a scan or phone photo of paper (skew, shadows, grain, handwriting, stamps) rather than a typed digital PDF.",
    )
    reference_numbers: List[str] = Field(
        default_factory=list,
        description="Every load, order, PRO, BOL, PO, shipment, confirmation or reference number printed on the document, verbatim, one per entry.",
    )
    shipper_name: Optional[str] = Field(default=None, description="Shipper / pickup company, if shown.")
    consignee_name: Optional[str] = Field(default=None, description="Consignee / receiver company, if shown.")
    delivery_city_state: Optional[str] = Field(default=None, description="Delivery city and state, e.g. 'Stow, OH', if shown.")
    lumper_receipt: bool = Field(
        default=False,
        description="True if any page is a lumper / unloading-service receipt (a receipt for paying a third party to unload the trailer).",
    )
    lumper_amount: Optional[str] = Field(
        default=None,
        description="Total paid on the lumper receipt(s) in US dollars, digits only with two decimals, e.g. '185.00'. Include service/convenience fees charged on the receipt. Sum them if there are several receipts. Null if there is no lumper receipt or the total can't be read.",
    )
    lumper_vendor: Optional[str] = Field(
        default=None, description="Company on the lumper receipt (e.g. 'Capstone Logistics'), if shown."
    )


class RateconExtraction(BaseModel):
    """
    Fields lifted from a rate confirmation.

    Field names map onto TMS Load columns in mapping.py. Nothing here is
    written to the database directly.
    """

    # --- Identifiers. These are what make exact document matching possible.
    broker_name: ExtractedField = Field(default_factory=ExtractedField)
    broker_mc_number: ExtractedField = Field(default_factory=ExtractedField)
    broker_load_number: ExtractedField = Field(default_factory=ExtractedField)
    internal_load_number: ExtractedField = Field(default_factory=ExtractedField)
    bol_number: ExtractedField = Field(default_factory=ExtractedField)
    po_number: ExtractedField = Field(default_factory=ExtractedField)

    # --- Money. Strings here; parsed to Decimal downstream.
    rate_total: ExtractedField = Field(default_factory=ExtractedField)
    linehaul_rate: ExtractedField = Field(default_factory=ExtractedField)
    fuel_surcharge: ExtractedField = Field(default_factory=ExtractedField)
    accessorial_total: ExtractedField = Field(default_factory=ExtractedField)

    # --- Origin
    origin_company: ExtractedField = Field(default_factory=ExtractedField)
    origin_street: ExtractedField = Field(default_factory=ExtractedField)
    origin_city: ExtractedField = Field(default_factory=ExtractedField)
    origin_state: ExtractedField = Field(default_factory=ExtractedField)
    origin_zip: ExtractedField = Field(default_factory=ExtractedField)
    pickup_date: ExtractedField = Field(default_factory=ExtractedField)
    pickup_time: ExtractedField = Field(default_factory=ExtractedField)
    pickup_number: ExtractedField = Field(
        default_factory=ExtractedField,
        description="Pickup/appointment/confirmation number for the shipper (PU#, PU number, pickup confirmation, appointment #), verbatim.",
    )

    # --- Destination
    destination_company: ExtractedField = Field(default_factory=ExtractedField)
    destination_street: ExtractedField = Field(default_factory=ExtractedField)
    destination_city: ExtractedField = Field(default_factory=ExtractedField)
    destination_state: ExtractedField = Field(default_factory=ExtractedField)
    destination_zip: ExtractedField = Field(default_factory=ExtractedField)
    delivery_date: ExtractedField = Field(default_factory=ExtractedField)
    delivery_time: ExtractedField = Field(default_factory=ExtractedField)
    delivery_number: ExtractedField = Field(
        default_factory=ExtractedField,
        description="Delivery/appointment/confirmation number for the receiver (DEL#, appointment #, delivery confirmation), verbatim.",
    )

    # --- Freight details
    equipment_type: ExtractedField = Field(default_factory=ExtractedField)
    commodity: ExtractedField = Field(default_factory=ExtractedField)
    weight: ExtractedField = Field(default_factory=ExtractedField)
    miles: ExtractedField = Field(default_factory=ExtractedField)
    special_instructions: ExtractedField = Field(default_factory=ExtractedField)

    additional_stops: List[ExtractedStop] = Field(
        default_factory=list,
        description="Stops beyond the primary origin and destination. Empty when none.",
    )


EXTRACTION_SYSTEM_PROMPT = """\
You extract structured data from freight documents for a trucking company's TMS.

Rules:
- Only report values that actually appear on the document. If a field is not \
present, leave it null. A null is correct; an inferred or guessed value is not.
- Do not calculate, convert, or normalize values. Copy them as they appear. \
Rates keep their digits exactly as printed; dates keep the document's own format.
- Set confidence honestly. Use a low confidence when a label is ambiguous, the \
scan is unclear, or you are inferring which of several numbers is the one asked for.
- For every field you fill in, put the surrounding text you read it from in \
source_text so a human can check it.
- Distinguish identifier types carefully. A broker's load number, a BOL number \
and a PO number are different things and are often all present. If a document \
labels a number only as "Reference", put it in the field whose meaning the \
document supports and leave the others null - do not copy one value into several \
fields.
- "Rate" means what the carrier is paid. If the document breaks out linehaul, \
fuel surcharge and accessorials separately, fill each in as well as the total.
"""

CLASSIFICATION_SYSTEM_PROMPT = """\
You classify freight documents for a trucking company's TMS. The two that \
matter most are rate confirmations and proofs of delivery, and they must not \
be confused: a rate confirmation creates a load, a POD closes one.

- "ratecon" is a rate confirmation: a broker's agreement to pay a carrier a \
stated rate to move a stated load. Usually a typed, digitally generated PDF \
on broker letterhead titled "Rate Confirmation", "Load Confirmation", \
"Carrier Confirmation" or "Carrier Agreement", listing a linehaul rate or \
total pay, pickup and delivery appointments, and terms. It may carry a \
typed or e-signature from the carrier accepting the rate - that does not \
make it a POD.
- "pod" is a proof of delivery: paperwork signed at delivery. Typically a \
scanned or phone-photographed bill of lading or delivery receipt with a \
handwritten receiver/consignee signature, often with a date, a "received in \
good order" line, piece counts, stamps, seal numbers or handwritten notes. \
A bill of lading that has been signed by the receiver IS a "pod".
- "bol" is a bill of lading with no receiver's signature (e.g. a blank or \
shipper-only copy).
- "invoice" is a bill requesting payment.
- "other" is a real document of some other kind.
- "unknown" is for anything you cannot identify, including blank pages, logos, \
email signatures, and unreadable scans.

Lumper receipts: drivers often include a lumper receipt with the POD - a \
receipt from an unloading service (e.g. Capstone Logistics, NFI, Encompass, \
RXO/PAS, Lumper Services, or a warehouse "unloading fee"/"lumper fee") for \
paying someone to unload the trailer, frequently paid by Comdata, EFS or \
fuel card check. Set lumper_receipt when one is present and lumper_amount \
to the total actually charged. A rate confirmation that merely mentions \
lumper reimbursement is NOT a lumper receipt.

Report has_signature and appears_scanned honestly - they are strong evidence \
for a POD. Always list every reference number you can read; they are used to \
match a POD to the load it belongs to.

Prefer "unknown" over a low-confidence guess. Downstream code routes unknown \
documents to a human, which is the correct outcome when the type is unclear.
"""
