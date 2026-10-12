"""
Second opinion on a rate confirmation from the PDF's own text.

Broker-portal rate confirmations (e.g. DHL through Load Entourage) are
accepted by e-signature, so the model sometimes reads the signed copy as a
proof of delivery. A digitally generated PDF says what it is in its text
layer: one titled as a rate/load confirmation with a dollar amount on it is a
rate confirmation, whatever the signatures look like. Phone photos and scans
have no text layer, so PODs are never affected.
"""

import io
import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)

PAGES = 2
_TITLE = re.compile(
    r"\b(rate\s+confirmation|rate\s+con\b|load\s+confirmation|carrier\s+(load\s+)?confirmation|"
    r"rate\s+agreement|carrier\s+rate\s+agreement|load\s+tender|tender\s+confirmation|"
    r"confirmation\s+of\s+rate|carrier\s+agreement|truckload\s+confirmation|"
    r"shipment\s+confirmation\s+and\s+rate)\b",
    re.IGNORECASE,
)
_MONEY = re.compile(r"\$\s?\d[\d,]*(\.\d{2})?|\b\d[\d,]*\.\d{2}\s?(usd)\b", re.IGNORECASE)


def pdf_text(content: bytes, pages: int = PAGES) -> str:
    """Text layer of the first pages of a PDF ('' for scans, images, errors)."""
    if not content.startswith(b"%PDF"):
        return ""
    try:
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(content))
        return "\n".join((p.extract_text() or "") for p in reader.pages[:pages])
    except Exception as e:  # damaged or encrypted PDF: no opinion
        logger.info("text_check: could not read PDF text: %s", e)
        return ""


def ratecon_title(content: bytes) -> Optional[str]:
    """The rate-confirmation title printed in the PDF's text, if it reads as one."""
    text = pdf_text(content)
    if not text.strip():
        return None
    title = _TITLE.search(text)
    if title is None or not _MONEY.search(text):
        return None
    return re.sub(r"\s+", " ", title.group(0)).strip()
