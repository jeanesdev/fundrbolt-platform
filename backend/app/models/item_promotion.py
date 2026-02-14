"""Item promotion models for auction items."""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.auction_item import AuctionItem
    from app.models.event import Event
    from app.models.user import User


class ItemPromotion(Base, UUIDMixin, TimestampMixin):
    """Promotional badge and notice for auction items."""

    __tablename__ = "item_promotions"

    # Relationships
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auction_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        unique=True,  # One promotion per item
    )
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    updated_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    # Promotion content
    badge_label: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notice_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # SQLAlchemy relationships
    auction_item: Mapped["AuctionItem"] = relationship("AuctionItem")
    event: Mapped["Event"] = relationship("Event")
    updated_by: Mapped["User"] = relationship("User")
