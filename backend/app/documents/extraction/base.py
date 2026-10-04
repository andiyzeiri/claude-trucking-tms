"""
Provider-agnostic extraction interface.

Keeps the rest of the pipeline from depending on a particular model vendor:
swapping Anthropic's direct API for Bedrock, or adding a second provider for
comparison, means adding an implementation here, not touching mapping or the
endpoint.
"""

from dataclasses import dataclass, field
from typing import Optional, Protocol

from app.documents.extraction.schemas import DocumentClassification, RateconExtraction


@dataclass
class DocumentBytes:
    """A document to be read, already validated by the caller."""

    content: bytes
    content_type: str  # sniffed, not taken from the client
    filename: Optional[str] = None


@dataclass
class ExtractionUsage:
    """Per-call metadata worth persisting for audit and cost tracking."""

    provider: str
    model: str
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    latency_ms: Optional[int] = None
    prompt_version: str = "v1"
    schema_version: str = "v1"


@dataclass
class ClassificationResult:
    classification: DocumentClassification
    usage: ExtractionUsage


@dataclass
class RateconResult:
    extraction: RateconExtraction
    usage: ExtractionUsage
    raw_response: dict = field(default_factory=dict)


class ExtractionError(RuntimeError):
    """Raised when a document could not be read or the output did not validate."""


class ExtractionUnavailable(ExtractionError):
    """Raised when no extraction provider is configured."""


class DocumentExtractor(Protocol):
    """What any extraction provider must implement."""

    name: str

    async def classify(self, doc: DocumentBytes) -> ClassificationResult:
        ...

    async def extract_ratecon(self, doc: DocumentBytes) -> RateconResult:
        ...
