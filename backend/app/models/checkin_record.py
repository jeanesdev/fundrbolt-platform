"""Check-in record models for event check-in audit logging."""

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime as SADateTime
from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.event import Event
    from app.models.registration_guest import RegistrationGuest
    from app.models.user import User


class CheckinAction(str, enum.Enum):
    """Check-in action types."""

    CHECK_IN = "check_in"
    CHECK_OUT = "check_out"


class CheckinRecord(Base, UUIDMixin, TimestampMixin):
    """Immutable audit log of check-in actions.

    Business Rules:
    - All check-in and check-out actions must be logged
    - Check-out actions require a reason
    - Records are append-only (never updated or deleted)
    - Used for audit trail and compliance
    """

    __tablename__ = "checkin_records"

    # Foreign Keys
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    registration_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("registration_guests.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Registration guest ID being checked in",
    )
    acted_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="User who performed the action",
    )

    # Action Details
    action: Mapped[CheckinAction] = mapped_column(
        String(20),
        nullable=False,
        comment="check_in or check_out",
    )
    acted_at: Mapped[datetime] = mapped_column(
        SADateTime(timezone=True),
        nullable=False,
        index=True,
        comment="Timestamp of action",
    )
    reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Required for check_out actions",
    )

    # Relationships
    event: Mapped["Event"] = relationship("Event")
    registration: Mapped["RegistrationGuest | None"] = relationship("RegistrationGuest")
    acted_by: Mapped["User"] = relationship("User")

    # Table Configuration
    __table_args__ = (
        Index("idx_checkin_records_event", "event_id"),
        Index("idx_checkin_records_registration", "registration_id"),
        Index("idx_checkin_records_acted_at", "acted_at"),
    )
