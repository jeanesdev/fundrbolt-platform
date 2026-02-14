"""Ticket transfer record models for ownership change audit logging."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime as SADateTime
from sqlalchemy import ForeignKey, Index, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.event import Event
    from app.models.registration_guest import RegistrationGuest
    from app.models.user import User


class TicketTransferRecord(Base, UUIDMixin, TimestampMixin):
    """Audit log of ticket ownership changes.

    Business Rules:
    - All ticket transfers must be logged
    - Records are append-only (never updated or deleted)
    - Used for audit trail and compliance
    - No verification required for transfers per spec
    """

    __tablename__ = "ticket_transfer_records"

    # Foreign Keys
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    registration_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("registration_guests.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    from_donor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="Original donor (user_id)",
    )
    to_donor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="New donor (user_id)",
    )
    transferred_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="User who performed the transfer",
    )

    # Transfer Details
    transferred_at: Mapped[datetime] = mapped_column(
        SADateTime(timezone=True),
        nullable=False,
        index=True,
    )
    note: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Relationships
    event: Mapped["Event"] = relationship("Event")
    registration: Mapped["RegistrationGuest | None"] = relationship("RegistrationGuest")
    from_donor: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[from_donor_id],
    )
    to_donor: Mapped["User"] = relationship(
        "User",
        foreign_keys=[to_donor_id],
    )
    transferred_by: Mapped["User"] = relationship(
        "User",
        foreign_keys=[transferred_by_user_id],
    )

    # Table Configuration
    __table_args__ = (
        Index("idx_ticket_transfer_records_event", "event_id"),
        Index("idx_ticket_transfer_records_registration", "registration_id"),
        Index("idx_ticket_transfer_records_transferred_at", "transferred_at"),
    )
