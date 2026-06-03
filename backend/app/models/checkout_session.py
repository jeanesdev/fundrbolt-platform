"""Checkout session, item, and audit log models."""

from __future__ import annotations

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
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.user import User


class CheckoutStatusEnum(str, enum.Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETE = "complete"


class CheckoutPaymentMethodEnum(str, enum.Enum):
    CARD = "card"
    CASH = "cash"
    CHECK = "check"
    DAF = "daf"


class CheckoutItemSourceTypeEnum(str, enum.Enum):
    AUCTION_WIN = "auction_win"
    QUICK_ENTRY_BID = "quick_entry_bid"
    QUICK_ENTRY_DONATION = "quick_entry_donation"
    TICKET = "ticket"
    REVENUE_GENERATOR = "revenue_generator"
    SURVEY_DISCOUNT = "survey_discount"
    SURVEY_DONATE_BACK = "survey_donate_back"
    MANUAL = "manual"


class CheckoutAuditActionEnum(str, enum.Enum):
    ITEM_ADDED = "item_added"
    ITEM_REMOVED = "item_removed"
    ITEM_REPRICED = "item_repriced"


class CheckoutSession(Base, UUIDMixin, TimestampMixin):
    """A donor's checkout session for a specific event."""

    __tablename__ = "checkout_sessions"

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[CheckoutStatusEnum] = mapped_column(
        Enum(
            CheckoutStatusEnum,
            name="checkout_status_enum",
            values_callable=lambda x: [e.value for e in x],
            create_type=False,
        ),
        nullable=False,
        server_default=CheckoutStatusEnum.NOT_STARTED.value,
    )
    payment_method: Mapped[CheckoutPaymentMethodEnum | None] = mapped_column(
        Enum(
            CheckoutPaymentMethodEnum,
            name="checkout_payment_method_enum",
            values_callable=lambda x: [e.value for e in x],
            create_type=False,
        ),
        nullable=True,
    )
    cover_processing_fee: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default="true",
    )
    auctioneer_tip_cents: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default="5000",
    )
    platform_tip_cents: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default="0",
    )
    subtotal_cents: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default="0",
    )
    processing_fee_cents: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default="0",
    )
    total_cents: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default="0",
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    receipt_url: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    items_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    items: Mapped[list[CheckoutItem]] = relationship(
        "CheckoutItem",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="CheckoutItem.display_order",
        lazy="select",
    )
    audit_logs: Mapped[list[CheckoutAuditLog]] = relationship(
        "CheckoutAuditLog",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="CheckoutAuditLog.created_at",
        lazy="select",
    )
    user: Mapped[User] = relationship(
        "User",
        foreign_keys=[user_id],
        lazy="select",
    )

    __table_args__ = (
        UniqueConstraint("event_id", "user_id", name="uq_checkout_sessions_event_user"),
        Index("ix_checkout_sessions_event_status", "event_id", "status"),
    )


class CheckoutItem(Base, UUIDMixin, TimestampMixin):
    """A single line item within a checkout session."""

    __tablename__ = "checkout_items"

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("checkout_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    original_amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    adjusted_amount_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source_type: Mapped[CheckoutItemSourceTypeEnum] = mapped_column(
        Enum(
            CheckoutItemSourceTypeEnum,
            name="checkout_item_source_type_enum",
            values_callable=lambda x: [e.value for e in x],
            create_type=False,
        ),
        nullable=False,
        server_default=CheckoutItemSourceTypeEnum.MANUAL.value,
    )
    source_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    session: Mapped[CheckoutSession] = relationship(
        "CheckoutSession",
        back_populates="items",
        lazy="select",
    )

    @property
    def effective_amount_cents(self) -> int:
        """Return adjusted amount if set, otherwise original amount."""
        if self.adjusted_amount_cents is not None:
            return self.adjusted_amount_cents
        return self.original_amount_cents


class CheckoutAuditLog(Base, UUIDMixin):
    """Audit trail for admin modifications to checkout sessions."""

    __tablename__ = "checkout_audit_logs"

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("checkout_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    admin_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    action: Mapped[CheckoutAuditActionEnum] = mapped_column(
        Enum(
            CheckoutAuditActionEnum,
            name="checkout_audit_action_enum",
            values_callable=lambda x: [e.value for e in x],
            create_type=False,
        ),
        nullable=False,
    )
    item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("checkout_items.id", ondelete="SET NULL"),
        nullable=True,
    )
    field_changed: Mapped[str | None] = mapped_column(String(50), nullable=True)
    before_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    after_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default="now()",
        nullable=False,
    )

    session: Mapped[CheckoutSession] = relationship(
        "CheckoutSession",
        back_populates="audit_logs",
        lazy="select",
    )
    admin_user: Mapped[User] = relationship(
        "User",
        foreign_keys=[admin_user_id],
        lazy="select",
    )
    item: Mapped[CheckoutItem | None] = relationship(
        "CheckoutItem",
        foreign_keys=[item_id],
        lazy="select",
    )
