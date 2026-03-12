"""Notification model for donor real-time notifications."""

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin

if TYPE_CHECKING:
    from app.models.event import Event
    from app.models.notification_campaign import NotificationCampaign
    from app.models.notification_delivery_status import NotificationDeliveryStatus
    from app.models.user import User


class NotificationTypeEnum(str, enum.Enum):
    """Types of notifications that can be sent to donors."""

    OUTBID = "outbid"
    AUCTION_OPENED = "auction_opened"
    AUCTION_CLOSING_SOON = "auction_closing_soon"
    AUCTION_CLOSED = "auction_closed"
    ITEM_WON = "item_won"
    ADMIN_BID_PLACED = "admin_bid_placed"
    PADDLE_RAISE = "paddle_raise"
    CHECKOUT_REMINDER = "checkout_reminder"
    BID_CONFIRMATION = "bid_confirmation"
    PROXY_BID_TRIGGERED = "proxy_bid_triggered"
    WELCOME = "welcome"
    CUSTOM = "custom"


class NotificationPriorityEnum(str, enum.Enum):
    """Priority levels for notifications."""

    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class DeliveryChannelEnum(str, enum.Enum):
    """Channels through which notifications can be delivered."""

    INAPP = "inapp"
    PUSH = "push"
    EMAIL = "email"
    SMS = "sms"


class DeliveryStatusEnum(str, enum.Enum):
    """Status of a notification delivery attempt."""

    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    FAILED = "failed"
    SKIPPED = "skipped"


class CampaignStatusEnum(str, enum.Enum):
    """Status of a notification campaign."""

    DRAFT = "draft"
    SENDING = "sending"
    SENT = "sent"
    FAILED = "failed"


class Notification(Base, UUIDMixin):
    """A notification sent to a user for a specific event."""

    __tablename__ = "notifications"

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    notification_type: Mapped[NotificationTypeEnum] = mapped_column(
        Enum(
            NotificationTypeEnum,
            name="notification_type_enum",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[NotificationPriorityEnum] = mapped_column(
        Enum(
            NotificationPriorityEnum,
            name="notification_priority_enum",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        default=NotificationPriorityEnum.NORMAL,
        server_default=NotificationPriorityEnum.NORMAL.value,
    )
    data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    is_read: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    campaign_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notification_campaigns.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    event: Mapped["Event"] = relationship("Event", foreign_keys=[event_id])
    user: Mapped["User"] = relationship(
        "User", foreign_keys=[user_id], back_populates="notifications"
    )
    creator: Mapped["User | None"] = relationship("User", foreign_keys=[created_by])
    campaign: Mapped["NotificationCampaign | None"] = relationship(
        "NotificationCampaign", back_populates="notifications"
    )
    delivery_statuses: Mapped[list["NotificationDeliveryStatus"]] = relationship(
        "NotificationDeliveryStatus",
        back_populates="notification",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index(
            "ix_notifications_user_event",
            "user_id",
            "event_id",
            created_at.desc(),
        ),
        Index(
            "ix_notifications_user_unread",
            "user_id",
            "event_id",
            postgresql_where=(is_read.is_(False)),
        ),
        Index(
            "ix_notifications_expires",
            "expires_at",
            postgresql_where=(expires_at.isnot(None)),
        ),
    )
