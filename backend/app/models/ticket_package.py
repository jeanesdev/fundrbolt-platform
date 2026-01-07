"""TicketPackage model for ticket management."""

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
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin

if TYPE_CHECKING:
    from app.models.event import Event
    from app.models.ticket_management import (
        CustomTicketOption,
        TicketPurchase,
    )
    from app.models.user import User


class TicketPackage(Base, UUIDMixin):
    """Ticket package for events with pricing and capacity management.

    Business Rules:
    - price must be >= 0
    - seats_per_package must be between 1 and 100
    - quantity_limit (if set) must be >= sold_count
    - display_order is unique per event (for drag-and-drop ordering)
    - version column enables optimistic locking for concurrent edits
    - image_url is optional (nullable)
    - is_enabled controls visibility to donors

    Relationships:
    - Belongs to one Event
    - Created by one User (coordinator)
    - Has many CustomTicketOptions
    - Has many TicketPurchases
    """

    __tablename__ = "ticket_packages"

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

    # Package Details
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    seats_per_package: Mapped[int] = mapped_column(Integer, nullable=False)

    # Capacity Management
    quantity_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sold_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    # Display and Status
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")

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
    event: Mapped["Event"] = relationship("Event", back_populates="ticket_packages")
    coordinator: Mapped["User"] = relationship("User", foreign_keys=[created_by])
    custom_options: Mapped[list["CustomTicketOption"]] = relationship(
        "CustomTicketOption",
        back_populates="ticket_package",
        cascade="all, delete-orphan",
    )
    purchases: Mapped[list["TicketPurchase"]] = relationship(
        "TicketPurchase",
        back_populates="ticket_package",
        cascade="all, delete-orphan",
    )

    # Constraints
    __table_args__ = (
        CheckConstraint("price >= 0", name="check_ticket_package_price_positive"),
        CheckConstraint(
            "seats_per_package >= 1 AND seats_per_package <= 100",
            name="check_seats_per_package_range",
        ),
        CheckConstraint(
            "quantity_limit IS NULL OR quantity_limit >= sold_count",
            name="check_quantity_limit_vs_sold",
        ),
        CheckConstraint("sold_count >= 0", name="check_sold_count_positive"),
        UniqueConstraint("event_id", "display_order", name="uq_ticket_package_event_display_order"),
    )

    def __repr__(self) -> str:
        return f"<TicketPackage(id={self.id}, name={self.name}, price={self.price})>"
