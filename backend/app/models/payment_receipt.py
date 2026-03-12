"""PaymentReceipt model — PDF receipt metadata and email delivery tracking."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.models.base import Base, UUIDMixin

if TYPE_CHECKING:
    from app.models.payment_transaction import PaymentTransaction


class PaymentReceipt(Base, UUIDMixin):
    """PDF receipt metadata and email delivery tracking.

    Linked 1:1 to a PaymentTransaction. The actual PDF lives in Azure Blob
    Storage; this table tracks the URL and delivery status.

    No TimestampMixin — receipts are immutable after creation.
    `created_at` is append-only and set by the DB server default.
    """

    __tablename__ = "payment_receipts"
    __table_args__ = (
        # Partial index to efficiently find receipts pending email delivery
        Index(
            "ix_payment_receipts_email_retry",
            "email_sent_at",
            "email_attempts",
            postgresql_where="email_sent_at IS NULL",
        ),
    )

    # 1:1 link to the transaction — UNIQUE enforces the 1:1 relationship
    transaction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("payment_transactions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # PDF location in Azure Blob Storage
    pdf_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    pdf_generated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Email delivery tracking
    email_address: Mapped[str] = mapped_column(String(255), nullable=False)
    email_sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="NULL = not yet sent",
    )
    email_attempts: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )

    # Append-only created_at — not using TimestampMixin (no updated_at)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    # Relationships
    transaction: Mapped["PaymentTransaction"] = relationship(
        "PaymentTransaction",
        back_populates="receipt",
    )
