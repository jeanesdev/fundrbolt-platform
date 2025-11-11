"""Event models for fundraising events and related entities."""

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.npo import NPO


class EventStatus(str, enum.Enum):
    """Event publication status."""

    DRAFT = "draft"  # Visible only to event staff
    ACTIVE = "active"  # Publicly visible, accepting registrations
    CLOSED = "closed"  # Publicly viewable but no new registrations


class EventMediaStatus(str, enum.Enum):
    """Media file virus scan status."""

    UPLOADED = "uploaded"  # Uploaded, awaiting scan
    SCANNED = "scanned"  # Scanned, clean
    QUARANTINED = "quarantined"  # Virus detected


class EventLinkType(str, enum.Enum):
    """External link type."""

    VIDEO = "video"  # YouTube, Vimeo embeds
    WEBSITE = "website"  # External website
    SOCIAL_MEDIA = "social_media"  # Facebook, Twitter, Instagram


class Event(Base, UUIDMixin, TimestampMixin):
    """Event model representing a fundraising gala or auction.

    Business Rules:
    - NPO must be approved (status=APPROVED) before events can be created
    - Event datetime must be in the future at creation time
    - URL slug must be globally unique
    - Draft events invisible to donors, active events publicly visible
    - Closed events viewable but no new registrations
    - Auto-close 24 hours after event_datetime if still active

    State Transitions:
    - DRAFT → ACTIVE (manual publish by Event Coordinator/NPO Admin)
    - ACTIVE → DRAFT (manual unpublish, only if no registrations)
    - ACTIVE → CLOSED (manual close OR auto-close 24h after event_datetime)
    - CLOSED → ACTIVE (not allowed)
    """

    __tablename__ = "events"

    # Identity
    npo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("npos.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )
    custom_slug: Mapped[str | None] = mapped_column(String(255), nullable=True)
    tagline: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
        comment="Short tagline for event (max 200 characters)",
    )

    # Status
    status: Mapped[EventStatus] = mapped_column(
        Enum(EventStatus, name="event_status", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=EventStatus.DRAFT,
        server_default=EventStatus.DRAFT.value,
        index=True,
    )

    # Date and Time
    event_datetime: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    timezone: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="IANA timezone name (e.g., America/Chicago)",
    )

    # Venue
    venue_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    venue_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    venue_city: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="City where event is held",
    )
    venue_state: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="State/Province where event is held",
    )
    venue_zip: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        comment="ZIP/Postal code where event is held",
    )

    # Content
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Rich text description (Markdown format)",
    )

    # Branding
    logo_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="Event-specific logo (Azure Blob URL)",
    )
    primary_color: Mapped[str | None] = mapped_column(
        String(7),
        nullable=True,
        comment="Hex color code (e.g., #FF5733)",
    )
    secondary_color: Mapped[str | None] = mapped_column(
        String(7),
        nullable=True,
        comment="Hex color code (e.g., #33C4FF)",
    )
    background_color: Mapped[str | None] = mapped_column(
        String(7),
        nullable=True,
        comment="Hex color code for background (e.g., #FFFFFF)",
    )
    accent_color: Mapped[str | None] = mapped_column(
        String(7),
        nullable=True,
        comment="Hex color code for accents (e.g., #FF5733)",
    )

    # Optimistic Locking
    version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
        comment="Version counter for optimistic locking",
    )

    # Creator tracking
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    updated_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    # Relationships
    npo: Mapped["NPO"] = relationship("NPO", back_populates="events")
    media: Mapped[list["EventMedia"]] = relationship(
        "EventMedia",
        back_populates="event",
        cascade="all, delete-orphan",
        order_by="EventMedia.display_order",
    )
    links: Mapped[list["EventLink"]] = relationship(
        "EventLink",
        back_populates="event",
        cascade="all, delete-orphan",
        order_by="EventLink.display_order",
    )
    food_options: Mapped[list["FoodOption"]] = relationship(
        "FoodOption",
        back_populates="event",
        cascade="all, delete-orphan",
        order_by="FoodOption.display_order",
    )

    # Constraints
    __table_args__ = (
        CheckConstraint(
            "status IN ('draft', 'active', 'closed')",
            name="check_event_status",
        ),
        CheckConstraint(
            "primary_color IS NULL OR primary_color ~ '^#[0-9A-Fa-f]{6}$'",
            name="check_primary_color_format",
        ),
        CheckConstraint(
            "secondary_color IS NULL OR secondary_color ~ '^#[0-9A-Fa-f]{6}$'",
            name="check_secondary_color_format",
        ),
    )

    # Enable optimistic locking
    __mapper_args__ = {"version_id_col": version}


class EventMedia(Base, UUIDMixin, TimestampMixin):
    """Event media files (images, flyers, promotional materials).

    Business Rules:
    - Maximum 10MB per file
    - Maximum 50MB total per event (enforced in service layer)
    - Allowed types: image/png, image/jpeg, image/svg+xml, application/pdf
    - All files virus-scanned before serving
    - Files stored in Azure Blob Storage with private access
    """

    __tablename__ = "event_media"

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    file_url: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="Azure Blob Storage URL",
    )
    file_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Original filename",
    )
    file_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="MIME type (e.g., image/png)",
    )
    file_size: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="File size in bytes",
    )
    display_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Order for gallery display",
    )
    status: Mapped[EventMediaStatus] = mapped_column(
        Enum(
            EventMediaStatus,
            name="event_media_status",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        default=EventMediaStatus.UPLOADED,
        server_default=EventMediaStatus.UPLOADED.value,
    )
    uploaded_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    # Relationships
    event: Mapped["Event"] = relationship("Event", back_populates="media")

    # Constraints
    __table_args__ = (
        CheckConstraint(
            "status IN ('uploaded', 'scanned', 'quarantined')",
            name="check_media_status",
        ),
        CheckConstraint(
            "file_size <= 10485760",
            name="check_file_size_max_10mb",
        ),
    )


class EventLink(Base, UUIDMixin, TimestampMixin):
    """External links associated with events (videos, websites, social media).

    Business Rules:
    - URL must be valid HTTP/HTTPS format
    - Video links must be YouTube or Vimeo
    - All URLs validated and sanitized to prevent XSS/SSRF
    """

    __tablename__ = "event_links"

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    link_type: Mapped[EventLinkType] = mapped_column(
        Enum(
            EventLinkType,
            name="event_link_type",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
    )
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    label: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        comment="Display label (e.g., 'Event Promo Video')",
    )
    platform: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="Platform name (YouTube, Vimeo, Facebook, etc.)",
    )
    display_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    # Relationships
    event: Mapped["Event"] = relationship("Event", back_populates="links")

    # Constraints
    __table_args__ = (
        CheckConstraint(
            "link_type IN ('video', 'website', 'social_media')",
            name="check_link_type",
        ),
    )


class FoodOption(Base, UUIDMixin, TimestampMixin):
    """Selectable meal/menu choices for events.

    Business Rules:
    - Maximum 20 options per event (enforced in service layer)
    - Option names must be unique within an event
    - Donors select preference during registration (separate feature)
    """

    __tablename__ = "food_options"

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Option name (e.g., 'Chicken', 'Vegetarian')",
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Optional detailed description",
    )
    display_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    # Relationships
    event: Mapped["Event"] = relationship("Event", back_populates="food_options")

    # Constraints
    __table_args__ = (
        CheckConstraint(
            "name IS NOT NULL AND trim(name) != ''",
            name="check_food_option_name_not_empty",
        ),
    )
