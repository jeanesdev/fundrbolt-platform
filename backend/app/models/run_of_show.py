"""Run-of-Show models for event timeline management."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class RosRecipientTypeEnum(str, enum.Enum):
    DONORS = "donors"
    AUCTIONEER = "auctioneer"
    ALL_ATTENDEES = "all_attendees"


class RosDeliveryStatusEnum(str, enum.Enum):
    PENDING = "pending"
    DELIVERED = "delivered"
    FAILED = "failed"
    CANCELLED = "cancelled"


class RunOfShowTemplate(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "run_of_show_templates"

    npo_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("npos.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    is_system_default: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    items: Mapped[list[RunOfShowTemplateItem]] = relationship(
        "RunOfShowTemplateItem",
        back_populates="template",
        cascade="all, delete-orphan",
        order_by="RunOfShowTemplateItem.display_order",
        lazy="select",
    )

    __table_args__ = (
        UniqueConstraint("npo_id", "name", name="uq_ros_templates_npo_id_name"),
        CheckConstraint(
            "NOT is_system_default OR npo_id IS NULL",
            name="ck_ros_system_default_no_npo",
        ),
    )


class RunOfShowTemplateItem(Base, UUIDMixin):
    __tablename__ = "run_of_show_template_items"

    template_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("run_of_show_templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    offset_minutes: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    donor_visible_default: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    auctioneer_visible_default: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    template: Mapped[RunOfShowTemplate] = relationship(
        "RunOfShowTemplate", back_populates="items", lazy="select"
    )

    __table_args__ = (
        CheckConstraint("offset_minutes >= 0", name="ck_ros_template_item_offset_nonneg"),
    )


class RunOfShowItem(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "run_of_show_items"

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    scheduled_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    donor_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    auctioneer_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    is_complete: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    notifications: Mapped[list[ScheduledRunOfShowNotification]] = relationship(
        "ScheduledRunOfShowNotification",
        back_populates="ros_item",
        cascade="all, delete-orphan",
        uselist=True,
        lazy="select",
    )

    __table_args__ = (
        CheckConstraint("length(title) >= 1", name="ck_ros_item_title_nonempty"),
        Index("ix_ros_items_event_scheduled_time", "event_id", "scheduled_time"),
    )


class ScheduledRunOfShowNotification(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "scheduled_run_of_show_notifications"

    ros_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("run_of_show_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    message_body: Mapped[str] = mapped_column(Text, nullable=False)
    recipient_type: Mapped[RosRecipientTypeEnum] = mapped_column(
        Enum(
            RosRecipientTypeEnum,
            name="ros_notification_recipient_type_enum",
            values_callable=lambda x: [e.value for e in x],
            create_type=False,
        ),
        nullable=False,
    )
    minutes_before: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    delivery_status: Mapped[RosDeliveryStatusEnum] = mapped_column(
        Enum(
            RosDeliveryStatusEnum,
            name="ros_notification_delivery_status_enum",
            values_callable=lambda x: [e.value for e in x],
            create_type=False,
        ),
        nullable=False,
        server_default="pending",
    )
    celery_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    ros_item: Mapped[RunOfShowItem] = relationship(
        "RunOfShowItem", back_populates="notifications", lazy="select"
    )
