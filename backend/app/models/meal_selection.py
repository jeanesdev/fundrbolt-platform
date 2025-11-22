"""Meal selection models for managing attendee meal choices."""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.event import FoodOption
    from app.models.event_registration import EventRegistration
    from app.models.registration_guest import RegistrationGuest


class MealSelection(Base, UUIDMixin, TimestampMixin):
    """Meal choice for each attendee (registrant or guest).

    Business Rules:
    - Required during registration if event has meal options
    - One meal selection per attendee (registrant + each guest)
    - Guests arriving without meal selection can choose at event (no database record until on-site)
    - Meal options are defined at event level (foreign key to event_food_options table)
    - guest_id is NULL for the registrant's meal selection
    """

    __tablename__ = "meal_selections"

    # Foreign Keys
    registration_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("event_registrations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    guest_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("registration_guests.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
        comment="Guest who made selection (NULL = registrant)",
    )
    food_option_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("food_options.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Relationships
    registration: Mapped["EventRegistration"] = relationship(
        "EventRegistration",
        back_populates="meal_selections",
    )
    guest: Mapped["RegistrationGuest | None"] = relationship(
        "RegistrationGuest",
        back_populates="meal_selections",
    )
    food_option: Mapped["FoodOption"] = relationship(
        "FoodOption",
    )

    # Table Configuration
    __table_args__ = (
        UniqueConstraint("registration_id", "guest_id", name="uq_registration_guest_meal"),
        Index("idx_registration_guest_meal", "registration_id", "guest_id"),
    )
