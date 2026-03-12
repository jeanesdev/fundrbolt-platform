"""Onboarding session model for wizard state persistence."""

import enum
import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class OnboardingSessionType(str, enum.Enum):
    """Type of onboarding wizard session."""

    USER_SIGNUP = "user_signup"
    NPO_ONBOARDING = "npo_onboarding"


class OnboardingSession(Base):
    """Tracks server-side wizard state for in-progress onboarding.

    Identified by an opaque token sent by the browser.
    Expires after 24 hours. No passwords are stored in form_data.

    Business Rules:
    - Token is generated server-side (UUID v4); never accepted from client.
    - Sessions with expires_at < now() are treated as not found (lazy expiry).
    - At most one active session per user_id per session_type (enforced in service layer).
    """

    __tablename__ = "onboarding_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )

    token: Mapped[str] = mapped_column(
        Text,
        unique=True,
        nullable=False,
        index=True,
    )

    session_type: Mapped[OnboardingSessionType] = mapped_column(
        Enum(
            OnboardingSessionType,
            name="onboardingsessiontype",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
    )

    current_step: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="account",
        server_default="account",
    )

    completed_steps: Mapped[list[str]] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
        server_default="[]",
    )

    form_data: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        server_default="{}",
    )

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    # Relationships
    user: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[user_id],
        lazy="select",
    )

    def is_expired(self) -> bool:
        """Return True if this session has passed its expiry time."""

        return datetime.now(tz=UTC) >= self.expires_at
