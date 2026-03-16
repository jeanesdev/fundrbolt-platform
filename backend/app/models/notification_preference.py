"""Notification preference model for per-user channel preferences."""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin
from app.models.notification import DeliveryChannelEnum, NotificationTypeEnum

if TYPE_CHECKING:
    from app.models.user import User


class NotificationPreference(Base, UUIDMixin, TimestampMixin):
    """Per-user preference for a notification type and delivery channel."""

    __tablename__ = "notification_preferences"

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
            create_type=False,
        ),
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
    enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="notification_preferences")

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "notification_type",
            "channel",
            name="uq_notification_preference_user_type_channel",
        ),
    )
