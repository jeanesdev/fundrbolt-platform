"""EventNudgeNotificationLog model for deduplicating async nudge notifications."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.models.base import Base, UUIDMixin


class EventNudgeNotificationLog(Base, UUIDMixin):
    __tablename__ = "event_nudge_notification_logs"

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    nudge_key: Mapped[str] = mapped_column(String(200), nullable=False)
    notified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=func.now()
    )

    __table_args__ = (
        UniqueConstraint("event_id", "nudge_key", name="uq_event_nudge_notification_log"),
    )
