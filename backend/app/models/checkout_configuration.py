"""CheckoutConfiguration model — per-event checkout settings."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.event import Event


class CheckoutConfiguration(Base, UUIDMixin, TimestampMixin):
    """Per-event checkout configuration: controls when checkout opens, fee rate, etc."""

    __tablename__ = "checkout_configurations"

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    is_open: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default="false",
    )
    donor_visible: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default="false",
    )
    scheduled_open_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    opened_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    processing_fee_rate: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 4),
        nullable=True,
        comment="Snapshot of processing fee rate at checkout open time",
    )
    cash_instructions: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    celery_task_id: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    event: Mapped[Event] = relationship(
        "Event",
        back_populates="checkout_configuration",
        lazy="select",
    )
