"""PaymentProfile model — tokenized saved card references per donor per NPO."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, SmallInteger, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.npo import NPO
    from app.models.payment_transaction import PaymentTransaction
    from app.models.user import User


class PaymentProfile(Base, UUIDMixin, TimestampMixin):
    """Tokenized saved card ("vault token") held by Deluxe.

    Stores only display metadata (last4, brand, expiry) and the opaque
    gateway_profile_id. Scoped per donor per NPO — one NPO's vault is
    distinct from another's (FR-005).

    Soft-deleted via `deleted_at`; queries filter WHERE deleted_at IS NULL.
    """

    __tablename__ = "payment_profiles"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "npo_id",
            "gateway_profile_id",
            name="uq_payment_profiles_user_npo_gateway",
        ),
    )

    # Foreign keys
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    npo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("npos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Gateway vault token
    gateway_profile_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )

    # Masked card display fields
    card_last4: Mapped[str] = mapped_column(String(4), nullable=False)
    card_brand: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="Visa | Mastercard | Amex | Discover",
    )
    card_expiry_month: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    card_expiry_year: Mapped[int] = mapped_column(SmallInteger, nullable=False)

    # Optional billing info
    billing_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    billing_zip: Mapped[str | None] = mapped_column(String(10), nullable=True)

    # Default flag — at most one per (user_id, npo_id); enforced at service layer
    is_default: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )

    # Soft delete — service calls gateway vault DELETE before setting this
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="payment_profiles")
    npo: Mapped["NPO"] = relationship("NPO", back_populates="payment_profiles")
    transactions: Mapped[list["PaymentTransaction"]] = relationship(
        "PaymentTransaction",
        back_populates="payment_profile",
        foreign_keys="PaymentTransaction.payment_profile_id",
    )
