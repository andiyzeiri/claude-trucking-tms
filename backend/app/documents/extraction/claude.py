"""
Anthropic (direct API) document extractor.

Claude reads PDFs natively - the PDF goes in as a `document` content block and
the model sees both the text layer and the rendered pages. That removes the
need for a separate OCR or rasterization step, including for photographed
paperwork, which goes in as an `image` block instead.

Output is constrained by a JSON Schema via `output_config.format`, so the
response is guaranteed to parse into the Pydantic model rather than being
regexed out of prose.
"""

import base64
import json
import logging
import time
from typing import Any, Dict, Optional

from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.documents.extraction.base import (
    ClassificationResult,
    DocumentBytes,
    ExtractionError,
    ExtractionUnavailable,
    ExtractionUsage,
    RateconResult,
)
from app.documents.extraction.schemas import (
    CLASSIFICATION_SYSTEM_PROMPT,
    EXTRACTION_SYSTEM_PROMPT,
    DocumentClassification,
    RateconExtraction,
    strict_json_schema,
)

logger = logging.getLogger(__name__)

PROMPT_VERSION = "v1"
SCHEMA_VERSION = "v1"

# Media types we will hand to the model. Anything else is rejected upstream.
PDF_MEDIA_TYPE = "application/pdf"
IMAGE_MEDIA_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}


