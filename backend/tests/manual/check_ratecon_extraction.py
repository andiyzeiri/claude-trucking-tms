"""
Live end-to-end check of Loads AI rate-confirmation extraction.

Generates a synthetic rate confirmation PDF, runs it through the real
extractor (a LIVE Claude API call) and the real mapping layer, then asserts
the resulting load draft against known-correct values.

This is NOT part of the test suite - it costs money and needs network. Run it
by hand after changing the extraction schema, the prompt, or the mapping.

    pip install reportlab          # not a project dependency
    export ANTHROPIC_API_KEY=...   # or rely on backend/.env
    python tests/manual/check_ratecon_extraction.py

Cost: roughly $0.06 per run (one classification + one extraction call on
claude-opus-5). Takes about 30 seconds.
"""

import asyncio
import io
import json
import os

from reportlab.lib.pagesizes import LETTER
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas


def make_ratecon_pdf() -> bytes:
    """A plausible broker rate confirmation, with the usual messiness."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=LETTER)
    w, h = LETTER
    y = h - 0.7 * inch

    def line(text, dy=14, font="Helvetica", size=9, x=0.7 * inch):
        nonlocal y
        c.setFont(font, size)
        c.drawString(x, y, text)
        y -= dy

    line("TOTAL QUALITY LOGISTICS, LLC", 18, "Helvetica-Bold", 14)
    line("4289 Ivy Pointe Blvd, Cincinnati, OH 45245")
    line("MC# 575199    USDOT# 1538130    Phone: (800) 580-3101")
    y -= 8
    line("RATE AND LOAD CONFIRMATION", 20, "Helvetica-Bold", 12)

    line("TQL Load #: 24918477", 14, "Helvetica-Bold", 10)
    line("Carrier: ABSOLUTE TRANSPORTATION LLC     Carrier Pro: L-2025-000418")
    line("Customer Ref / PO#: PO-4471-B      BOL #: 8827341")
    y -= 10

    line("SHIPPER / PICKUP", 14, "Helvetica-Bold", 10)
    line("Midwest Paper Products")
    line("1420 W Industrial Dr, Elgin, IL 60123-2241")
    line("Pickup Date: 03/18/2026      Appointment: 0800-1200")
    line("Pickup # 55120")
    y -= 10

    line("CONSIGNEE / DELIVERY", 14, "Helvetica-Bold", 10)
    line("Lone Star Distribution Center")
    line("8800 Stemmons Freeway, Dallas, TX 75247")
    line("Delivery Date: 03/20/2026     Appointment: 2:30 PM")
    y -= 10

    line("EQUIPMENT & FREIGHT", 14, "Helvetica-Bold", 10)
    line("Equipment: 53' Dry Van        Commodity: Paper Goods - Palletized")
    line("Weight: 42,500 lbs           Pieces: 26 pallets     Miles: 968")
    y -= 10

    line("RATE BREAKDOWN", 14, "Helvetica-Bold", 10)
    line("Linehaul .................................. $2,450.00")
    line("Fuel Surcharge ............................ $   385.00")
    line("Lumper (receipt required) ................. $   115.00")
    line("TOTAL CARRIER PAY ......................... $ 2,950.00", 16, "Helvetica-Bold", 10)
    y -= 6

    line("Payment Terms: Net 30 from receipt of signed BOL and invoice.")
    line("Detention: $50/hr after 2 hours free time. Must be noted on BOL.")
    y -= 10

    line("SPECIAL INSTRUCTIONS", 14, "Helvetica-Bold", 10)
    line("Driver must call 30 minutes prior to arrival. No early delivery.")
    line("Trailer must be swept clean. Load bars required.")

    c.showPage()
    c.save()
    return buf.getvalue()


class FakeCustomer:
    def __init__(self, id, name, mc=None):
        self.id, self.name, self.mc = id, name, mc


async def main():
    pdf = make_ratecon_pdf()
    print(f"generated sample ratecon PDF: {len(pdf):,} bytes\n")

    from app.documents.extraction.base import DocumentBytes
    from app.documents.extraction.registry import get_extractor
    from app.documents.mapping import build_load_draft

    extractor = get_extractor()
    doc = DocumentBytes(content=pdf, content_type="application/pdf",
                        filename="tql_24918477.pdf")

    print("=" * 72)
    print("CLASSIFICATION (live call)")
    print("=" * 72)
    cls = await extractor.classify(doc)
    print(f"  doc_type   : {cls.classification.doc_type}")
    print(f"  confidence : {cls.classification.confidence}")
    print(f"  reasoning  : {cls.classification.reasoning}")
    print(f"  latency    : {cls.usage.latency_ms} ms")

    print()
    print("=" * 72)
    print("EXTRACTION (live call)")
    print("=" * 72)
    result = await extractor.extract_ratecon(doc)
    ex = result.extraction

    for name, payload in ex.model_dump().items():
        if isinstance(payload, dict) and "confidence" in payload:
            if payload.get("value") is None:
                continue
            print(f"  {name:24} {str(payload['value'])[:38]:40} conf={payload['confidence']:.2f}")
    if ex.additional_stops:
        print(f"  additional_stops         {len(ex.additional_stops)}")

    print(f"\n  tokens: {result.usage.input_tokens} in / {result.usage.output_tokens} out"
          f"  |  latency: {result.usage.latency_ms} ms  |  model: {result.usage.model}")

    inp = result.usage.input_tokens or 0
    out = result.usage.output_tokens or 0
    cost = inp / 1_000_000 * 5 + out / 1_000_000 * 25
    cls_cost = ((cls.usage.input_tokens or 0) / 1_000_000 * 5
                + (cls.usage.output_tokens or 0) / 1_000_000 * 25)
    print(f"  cost: ${cost:.4f} extraction + ${cls_cost:.4f} classification "
          f"= ${cost + cls_cost:.4f} this document")

    print()
    print("=" * 72)
    print("MAPPED LOAD DRAFT (deterministic, no model involved)")
    print("=" * 72)
    customers = [
        FakeCustomer(7, "Total Quality Logistics LLC", mc="575199"),
        FakeCustomer(9, "C.H. Robinson", mc="384859"),
        FakeCustomer(12, "Landstar Ranger", mc=None),
    ]
    mapped = build_load_draft(ex, customers=customers)
    for field, value in vars(mapped.draft).items():
        print(f"  {field:22} {value!r}")

    print("\n  customer candidates:")
    for cand in mapped.customer_candidates:
        print(f"    #{cand.id} {cand.name:34} {cand.score:.2f}  {cand.reason}")

    print("\n  warnings:")
    if not mapped.warnings:
        print("    (none)")
    for wmsg in mapped.warnings:
        print(f"    - {wmsg}")

    print()
    print("=" * 72)
    print("EXPECTED vs GOT")
    print("=" * 72)
    d = mapped.draft
    expectations = [
        ("broker load number", d.broker_load_number, "24918477"),
        ("internal load number", d.load_number, "L-2025-000418"),
        ("BOL", d.bol_number, "8827341"),
        ("PO", d.po_number, "PO-4471-B"),
        ("total rate", d.rate, "2950.00"),
        ("fuel surcharge", d.fuel_surcharge, "385.00"),
        ("customer resolved by MC", d.customer_id, 7),
        ("pickup wall-clock (0800 window start)", d.pickup_date, "2026-03-18T08:00:00"),
        ("delivery wall-clock (2:30 PM)", d.delivery_date, "2026-03-20T14:30:00"),
        ("miles", d.miles, 968),
    ]
    bad = 0
    for label, got, want in expectations:
        ok = str(got) == str(want)
        bad += not ok
        print(f"  {'ok  ' if ok else 'MISS'} {label:40} got={got!r} want={want!r}")
    print(f"\n  pickup_location : {d.pickup_location!r}")
    print(f"  delivery_location: {d.delivery_location!r}")
    print(f"\n{'ALL EXPECTATIONS MET' if not bad else f'{bad} field(s) differed - see above'}")


asyncio.run(main())
