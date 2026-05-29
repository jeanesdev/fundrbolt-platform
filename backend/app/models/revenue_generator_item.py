"""Revenue Generator item model."""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.event import Event
    from app.models.revenue_generator_entry import RevenueGeneratorEntry
    from app.models.revenue_generator_winner_selection import RevenueGeneratorWinnerSelection
    from app.models.user import User


class RevenueGeneratorItem(Base, UUIDMixin, TimestampMixin):
    """A Revenue Generator game item for a fundraising event."""

    __tablename__ = "revenue_generator_items"

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    post_purchase_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    price_per_entry: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    max_entries: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
    max_entries_per_person: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_blob_name: Mapped[str | None] = mapped_column(String(512), nullable=True)
    is_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_open_for_entries: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    __table_args__ = (
        CheckConstraint("price_per_entry > 0", name="ck_revenue_generator_items_price_positive"),
        CheckConstraint(
            "max_entries IS NULL OR max_entries > 0",
            name="ck_revenue_generator_items_max_entries_positive",
        ),
        CheckConstraint(
            "max_entries_per_person IS NULL OR max_entries_per_person > 0",
            name="ck_revenue_generator_items_max_entries_per_person_positive",
        ),
    )

    # Relationships
    event: Mapped[Event] = relationship(
        "Event", back_populates="revenue_generator_items", lazy="select"
    )
    creator: Mapped[User | None] = relationship("User", foreign_keys=[created_by], lazy="select")
    entries: Mapped[list[RevenueGeneratorEntry]] = relationship(
        "RevenueGeneratorEntry",
        back_populates="item",
        lazy="select",
        cascade="all, delete-orphan",
    )
    winner_selections: Mapped[list[RevenueGeneratorWinnerSelection]] = relationship(
        "RevenueGeneratorWinnerSelection",
        back_populates="item",
        lazy="select",
        cascade="all, delete-orphan",
        order_by="RevenueGeneratorWinnerSelection.selected_at.desc()",
    )
