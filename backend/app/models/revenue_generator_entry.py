"""Revenue Generator entry model."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.registration_guest import RegistrationGuest
    from app.models.revenue_generator_item import RevenueGeneratorItem
    from app.models.user import User


class RevenueGeneratorEntry(Base, UUIDMixin, TimestampMixin):
    """A single purchased entry for a Revenue Generator item."""

    __tablename__ = "revenue_generator_entries"

    revenue_generator_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("revenue_generator_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    registration_guest_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("registration_guests.id", ondelete="SET NULL"),
        nullable=True,
    )
    bidder_number: Mapped[int] = mapped_column(Integer, nullable=False)
    amount_paid: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    recorded_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    purchased_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(),
    )

    # Relationships
    item: Mapped[RevenueGeneratorItem] = relationship(
        "RevenueGeneratorItem", back_populates="entries", lazy="select"
    )
    registration_guest: Mapped[RegistrationGuest | None] = relationship(
        "RegistrationGuest", lazy="select"
    )
    recorded_by: Mapped[User | None] = relationship(
        "User", foreign_keys=[recorded_by_user_id], lazy="select"
    )
