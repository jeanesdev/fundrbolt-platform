"""Registration guest models for managing guest information."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy import DateTime as SADateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.event_registration import EventRegistration
    from app.models.event_table import EventTable
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
    checked_in: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="Whether the guest has checked in at the event",
    )

    # Seating and Bidder Number Fields (Feature 012)
    bidder_number: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Three-digit bidder number for auction participation (100-999)",
    )
    table_number: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Assigned table number (NULL = unassigned)",
    )
    bidder_number_assigned_at: Mapped[datetime | None] = mapped_column(
        SADateTime(timezone=True),
        nullable=True,
        comment="Timestamp of initial bidder number assignment (for audit trail)",
    )

    # Table Captain Field (Feature 014)
    is_table_captain: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="Whether this guest is designated as captain of their assigned table",
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
    # Feature 014: Relationship to table where this guest is captain
    captained_table: Mapped["EventTable | None"] = relationship(
        "EventTable",
        back_populates="captain",
        foreign_keys="EventTable.table_captain_id",
        uselist=False,
    )

    # Computed Properties (Feature 012)
    @property
    def has_bidder_number(self) -> bool:
        """Check if bidder number is assigned."""
        return self.bidder_number is not None

    @property
    def has_table_assignment(self) -> bool:
        """Check if table assignment exists."""
        return self.table_number is not None

    @property
    def is_seated(self) -> bool:
        """Check if guest has complete seating (table + bidder number)."""
        return self.has_table_assignment and self.has_bidder_number

    # Table Configuration
    __table_args__ = ()
