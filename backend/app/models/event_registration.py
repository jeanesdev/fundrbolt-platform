"""Event registration models for donor event registration and management."""

import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.event import Event
    from app.models.meal_selection import MealSelection
    from app.models.registration_guest import RegistrationGuest
    from app.models.user import User


class RegistrationStatus(str, enum.Enum):
    """Event registration status."""

    PENDING = "pending"  # Awaiting confirmation (future use)
    CONFIRMED = "confirmed"  # Confirmed attendance
    CANCELLED = "cancelled"  # User cancelled registration
    WAITLISTED = "waitlisted"  # Event at capacity (future use)


class EventRegistration(Base, UUIDMixin, TimestampMixin):
    """Event registration linking a donor (user) to an event.

    Business Rules:
    - One registration per user per event (enforced via unique constraint)
    - Cannot register for events that have ended
    - Status changes: pending → confirmed, confirmed → cancelled
    - Soft delete via cancelled status (preserves historical data)
    - Cannot cancel after event start time
    - Guest count can be updated before the event
    - Primary registrant can add/update guest information before the event

    State Transitions:
    - PENDING → CONFIRMED (admin confirms registration)
    - PENDING → CANCELLED (user/admin cancels before confirmation)
    - CONFIRMED → CANCELLED (user cancels confirmed registration)
    - CONFIRMED → WAITLISTED (not implemented in initial version)
    - WAITLISTED → CONFIRMED (not implemented in initial version)

    Invalid Transitions:
    - CANCELLED → CONFIRMED (no reactivation)
    - CANCELLED → PENDING (no reactivation)
    """

    __tablename__ = "event_registrations"

    # Foreign Keys
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Registration Details
    status: Mapped[RegistrationStatus] = mapped_column(
        String(20),
        nullable=False,
        default=RegistrationStatus.CONFIRMED,
        index=True,
    )
    ticket_type: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Type of ticket (future use: VIP, General, etc.)",
    )
    number_of_guests: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
        comment="Number of guests (including registrant)",
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="event_registrations")
    event: Mapped["Event"] = relationship("Event", back_populates="registrations")
    guests: Mapped[list["RegistrationGuest"]] = relationship(
        "RegistrationGuest",
        back_populates="registration",
        cascade="all, delete-orphan",
    )
    meal_selections: Mapped[list["MealSelection"]] = relationship(
        "MealSelection",
        back_populates="registration",
        cascade="all, delete-orphan",
    )

    # Unique Constraints
    __table_args__ = (
        {
            "comment": "Event registrations linking donors to events",
            "indexes": [
                # Composite index for "user's confirmed events" queries
                {"name": "idx_user_event_status", "columns": ["user_id", "event_id", "status"]},
            ],
            "unique_constraints": [
                # Prevents duplicate registrations
                {"name": "uq_user_event_registration", "columns": ["user_id", "event_id"]},
            ],
        }
    )
