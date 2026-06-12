"""EventNudgeDismissal model for revenue nudge tracking."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.models.base import Base, UUIDMixin


class NudgeDismissalAction(str, enum.Enum):
    DISMISSED = "dismissed"
    ACTIONED = "actioned"


class EventNudgeDismissal(Base, UUIDMixin):
    __tablename__ = "event_nudge_dismissals"

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    nudge_key: Mapped[str] = mapped_column(String(200), nullable=False)
    action: Mapped[str] = mapped_column(String(20), nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=func.now()
    )

    __table_args__ = (
        UniqueConstraint("event_id", "user_id", "nudge_key", name="uq_event_nudge_dismissals"),
        Index("ix_event_nudge_dismissals_event_user_expires", "event_id", "user_id", "expires_at"),
        CheckConstraint("action IN ('dismissed', 'actioned')", name="ck_nudge_dismissal_action"),
    )