class AnthropicExtractor:
    """Extractor backed by the Anthropic API."""

    name = "anthropic"

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        key = api_key or settings.ANTHROPIC_API_KEY
        if not key:
            raise ExtractionUnavailable(
                "ANTHROPIC_API_KEY is not configured - document extraction is disabled."
            )

        try:
            from anthropic import Anthropic
        except ImportError as e:  # pragma: no cover - dependency is declared
            raise ExtractionUnavailable(
                "The 'anthropic' package is not installed."
            ) from e

        # Deliberately the *sync* client, driven from a threadpool below.
        #
        # AsyncAnthropic breaks under requirements.txt: its HTTP stack
        # (httpcore2) needs anyio >= 4.5 for `anyio.Lock(fast_acquire=True)`,
        # but requirements.txt pins fastapi==0.104.1, which caps anyio < 4.0.0.
        # With anyio 3.7.1 every async call dies with a misleading
        # "Connection error", and raising anyio violates FastAPI's own pin.
        #
        # The Docker image resolves differently - it installs via Poetry from
        # pyproject.toml, whose ranges give fastapi 0.142 and anyio 4.15, where
        # the async client would work. So the two dependency sources disagree
        # about whether async is viable.
        #
        # Sync-in-a-threadpool is correct under both, which is why it is the
        # choice here. Don't "fix" this back to AsyncAnthropic without first
        # reconciling requirements.txt and pyproject.toml.
        #
        # The call is network-bound, so a worker thread costs almost nothing.
        self._client = Anthropic(
            api_key=key,
            # Keep a hung upstream call from occupying a thread indefinitely.
            timeout=120.0,
            max_retries=2,
        )
        self._model = model or settings.DOCUMENT_AI_MODEL

    # -- content blocks ---------------------------------------------------

    def _document_block(self, doc: DocumentBytes) -> Dict[str, Any]:
        """Wrap the bytes in the right content block for their media type."""
        data = base64.standard_b64encode(doc.content).decode("ascii")

        if doc.content_type == PDF_MEDIA_TYPE:
            return {
                "type": "document",
                "source": {
                    "type": "base64",
                    "media_type": PDF_MEDIA_TYPE,
                    "data": data,
                },
            }

        if doc.content_type in IMAGE_MEDIA_TYPES:
            return {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": doc.content_type,
                    "data": data,
                },
            }

        raise ExtractionError(
            f"Unsupported media type for extraction: {doc.content_type}"
        )

    # -- the call --------------------------------------------------------

    async def _call(
        self,
        doc: DocumentBytes,
        system_prompt: str,
        schema: Dict[str, Any],
        instruction: str,
    ) -> tuple[Dict[str, Any], ExtractionUsage, Dict[str, Any]]:
        started = time.monotonic()

        try:
            # run_in_threadpool keeps the blocking SDK call off the event loop,
            # so one document being read does not stall other requests.
            response = await run_in_threadpool(
                self._client.messages.create,
                model=self._model,
                max_tokens=settings.DOCUMENT_AI_MAX_TOKENS,
                output_config={
                    "effort": settings.DOCUMENT_AI_EFFORT,
                    "format": {"type": "json_schema", "schema": schema},
                },
                # Cached so the prompt is not re-billed per document. The
                # breakpoint sits on the stable system block; the document
                # itself follows it and varies every call.
                system=[
                    {
                        "type": "text",
                        "text": system_prompt,
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
                messages=[
                    {
                        "role": "user",
                        "content": [
                            self._document_block(doc),
                            {"type": "text", "text": instruction},
                        ],
                    }
                ],
            )
        except Exception as e:
            logger.exception("loads-ai: extraction call failed: %s", e)
            raise ExtractionError(f"Document extraction call failed: {e}") from e

        latency_ms = int((time.monotonic() - started) * 1000)

        # A refused request returns 200 with stop_reason 'refusal' and no
        # usable content, so check it before reading content blocks.
        if getattr(response, "stop_reason", None) == "refusal":
            details = getattr(response, "stop_details", None)
            category = getattr(details, "category", None) if details else None
            raise ExtractionError(
                f"The model declined to process this document (category: {category})."
            )

        text = next(
            (b.text for b in response.content if getattr(b, "type", None) == "text"),
            None,
        )
        if not text:
            # Most likely cause is hitting max_tokens before any text block.
            raise ExtractionError(
                f"Model returned no text content (stop_reason={getattr(response, 'stop_reason', None)})."
            )

        try:
            payload = json.loads(text)
        except json.JSONDecodeError as e:
            raise ExtractionError(f"Model output was not valid JSON: {e}") from e

        usage = ExtractionUsage(
            provider=self.name,
            model=getattr(response, "model", self._model),
            input_tokens=getattr(response.usage, "input_tokens", None),
            output_tokens=getattr(response.usage, "output_tokens", None),
            latency_ms=latency_ms,
            prompt_version=PROMPT_VERSION,
            schema_version=SCHEMA_VERSION,
        )

        raw = {
            "id": getattr(response, "id", None),
            "model": getattr(response, "model", None),
            "stop_reason": getattr(response, "stop_reason", None),
            "usage": {
                "input_tokens": usage.input_tokens,
                "output_tokens": usage.output_tokens,
            },
        }

        return payload, usage, raw

    # -- public API ------------------------------------------------------

    async def classify(self, doc: DocumentBytes) -> ClassificationResult:
        payload, usage, _ = await self._call(
            doc,
            CLASSIFICATION_SYSTEM_PROMPT,
            strict_json_schema(DocumentClassification),
            "Classify this document.",
        )
        try:
            classification = DocumentClassification.model_validate(payload)
        except Exception as e:
            raise ExtractionError(f"Classification did not match schema: {e}") from e

        logger.info(
            "loads-ai: classified %s as %s (%.2f) in %sms",
            doc.filename,
            classification.doc_type,
            classification.confidence,
            usage.latency_ms,
        )
        return ClassificationResult(classification=classification, usage=usage)

    async def extract_ratecon(self, doc: DocumentBytes) -> RateconResult:
        payload, usage, raw = await self._call(
            doc,
            EXTRACTION_SYSTEM_PROMPT,
            strict_json_schema(RateconExtraction),
            "Extract the rate confirmation fields from this document.",
        )
        try:
            extraction = RateconExtraction.model_validate(payload)
        except Exception as e:
            raise ExtractionError(f"Extraction did not match schema: {e}") from e

        logger.info(
            "loads-ai: extracted ratecon from %s in %sms (%s in / %s out tokens)",
            doc.filename,
            usage.latency_ms,
            usage.input_tokens,
            usage.output_tokens,
        )
        return RateconResult(extraction=extraction, usage=usage, raw_response=raw)
