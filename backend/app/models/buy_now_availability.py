"""Buy now availability models for auction items."""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.auction_item import AuctionItem
    from app.models.event import Event
    from app.models.user import User


class BuyNowAvailability(Base, UUIDMixin, TimestampMixin):
    """Buy now availability and overrides for auction items."""

    __tablename__ = "buy_now_availability"

    # Relationships
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auction_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        unique=True,  # One availability record per item
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

    # Availability settings
    enabled: Mapped[bool] = mapped_column(
        default=False,
        server_default="false",
        nullable=False,
    )
    remaining_quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    override_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # SQLAlchemy relationships
    auction_item: Mapped["AuctionItem"] = relationship("AuctionItem")
    event: Mapped["Event"] = relationship("Event")
    updated_by: Mapped["User"] = relationship("User")

    # Constraints
    __table_args__ = (
        CheckConstraint("remaining_quantity >= 0", name="ck_buy_now_availability_quantity_nonnegative"),
    )
