"""Ticket management models: custom options, purchases, promo codes, etc."""

import enum
import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy import (
    Enum as SQLEnum,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin

if TYPE_CHECKING:
    from app.models.event import Event
    from app.models.ticket_package import TicketPackage
    from app.models.user import User


class OptionType(str, enum.Enum):
    """Types of custom ticket options."""

    BOOLEAN = "boolean"
    MULTI_SELECT = "multi_select"
    TEXT_INPUT = "text_input"


class DiscountType(str, enum.Enum):
    """Types of promo code discounts."""

    PERCENTAGE = "percentage"
    FIXED_AMOUNT = "fixed_amount"


class PaymentStatus(str, enum.Enum):
    """Payment status for ticket purchases."""

    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"


class CustomTicketOption(Base, UUIDMixin):
    """Custom option/question attached to a ticket package.

    Business Rules:
    - option_type determines validation rules
    - multi_select requires JSONB choices array
    - display_order controls ordering in UI
    - Maximum 4 custom options per ticket package (enforced in service layer)
    """

    __tablename__ = "custom_ticket_options"

    # Foreign Keys
    ticket_package_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ticket_packages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Option Details
    option_label: Mapped[str] = mapped_column(String(200), nullable=False)
    option_type: Mapped[OptionType] = mapped_column(
        SQLEnum(OptionType, name="option_type_enum", native_enum=False),
        nullable=False,
    )
    choices: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    is_required: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    # Relationships
    ticket_package: Mapped["TicketPackage"] = relationship(
        "TicketPackage", back_populates="custom_options"
    )
    responses: Mapped[list["OptionResponse"]] = relationship(
        "OptionResponse",
        back_populates="custom_option",
        cascade="all, delete-orphan",
    )

    # Constraints
    __table_args__ = (
        CheckConstraint(
            "option_type IN ('boolean', 'text_input') OR (option_type = 'multi_select' AND choices IS NOT NULL)",
            name="check_multi_select_has_choices",
        ),
    )

    def __repr__(self) -> str:
        return f"<CustomTicketOption(id={self.id}, label={self.option_label})>"


class OptionResponse(Base, UUIDMixin):
    """Donor's response to a custom ticket option.

    Business Rules:
    - response_value is NULL if donor skipped optional question
    - For boolean: "true" or "false"
    - For multi_select: JSON array of selected choices
    - For text_input: free-form text (max 500 chars)
    """

    __tablename__ = "option_responses"

    # Foreign Keys
    ticket_purchase_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ticket_purchases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    custom_option_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("custom_ticket_options.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Response Data
    response_value: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    # Relationships
    ticket_purchase: Mapped["TicketPurchase"] = relationship(
        "TicketPurchase", back_populates="option_responses"
    )
    custom_option: Mapped["CustomTicketOption"] = relationship(
        "CustomTicketOption", back_populates="responses"
    )

    def __repr__(self) -> str:
        return f"<OptionResponse(id={self.id}, value={self.response_value})>"


class PromoCode(Base, UUIDMixin):
    """Promotional discount code for events.

    Business Rules:
    - code is unique per event (case-insensitive)
    - discount_value > 0, max 100 for percentage
    - max_uses limits total redemptions (NULL = unlimited)
    - valid_from/valid_until define date range (both optional)
    - version enables optimistic locking
    """

    __tablename__ = "promo_codes"

    # Foreign Keys
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )

    # Promo Code Details
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    discount_type: Mapped[DiscountType] = mapped_column(
        SQLEnum(DiscountType, name="discount_type_enum", native_enum=False),
        nullable=False,
    )
    discount_value: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    # Usage Limits
    max_uses: Mapped[int | None] = mapped_column(Integer, nullable=True)
    used_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    # Validity Period
    valid_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    valid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Optimistic Locking
    version: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")

    # Relationships
    event: Mapped["Event"] = relationship("Event", back_populates="promo_codes")
    coordinator: Mapped["User"] = relationship("User", foreign_keys=[created_by])
    applications: Mapped[list["PromoCodeApplication"]] = relationship(
        "PromoCodeApplication",
        back_populates="promo_code",
        cascade="all, delete-orphan",
    )

    # Constraints
    __table_args__ = (
        CheckConstraint("discount_value > 0", name="check_promo_discount_value_positive"),
        CheckConstraint(
            "(discount_type = 'percentage' AND discount_value <= 100) OR discount_type = 'fixed_amount'",
            name="check_percentage_max_100",
        ),
        CheckConstraint(
            "max_uses IS NULL OR max_uses >= used_count", name="check_max_uses_vs_used"
        ),
        CheckConstraint("used_count >= 0", name="check_used_count_positive"),
        UniqueConstraint("event_id", "code", name="uq_promo_code_event_code"),
    )

    def __repr__(self) -> str:
        return f"<PromoCode(id={self.id}, code={self.code}, discount={self.discount_value})>"


class PromoCodeApplication(Base, UUIDMixin):
    """Record of a promo code being applied to a ticket purchase.

    Business Rules:
    - One promo code per purchase
    - discount_amount is the actual $ amount deducted (calculated at purchase time)
    """

    __tablename__ = "promo_code_applications"

    # Foreign Keys
    promo_code_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("promo_codes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ticket_purchase_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ticket_purchases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Discount Details
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    # Timestamps
    applied_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    # Relationships
    promo_code: Mapped["PromoCode"] = relationship("PromoCode", back_populates="applications")
    ticket_purchase: Mapped["TicketPurchase"] = relationship(
        "TicketPurchase", back_populates="promo_application"
    )

    # Constraints
    __table_args__ = (
        CheckConstraint("discount_amount >= 0", name="check_discount_amount_positive"),
    )

    def __repr__(self) -> str:
        return f"<PromoCodeApplication(id={self.id}, discount={self.discount_amount})>"


class TicketPurchase(Base, UUIDMixin):
    """Record of a donor purchasing ticket packages.

    Business Rules:
    - quantity > 0
    - total_price >= 0 (after promo code discount)
    - payment_status tracks transaction state
    """

    __tablename__ = "ticket_purchases"

    # Foreign Keys
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ticket_package_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ticket_packages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    # Purchase Details
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    total_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    payment_status: Mapped[PaymentStatus] = mapped_column(
        SQLEnum(PaymentStatus, name="payment_status_enum", native_enum=False),
        nullable=False,
    )

    # Timestamps
    purchased_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    # Relationships
    event: Mapped["Event"] = relationship("Event", back_populates="ticket_purchases")
    ticket_package: Mapped["TicketPackage"] = relationship(
        "TicketPackage", back_populates="purchases"
    )
    user: Mapped["User"] = relationship("User")
    option_responses: Mapped[list["OptionResponse"]] = relationship(
        "OptionResponse",
        back_populates="ticket_purchase",
        cascade="all, delete-orphan",
    )
    promo_application: Mapped["PromoCodeApplication | None"] = relationship(
        "PromoCodeApplication",
        back_populates="ticket_purchase",
        uselist=False,
    )
    assigned_tickets: Mapped[list["AssignedTicket"]] = relationship(
        "AssignedTicket",
        back_populates="ticket_purchase",
        cascade="all, delete-orphan",
    )

    # Constraints
    __table_args__ = (
        CheckConstraint("quantity > 0", name="check_purchase_quantity_positive"),
        CheckConstraint("total_price >= 0", name="check_total_price_positive"),
    )

    def __repr__(self) -> str:
        return f"<TicketPurchase(id={self.id}, quantity={self.quantity}, total={self.total_price})>"


class AssignedTicket(Base, UUIDMixin):
    """Individual ticket assigned from a purchase with QR code.

    Business Rules:
    - ticket_number is sequential within purchase (1, 2, 3, ...)
    - qr_code is globally unique (generated at purchase time)
    """

    __tablename__ = "assigned_tickets"

    # Foreign Keys
    ticket_purchase_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ticket_purchases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Ticket Details
    ticket_number: Mapped[int] = mapped_column(Integer, nullable=False)
    qr_code: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)

    # Timestamps
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    # Relationships
    ticket_purchase: Mapped["TicketPurchase"] = relationship(
        "TicketPurchase", back_populates="assigned_tickets"
    )

    def __repr__(self) -> str:
        return f"<AssignedTicket(id={self.id}, number={self.ticket_number}, qr={self.qr_code})>"


class TicketAuditLog(Base, UUIDMixin):
    """Immutable audit trail for ticket package changes.

    Business Rules:
    - Tracks all CREATE, UPDATE operations on ticket packages, promo codes, custom options
    - Cannot be modified or deleted (enforced by database trigger)
    - field_name is the changed column, old_value/new_value are JSON strings
    """

    __tablename__ = "ticket_audit_logs"

    # Entity Identification
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)

    # Coordinator Who Made Change
    coordinator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    # Change Details
    field_name: Mapped[str] = mapped_column(String(100), nullable=False)
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Timestamps
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )

    # Relationships
    coordinator: Mapped["User"] = relationship("User")

    def __repr__(self) -> str:
        return f"<TicketAuditLog(id={self.id}, entity={self.entity_type}, field={self.field_name})>"
