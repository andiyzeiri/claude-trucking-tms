"""Driver text messages (POD reminders and replies)."""

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB

from .base import Base


class SmsKind:
    LOAD_ASSIGNED = "load_assigned" # load details sent when a driver is assigned
    POD_REQUEST = "pod_request"     # first text after delivery
    POD_REMINDER = "pod_reminder"   # follow-ups while no POD
    POD_REQUEST_MANUAL = "pod_request_manual"  # "Request POD" button on Loads AI
    POD_ACK = "pod_ack"             # "thanks, we received the POD"
    ESCALATED = "escalated"         # reminders exhausted, load flagged for dispatch
    REPLY = "reply"                 # inbound text without a POD
    POD_MEDIA = "pod_media"         # inbound photo/PDF saved as the POD
    OPT_OUT = "opt_out"
    OPT_IN = "opt_in"


# Outbound kinds that count toward the per-load reminder limit.
# A manual request counts too: replies route to that load, and the automatic
# reminders space themselves from it.
POD_PROMPT_KINDS = (SmsKind.POD_REQUEST, SmsKind.POD_REMINDER, SmsKind.POD_REQUEST_MANUAL)


class LoadSmsMessage(Base):
    __tablename__ = "load_sms_messages"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    load_id = Column(Integer, ForeignKey("loads.id", ondelete="SET NULL"), nullable=True)
    # Driver texting runs on AI loads only (the Loads AI page), which are
    # ingested_documents rows; load_id is unused for those.
    ai_load_id = Column(Integer, ForeignKey("ingested_documents.id", ondelete="SET NULL"), nullable=True)
    driver_id = Column(Integer, ForeignKey("drivers.id", ondelete="SET NULL"), nullable=True)
    direction = Column(String, nullable=False)  # out | in
    kind = Column(String, nullable=False)
    phone = Column(String)
    body = Column(Text)
    media = Column(JSONB)
    twilio_sid = Column(String)
    status = Column(String)
    error = Column(Text)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
