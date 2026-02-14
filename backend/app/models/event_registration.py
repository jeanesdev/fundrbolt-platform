"""Event registration models for donor event registration and management."""

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.event import Event
    from app.models.meal_selection import MealSelection
    from app.models.registration_guest import RegistrationGuest
    from app.models.ticket_management import TicketPurchase
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
    ticket_purchase_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ticket_purchases.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Linked ticket purchase (if registration created from a sale)",
    )

    # Registration Details
    number_of_guests: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
        comment="Number of guests (including registrant)",
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="event_registrations")
    event: Mapped["Event"] = relationship("Event", back_populates="registrations")
    ticket_purchase: Mapped["TicketPurchase | None"] = relationship(
        "TicketPurchase",
        back_populates="registrations",
    )
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
    __table_args__ = (UniqueConstraint("user_id", "event_id", name="uq_user_event_registration"),)

    def _primary_guest(self) -> "RegistrationGuest | None":
        for guest in self.guests:
            if getattr(guest, "is_primary", False):
                return guest
        return None

    def _ensure_primary_guest(self, status_value: str | None = None) -> "RegistrationGuest":
        primary = self._primary_guest()
        if primary:
            if status_value is not None:
                primary.status = status_value
            return primary

        from app.models.registration_guest import RegistrationGuest

        primary = RegistrationGuest(
            user_id=self.user_id,
            name=None,
            email=None,
            phone=None,
            status=status_value or RegistrationStatus.CONFIRMED.value,
            is_primary=True,
        )
        self.guests.append(primary)
        return primary

    @property
    def status(self) -> str:
        primary = self._primary_guest()
        if primary and primary.status:
            override = self.__dict__.pop("_status_override", None)
            if override is not None:
                primary.status = override
            return str(primary.status)
        override = self.__dict__.get("_status_override")
        if override is not None:
            return str(override)
        return RegistrationStatus.CONFIRMED.value

    @status.setter
    def status(self, value: RegistrationStatus | str) -> None:
        status_value = value.value if isinstance(value, RegistrationStatus) else str(value)
        self._ensure_primary_guest(status_value)
        self.__dict__["_status_override"] = status_value

    @property
    def cancellation_reason(self) -> str | None:
        primary = self._primary_guest()
        if primary:
            override = self.__dict__.pop("_cancellation_reason_override", None)
            if override is not None:
                primary.cancellation_reason = override
            return primary.cancellation_reason
        return self.__dict__.get("_cancellation_reason_override")

    @cancellation_reason.setter
    def cancellation_reason(self, value: str | None) -> None:
        primary = self._ensure_primary_guest()
        primary.cancellation_reason = value
        self.__dict__["_cancellation_reason_override"] = value

    @property
    def cancellation_note(self) -> str | None:
        primary = self._primary_guest()
        if primary:
            override = self.__dict__.pop("_cancellation_note_override", None)
            if override is not None:
                primary.cancellation_note = override
            return primary.cancellation_note
        return self.__dict__.get("_cancellation_note_override")

    @cancellation_note.setter
    def cancellation_note(self, value: str | None) -> None:
        primary = self._ensure_primary_guest()
        primary.cancellation_note = value
        self.__dict__["_cancellation_note_override"] = value

    @property
    def check_in_time(self) -> datetime | None:
        primary = self._primary_guest()
        if primary:
            override = self.__dict__.pop("_check_in_time_override", None)
            if override is not None:
                primary.check_in_time = override
            return primary.check_in_time
        return self.__dict__.get("_check_in_time_override")

    @check_in_time.setter
    def check_in_time(self, value: datetime | None) -> None:
        primary = self._ensure_primary_guest()
        primary.check_in_time = value
        self.__dict__["_check_in_time_override"] = value
