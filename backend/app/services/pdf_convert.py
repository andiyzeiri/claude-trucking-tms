"""
Photo -> PDF for documents filed on loads.

Drivers send PODs as phone photos (JPEG, PNG, iPhone HEIC); the POD and
Ratecon columns should always open a PDF. Conversion is best-effort: on any
failure the caller keeps the original image.
"""

import io
import logging
from typing import Optional

logger = logging.getLogger(__name__)

MAX_SIDE = 2400  # px on the long edge; readable when printed, modest file size
_heif_registered = False


def _register_heif() -> None:
    global _heif_registered
    if _heif_registered:
        return
    try:
        from pillow_heif import register_heif_opener

        register_heif_opener()
    except Exception as e:  # pragma: no cover - optional codec
        logger.info("pdf-convert: HEIC support unavailable (%s)", e)
    _heif_registered = True


def is_image(content_type: Optional[str]) -> bool:
    return bool(content_type) and content_type.lower().startswith("image/")


def image_to_pdf(content: bytes) -> Optional[bytes]:
    """A one-page PDF of the image, upright and sized for print; None if it can't be read."""
    try:
        from PIL import Image, ImageOps

        _register_heif()
        img = Image.open(io.BytesIO(content))
        img = ImageOps.exif_transpose(img)  # phones store rotation as a tag
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        if max(img.size) > MAX_SIDE:
            img.thumbnail((MAX_SIDE, MAX_SIDE))
        out = io.BytesIO()
        img.save(out, format="PDF", resolution=200.0)
        return out.getvalue()
    except Exception as e:
        logger.warning("pdf-convert: could not convert image to PDF: %s", e)
        return None


def image_to_jpeg(content: bytes) -> Optional[bytes]:
    """A JPEG copy of an image the model can't read directly (e.g. HEIC); None on failure."""
    try:
        from PIL import Image, ImageOps

        _register_heif()
        img = ImageOps.exif_transpose(Image.open(io.BytesIO(content)))
        if img.mode != "RGB":
            img = img.convert("RGB")
        if max(img.size) > MAX_SIDE:
            img.thumbnail((MAX_SIDE, MAX_SIDE))
        out = io.BytesIO()
        img.save(out, format="JPEG", quality=88)
        return out.getvalue()
    except Exception as e:
        logger.warning("pdf-convert: could not convert image to JPEG: %s", e)
        return None
