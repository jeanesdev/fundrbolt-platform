"""NPO Branding model for visual identity configuration."""

import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.npo import NPO


class NPOBranding(Base, UUIDMixin, TimestampMixin):
    """NPO Branding model for visual identity.

    Stores visual theming configuration for NPOs including colors,
    logo, social media links, and CSS properties.

    Business Rules:
    - One branding configuration per NPO (1:1 relationship)
    - Color codes must be valid hex format (#RRGGBB)
    - Logo URL must be from approved Azure Blob container
    - Social media URLs validated against platform-specific patterns
    - Accessibility contrast ratio checking for color combinations
    """

    __tablename__ = "npo_branding"

    # NPO relationship (unique - one branding per NPO)
    npo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("npos.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    # Colors (hex format: #RRGGBB)
    primary_color: Mapped[str | None] = mapped_column(
        String(7),
        nullable=True,
        comment="Primary brand color in hex format",
    )

    secondary_color: Mapped[str | None] = mapped_column(
        String(7),
        nullable=True,
        comment="Secondary brand color in hex format",
    )

    background_color: Mapped[str | None] = mapped_column(
        String(7),
        nullable=True,
        default="#FFFFFF",
        comment="Background color in hex format (default white)",
    )

    accent_color: Mapped[str | None] = mapped_column(
        String(7),
        nullable=True,
        comment="Accent/highlight color in hex format",
    )

    # Logo URL (Azure Blob Storage)
    logo_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="Azure Blob Storage URL for NPO logo",
    )

    # Social Media Links (JSON)
    # Schema: {facebook, twitter, instagram, linkedin, youtube, website, custom: [{name, url}]}
    social_media_links: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        nullable=True,
        comment="Social media platform URLs and handles",
    )

    # Custom CSS Properties (JSON)
    # Additional CSS custom properties for advanced theming
    custom_css_properties: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        nullable=True,
        comment="Additional CSS custom properties for theming",
    )

    # Relationships
    npo: Mapped["NPO"] = relationship(
        "NPO",
        back_populates="branding",
    )

    def __repr__(self) -> str:
        """Return string representation."""
        return f"<NPOBranding(id={self.id}, npo_id={self.npo_id})>"
