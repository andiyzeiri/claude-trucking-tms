"""
Lumper receipts found on proofs of delivery.

The classifier reports whether a POD (or a photo a driver sends) contains a
lumper / unloading-service receipt and its total. This module writes that
total onto the AI load's draft as `lumper_amount`, a two-decimal string.
"""

import logging
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import List, Optional, Tuple

from app.documents.mapping import parse_money
from app.models.loads_ai import IngestedDocument

logger = logging.getLogger(__name__)


def lumper_total(classification) -> Optional[Decimal]:
    """The lumper total from a classification, or None."""
    if not getattr(classification, "lumper_receipt", False):
        return None
    try:
        amount = parse_money(getattr(classification, "lumper_amount", None))
    except (InvalidOperation, TypeError, ValueError):
        amount = None
    if amount is None or amount <= 0 or amount > Decimal("5000"):
        return None  # missing, or implausible for a lumper receipt
    return amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def apply_lumper(ai_load: IngestedDocument, amount: Decimal, vendor: Optional[str]) -> str:
    """
    Record a lumper total on an AI load. Returns what happened:
      set       - recorded
      same      - already recorded with this amount
      conflict  - a different amount is already there; left as is
    """
    draft = dict(ai_load.draft or {})
    current = draft.get("lumper_amount")
    if current not in (None, ""):
        try:
            if Decimal(str(current)) == amount:
                return "same"
        except InvalidOperation:
            pass
        return "conflict"
    draft["lumper_amount"] = f"{amount:.2f}"
    if vendor:
        draft["lumper_vendor"] = vendor[:80]
    ai_load.draft = draft
    return "set"


async def scan_media_for_lumper(ai_load_id: int, files: List[Tuple[bytes, str, str]]) -> None:
    """
    Background task for photos/PDFs a driver texted in: look for a lumper
    receipt and record its total on the AI load. Owns its session; never raises.
    """
    from app.database import AsyncSessionLocal
    from app.documents.extraction.base import DocumentBytes
    from app.documents.extraction.registry import get_extractor

    readable = {"application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp"}
    try:
        extractor = get_extractor()
    except Exception as e:
        logger.info("lumper: extraction unavailable (%s)", e)
        return
    for content, ctype, name in files:
        if ctype not in readable:
            continue
        try:
            c = (await extractor.classify(DocumentBytes(content=content, content_type=ctype, filename=name))).classification
        except Exception as e:
            logger.warning("lumper: could not read %s: %s", name, e)
            continue
        amount = lumper_total(c)
        if amount is None:
            continue
        async with AsyncSessionLocal() as db:
            doc = await db.get(IngestedDocument, ai_load_id)
            if doc is None:
                return
            outcome = apply_lumper(doc, amount, c.lumper_vendor)
            await db.commit()
            logger.info("lumper: $%s from texted %s on AI load %s: %s", amount, name, ai_load_id, outcome)
