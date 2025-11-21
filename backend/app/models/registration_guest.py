"""Registration guest models for managing guest information."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String, DateTime as SADateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.event_registration import EventRegistration
    from app.models.meal_selection import MealSelection
    from app.models.user import User


class RegistrationGuest(Base, UUIDMixin, TimestampMixin):
    """Guest information provided by the primary registrant.

    Business Rules:
    - Guest information is optional (can be added later before the event)
    - Each guest belongs to exactly one event registration
    - Guest can optionally create their own account via admin-sent invitation link
    - If guest creates account, their user_id is linked to guest record
    - Guests without accounts can still attend (on-site registration)
    - Cannot link same user_id to multiple guests in same registration
    """

    __tablename__ = "registration_guests"

    # Foreign Keys
    registration_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("event_registrations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Guest's user account (if created)",
    )

    # Guest Details (all optional)
    name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        comment="Guest's full name",
    )
    email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        index=True,
        comment="Guest's email address",
    )
    phone: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        comment="Guest's phone number",
    )

    # Admin Invitation Tracking
    invited_by_admin: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="Whether admin sent registration link to this guest",
    )
    invitation_sent_at: Mapped[datetime | None] = mapped_column(
        SADateTime(timezone=True),
        nullable=True,
        comment="When admin sent registration link",
    )

    # Relationships
    registration: Mapped["EventRegistration"] = relationship(
        "EventRegistration",
        back_populates="guests",
    )
    user: Mapped["User | None"] = relationship("User", back_populates="guest_records")
    meal_selections: Mapped[list["MealSelection"]] = relationship(
        "MealSelection",
        back_populates="guest",
        cascade="all, delete-orphan",
    )

    # Table Configuration
    __table_args__ = (
        {
            "comment": "Guest information for event registrations",
        }
    )
