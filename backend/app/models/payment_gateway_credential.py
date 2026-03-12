"""PaymentGatewayCredential model — per-NPO Deluxe merchant credentials."""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.npo import NPO


class PaymentGatewayCredential(Base, UUIDMixin, TimestampMixin):
    """Stores per-NPO Deluxe merchant account credentials.

    Sensitive fields (merchant_id, api_key, api_secret) are Fernet-encrypted
    before being written to the DB and are never returned in plaintext.
    """

    __tablename__ = "payment_gateway_credentials"
    __table_args__ = (
        CheckConstraint(
            "gateway_name IN ('deluxe', 'stub')",
            name="ck_payment_gateway_credentials_gateway_name",
        ),
    )

    # Foreign key — one credential record per NPO (UNIQUE)
    npo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("npos.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # Gateway identifier
    gateway_name: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="deluxe",
        server_default="deluxe",
    )

    # Encrypted credential fields (never return in plaintext)
    merchant_id_enc: Mapped[str] = mapped_column(nullable=False)
    api_key_enc: Mapped[str] = mapped_column(nullable=False)
    api_secret_enc: Mapped[str] = mapped_column(nullable=False)

    # Optional Deluxe terminal / gateway ID
    gateway_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Mode flags
    is_live_mode: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )

    # Relationships
    npo: Mapped["NPO"] = relationship("NPO", back_populates="payment_gateway_credential")
