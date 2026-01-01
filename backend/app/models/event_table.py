"""Event table models for managing table customization."""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.event import Event
    from app.models.registration_guest import RegistrationGuest


class EventTable(Base, UUIDMixin, TimestampMixin):
    """Table customization for events with seating arrangements.

    Business Rules:
    - Each table belongs to exactly one event (cascade delete when event deleted)
    - Table numbers are unique within an event (1, 2, 3, ...)
    - Custom capacity overrides event.max_guests_per_table (1-20 range)
    - Table names are optional friendly names (up to 50 characters)
    - Table captain is optional, must be a guest assigned to this table
    - Captain assignment is set to NULL when guest is deleted
    - Empty string names are converted to NULL (use "Table N" as display)
    """

    __tablename__ = "event_tables"

    # Foreign Keys
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Event this table belongs to",
    )
    table_captain_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("registration_guests.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Guest designated as table captain",
    )

    # Table Identification
    table_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Physical table identifier (1, 2, 3, ...)",
    )

    # Table Customization
    custom_capacity: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Override capacity for this table (1-20); NULL = use event default",
    )
    table_name: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="Optional friendly name (e.g., 'VIP Sponsors', 'Youth Group')",
    )

    # Relationships
    event: Mapped["Event"] = relationship(
        "Event",
        back_populates="tables",
    )
    captain: Mapped["RegistrationGuest | None"] = relationship(
        "RegistrationGuest",
        foreign_keys=[table_captain_id],
        back_populates="captained_table",
    )

    # Computed Properties
    @property
    def display_name(self) -> str:
        """Get display name for UI (table name or 'Table N')."""
        if self.table_name:
            return f"Table {self.table_number} - {self.table_name}"
        return f"Table {self.table_number}"

    @property
    def has_custom_capacity(self) -> bool:
        """Check if table has custom capacity override."""
        return self.custom_capacity is not None

    @property
    def has_captain(self) -> bool:
        """Check if table has a captain assigned."""
        return self.table_captain_id is not None

    # Table Configuration
    __table_args__ = (
        # Unique constraint: one row per (event, table_number)
        {"schema": None},
    )
