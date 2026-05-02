"""Revenue Generator winner selection model."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.revenue_generator_entry import RevenueGeneratorEntry
    from app.models.revenue_generator_item import RevenueGeneratorItem
    from app.models.user import User


class WinnerSelectionMethod(str, enum.Enum):
    """Method used to select the winner."""

    RANDOM_DRAW = "random_draw"
    MANUAL = "manual"


class RevenueGeneratorWinnerSelection(Base, UUIDMixin, TimestampMixin):
    """Records a winner selection for a Revenue Generator item."""

    __tablename__ = "revenue_generator_winner_selections"

    revenue_generator_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("revenue_generator_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    winning_entry_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("revenue_generator_entries.id", ondelete="SET NULL"),
        nullable=True,
    )
    winner_name: Mapped[str] = mapped_column(String(255), nullable=False)
    bidder_number: Mapped[int] = mapped_column(Integer, nullable=False)
    selection_method: Mapped[WinnerSelectionMethod] = mapped_column(
        Enum(WinnerSelectionMethod, name="revenue_generator_winner_method"),
        nullable=False,
    )
    selected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(),
    )
    selected_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    item: Mapped[RevenueGeneratorItem] = relationship(
        "RevenueGeneratorItem", back_populates="winner_selections", lazy="select"
    )
    winning_entry: Mapped[RevenueGeneratorEntry | None] = relationship(
        "RevenueGeneratorEntry", lazy="select"
    )
    selected_by: Mapped[User | None] = relationship(
        "User", foreign_keys=[selected_by_user_id], lazy="select"
    )
