"""Notification campaign model for admin-sent bulk notifications."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin
from app.models.notification import CampaignStatusEnum

if TYPE_CHECKING:
    from app.models.event import Event
    from app.models.notification import Notification
    from app.models.user import User


class NotificationCampaign(Base, UUIDMixin):
    """A bulk notification campaign sent by an admin for an event."""

    __tablename__ = "notification_campaigns"

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
    )
    sender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    recipient_criteria: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    channels: Mapped[list[str]] = mapped_column(JSONB, nullable=False)
    recipient_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    delivered_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    failed_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    status: Mapped[CampaignStatusEnum] = mapped_column(
        Enum(
            CampaignStatusEnum,
            name="campaign_status_enum",
            values_callable=lambda x: [e.value for e in x],
            create_type=False,
        ),
        nullable=False,
        default=CampaignStatusEnum.DRAFT,
        server_default=CampaignStatusEnum.DRAFT.value,
    )
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    event: Mapped["Event"] = relationship("Event")
    sender: Mapped["User"] = relationship("User")
    notifications: Mapped[list["Notification"]] = relationship(
        "Notification", back_populates="campaign"
    )
