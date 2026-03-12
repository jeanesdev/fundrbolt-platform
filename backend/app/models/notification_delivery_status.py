"""Notification delivery status model for tracking per-channel delivery."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin
from app.models.notification import DeliveryChannelEnum, DeliveryStatusEnum

if TYPE_CHECKING:
    from app.models.notification import Notification


class NotificationDeliveryStatus(Base, UUIDMixin):
    """Tracks the delivery status of a notification per channel."""

    __tablename__ = "notification_delivery_statuses"

    notification_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notifications.id", ondelete="CASCADE"),
        nullable=False,
    )
    channel: Mapped[DeliveryChannelEnum] = mapped_column(
        Enum(
            DeliveryChannelEnum,
            name="delivery_channel_enum",
            values_callable=lambda x: [e.value for e in x],
            create_type=False,
        ),
        nullable=False,
    )
    status: Mapped[DeliveryStatusEnum] = mapped_column(
        Enum(
            DeliveryStatusEnum,
            name="delivery_status_enum",
            values_callable=lambda x: [e.value for e in x],
            create_type=False,
        ),
        nullable=False,
        default=DeliveryStatusEnum.PENDING,
        server_default=DeliveryStatusEnum.PENDING.value,
    )
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    external_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    notification: Mapped["Notification"] = relationship(
        "Notification", back_populates="delivery_statuses"
    )

    __table_args__ = (
        UniqueConstraint(
            "notification_id", "channel", name="uq_delivery_status_notification_channel"
        ),
        Index(
            "ix_delivery_status_pending",
            "notification_id",
            postgresql_where=(status == DeliveryStatusEnum.PENDING.value),
        ),
    )
