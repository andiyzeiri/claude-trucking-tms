"""
What every document source produces.

Email today, Highway or a manual upload later. Everything downstream -
extraction, mapping, load creation - consumes these two shapes and never
learns where the bytes came from.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional


@dataclass
class SourceAttachment:
    """One candidate document lifted off a message."""

    filename: Optional[str]
    content: bytes
    declared_content_type: Optional[str] = None


@dataclass
class SourceMessage:
    """One message from a source, with the attachments worth reading."""

    # Stable identity for deduplication. For email this is the RFC Message-ID.
    message_id: str
    from_address: Optional[str] = None
    to_address: Optional[str] = None
    subject: Optional[str] = None
    received_at: Optional[datetime] = None
    attachments: List[SourceAttachment] = field(default_factory=list)
    # Attachments seen but discarded (logos, signatures, unreadable types),
    # kept as a count so the audit trail explains what was ignored.
    skipped_attachments: int = 0
