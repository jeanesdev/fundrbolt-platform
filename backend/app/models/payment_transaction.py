"""PaymentTransaction model — immutable audit record for every payment event."""

import enum
import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.event import Event
    from app.models.npo import NPO
    from app.models.payment_profile import PaymentProfile
    from app.models.payment_receipt import PaymentReceipt
    from app.models.user import User


class TransactionType(str, enum.Enum):
    """The type of transaction being performed."""

    CHARGE = "charge"
    AUTH_ONLY = "auth_only"
    CAPTURE = "capture"
    VOID = "void"
    REFUND = "refund"


class TransactionStatus(str, enum.Enum):
    """Current lifecycle status of a transaction."""

    PENDING = "pending"
    AUTHORIZED = "authorized"
    CAPTURED = "captured"
    VOIDED = "voided"
    REFUNDED = "refunded"
    DECLINED = "declined"
    ERROR = "error"


class PaymentTransaction(Base, UUIDMixin, TimestampMixin):
    """Immutable audit record for every payment event.

    Records charges, authorizations, voids, and refunds.
    `line_items` JSONB captures the full breakdown of what was charged.
    `parent_transaction_id` links refunds/voids back to the original charge.
    """

    __tablename__ = "payment_transactions"
    __table_args__ = (
        UniqueConstraint(
            "gateway_transaction_id",
            name="uq_payment_transactions_gateway_txn_id",
        ),
        UniqueConstraint(
            "idempotency_key",
            name="uq_payment_transactions_idempotency_key",
        ),
        CheckConstraint(
            "amount >= 0",
            name="ck_payment_transactions_amount_non_negative",
        ),
        Index(
            "ix_payment_transactions_user_event",
            "user_id",
            "event_id",
        ),
        Index(
            "ix_payment_transactions_event_status",
            "event_id",
            "status",
        ),
        Index(
            "ix_payment_transactions_npo_created",
            "npo_id",
            "created_at",
        ),
        # Partial index: pending transactions that need polling
        Index(
            "ix_payment_transactions_pending_session",
            "status",
            "session_created_at",
            postgresql_where="status = 'pending'",
        ),
    )

    # Foreign keys
    npo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("npos.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    event_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    payment_profile_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("payment_profiles.id", ondelete="SET NULL"),
        nullable=True,
    )
    # Admin actor who initiated (e.g., manual charge or forced void)
    initiated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    # Self-FK: links refunds/voids back to original charge
    parent_transaction_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("payment_transactions.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Gateway identifiers
    gateway_transaction_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        unique=True,
        comment="Deluxe transaction ID — null for pending/client-side sessions",
    )
    idempotency_key: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        unique=True,
        comment="Client-supplied idempotency key to prevent double-submit",
    )

    # Transaction classification
    transaction_type: Mapped[TransactionType] = mapped_column(
        Enum(
            TransactionType,
            name="transaction_type_enum",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
    )
    status: Mapped[TransactionStatus] = mapped_column(
        Enum(
            TransactionStatus,
            name="transaction_status_enum",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        default=TransactionStatus.PENDING,
        server_default=TransactionStatus.PENDING.value,
    )

    # Financials
    amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=12, scale=2),
        nullable=False,
    )
    currency: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        default="USD",
        server_default="USD",
    )

    # Structured breakdown of what was charged
    line_items: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    # Sanitised raw gateway response for debugging
    gateway_response: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    # Polling fallback — set when HPF session is created
    session_created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Admin-provided reason for manual charges, voids, and refunds
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    npo: Mapped["NPO"] = relationship("NPO", back_populates="payment_transactions")
    event: Mapped["Event | None"] = relationship("Event", back_populates="payment_transactions")
    user: Mapped["User"] = relationship(
        "User",
        back_populates="payment_transactions",
        foreign_keys=[user_id],
    )
    initiating_user: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[initiated_by],
    )
    payment_profile: Mapped["PaymentProfile | None"] = relationship(
        "PaymentProfile",
        back_populates="transactions",
        foreign_keys=[payment_profile_id],
    )
    parent_transaction: Mapped["PaymentTransaction | None"] = relationship(
        "PaymentTransaction",
        remote_side="PaymentTransaction.id",
        foreign_keys=[parent_transaction_id],
    )
    child_transactions: Mapped[list["PaymentTransaction"]] = relationship(
        "PaymentTransaction",
        back_populates="parent_transaction",
        foreign_keys=[parent_transaction_id],
    )
    receipt: Mapped["PaymentReceipt | None"] = relationship(
        "PaymentReceipt",
        back_populates="transaction",
        uselist=False,
    )
