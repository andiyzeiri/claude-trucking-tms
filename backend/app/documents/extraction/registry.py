"""Provider selection for document extraction."""

import logging

from app.config import settings
from app.documents.extraction.base import DocumentExtractor, ExtractionUnavailable

logger = logging.getLogger(__name__)


def get_extractor() -> DocumentExtractor:
    """
    Build the configured extractor.

    Constructed per request rather than cached at import time so a missing
    API key surfaces as a clean 503 on the endpoint instead of breaking
    application startup.
    """
    provider = (settings.DOCUMENT_AI_PROVIDER or "anthropic").lower()

    if provider == "anthropic":
        from app.documents.extraction.claude import AnthropicExtractor

        return AnthropicExtractor()

    raise ExtractionUnavailable(f"Unknown DOCUMENT_AI_PROVIDER: {provider!r}")
