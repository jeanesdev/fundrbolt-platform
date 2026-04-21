"""NpoDonation model for NPO-level (donate-now page) donation records."""

import enum
import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin

if TYPE_CHECKING:
    from app.models.donate_now_config import DonateNowPageConfig
    from app.models.event import Event
    from app.models.npo import NPO
    from app.models.payment_profile import PaymentProfile
    from app.models.payment_transaction import PaymentTransaction
    from app.models.support_wall_entry import SupportWallEntry
    from app.models.user import User


class NpoDonationStatus(str, enum.Enum):
    """NPO donation lifecycle state."""

    PENDING = "pending"
    CAPTURED = "captured"
    DECLINED = "declined"
    CANCELLED = "cancelled"


class RecurrenceStatus(str, enum.Enum):
    """Recurring donation schedule state."""

    ACTIVE = "active"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class NpoDonation(Base, UUIDMixin):
    """Donation record for the NPO donate-now page."""

    __tablename__ = "npo_donations"
    __table_args__ = (
        CheckConstraint("amount_cents > 0", name="ck_npo_donations_amount_positive"),
        CheckConstraint(
            "recurrence_status IN ('active', 'cancelled', 'completed')",
            name="ck_npo_donations_recurrence_status",
        ),
        CheckConstraint(
            "status IN ('pending', 'captured', 'declined', 'cancelled')",
            name="ck_npo_donations_status",
        ),
    )

    config_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("donate_now_page_configs.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    npo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("npos.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    donor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    amount_cents: Mapped[int] = mapped_column(Integer(), nullable=False)
    covers_processing_fee: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=False)
    processing_fee_cents: Mapped[int] = mapped_column(Integer(), nullable=False, default=0)
    total_charged_cents: Mapped[int] = mapped_column(Integer(), nullable=False)
    is_monthly: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=False)
    recurrence_start: Mapped[date | None] = mapped_column(Date(), nullable=True)
    recurrence_end: Mapped[date | None] = mapped_column(Date(), nullable=True)
    recurrence_status: Mapped[RecurrenceStatus | None] = mapped_column(
        Enum(
            RecurrenceStatus,
            name="recurrence_status_enum",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=True,
    )
    next_charge_date: Mapped[date | None] = mapped_column(Date(), nullable=True, index=True)
    payment_profile_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("payment_profiles.id", ondelete="SET NULL"),
        nullable=True,
    )
    payment_transaction_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("payment_transactions.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[NpoDonationStatus] = mapped_column(
        Enum(
            NpoDonationStatus,
            name="npo_donation_status_enum",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        default=NpoDonationStatus.PENDING,
    )
    idempotency_key: Mapped[str | None] = mapped_column(String(100), nullable=True, unique=True)
    event_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    config: Mapped["DonateNowPageConfig"] = relationship(
        "DonateNowPageConfig", back_populates="donations"
    )
    npo: Mapped["NPO"] = relationship("NPO", foreign_keys=[npo_id])
    donor: Mapped["User | None"] = relationship("User", foreign_keys=[donor_user_id])
    event: Mapped["Event | None"] = relationship("Event", foreign_keys=[event_id])
    payment_profile: Mapped["PaymentProfile | None"] = relationship(
        "PaymentProfile", foreign_keys=[payment_profile_id]
    )
    payment_transaction: Mapped["PaymentTransaction | None"] = relationship(
        "PaymentTransaction", foreign_keys=[payment_transaction_id]
    )
    support_wall_entry: Mapped["SupportWallEntry | None"] = relationship(
        "SupportWallEntry", back_populates="donation", uselist=False
    )

    def __repr__(self) -> str:
        """Return string representation."""
        return (
            f"<NpoDonation(id={self.id}, npo_id={self.npo_id}, "
            f"amount_cents={self.amount_cents}, status={self.status.value})>"
        )
