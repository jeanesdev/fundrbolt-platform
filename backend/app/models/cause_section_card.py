"""Cause section card models."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class CardTypeEnum(str, enum.Enum):
    TEXT = "text"
    SLIDESHOW = "slideshow"
    VIDEO = "video"
    BUILT_IN = "built_in"


class MediaSourceEnum(str, enum.Enum):
    UPLOAD = "upload"
    EXTERNAL = "external"


class SlideVariantEnum(str, enum.Enum):
    IMAGE_ONLY = "image_only"
    TEXT_OVER_IMAGE = "text_over_image"
    TEXT_ONLY = "text_only"


class RevisionActionEnum(str, enum.Enum):
    DRAFT_SAVED = "draft_saved"
    PUBLISHED = "published"
    REVERTED = "reverted"


class EventCausePageConfig(Base, UUIDMixin, TimestampMixin):
    """Version tracking for an event's cause page."""

    __tablename__ = "event_cause_page_config"

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    draft_version: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    published_version: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    last_published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_published_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    __table_args__ = (
        UniqueConstraint("event_id", name="uq_event_cause_page_config_event_id"),
        CheckConstraint("draft_version >= 1", name="ck_event_cause_page_config_draft_version"),
        CheckConstraint(
            "published_version >= 0",
            name="ck_event_cause_page_config_published_version_nonnegative",
        ),
        CheckConstraint(
            "published_version <= draft_version",
            name="ck_event_cause_page_config_versions_ordered",
        ),
    )


class CauseSectionCard(Base, UUIDMixin, TimestampMixin):
    """Ordered content card in an event cause page draft."""

    __tablename__ = "cause_section_cards"

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    draft_version: Mapped[int] = mapped_column(Integer, nullable=False)
    card_type: Mapped[CardTypeEnum] = mapped_column(
        Enum(
            CardTypeEnum,
            name="cause_section_card_type_enum",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
    )
    built_in_section_key: Mapped[str | None] = mapped_column(String(64), nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    show_header: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    is_collapsible: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    background_color_token: Mapped[str | None] = mapped_column(String(64), nullable=True)
    border_color_token: Mapped[str | None] = mapped_column(String(64), nullable=True)
    content_html: Mapped[str | None] = mapped_column(Text, nullable=True)
    video_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    video_media_source: Mapped[MediaSourceEnum | None] = mapped_column(
        Enum(
            MediaSourceEnum,
            name="cause_section_card_media_source_enum",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=True,
    )
    video_autoplay: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    video_muted_by_default: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    slides: Mapped[list[CauseSectionSlideItem]] = relationship(
        "CauseSectionSlideItem",
        back_populates="card",
        cascade="all, delete-orphan",
        order_by="CauseSectionSlideItem.display_order",
        lazy="selectin",
    )

    __table_args__ = (
        UniqueConstraint(
            "event_id",
            "draft_version",
            "display_order",
            name="uq_cause_section_cards_event_version_order",
        ),
        CheckConstraint("draft_version >= 1", name="ck_cause_section_cards_draft_version"),
        CheckConstraint("display_order >= 0", name="ck_cause_section_cards_display_order"),
        CheckConstraint(
            "(card_type = 'built_in' AND built_in_section_key IS NOT NULL) "
            "OR (card_type <> 'built_in' AND built_in_section_key IS NULL)",
            name="ck_cause_section_cards_built_in_key_required",
        ),
        CheckConstraint(
            "built_in_section_key IS NULL "
            "OR built_in_section_key IN ('about', 'sponsors', 'event_details')",
            name="ck_cause_section_cards_built_in_key_valid",
        ),
        Index(
            "ix_cause_section_cards_event_version_order",
            "event_id",
            "draft_version",
            "display_order",
        ),
        Index(
            "ix_cause_section_cards_event_version_built_in_key",
            "event_id",
            "draft_version",
            "built_in_section_key",
            unique=True,
            postgresql_where="built_in_section_key IS NOT NULL",
        ),
    )


class CauseSectionSlideItem(Base, UUIDMixin, TimestampMixin):
    """Slide within a slideshow cause card."""

    __tablename__ = "cause_section_slide_items"

    card_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cause_section_cards.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    display_order: Mapped[int] = mapped_column(Integer, nullable=False)
    slide_variant: Mapped[SlideVariantEnum] = mapped_column(
        Enum(
            SlideVariantEnum,
            name="cause_section_slide_variant_enum",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
    )
    media_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    media_source: Mapped[MediaSourceEnum | None] = mapped_column(
        Enum(
            MediaSourceEnum,
            name="cause_section_slide_media_source_enum",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=True,
    )
    alt_text: Mapped[str | None] = mapped_column(String(500), nullable=True)
    overlay_html: Mapped[str | None] = mapped_column(Text, nullable=True)

    card: Mapped[CauseSectionCard] = relationship(
        "CauseSectionCard",
        back_populates="slides",
        lazy="select",
    )

    __table_args__ = (
        UniqueConstraint(
            "card_id", "display_order", name="uq_cause_section_slide_items_card_order"
        ),
        CheckConstraint("display_order >= 0", name="ck_cause_section_slide_items_display_order"),
        CheckConstraint(
            "(slide_variant = 'text_only') OR media_url IS NOT NULL",
            name="ck_cause_section_slide_items_media_required",
        ),
        CheckConstraint(
            "(slide_variant = 'text_only') OR media_source IS NOT NULL",
            name="ck_cause_section_slide_items_media_source_required",
        ),
        CheckConstraint(
            "(slide_variant = 'text_only') "
            "OR (alt_text IS NOT NULL AND length(trim(alt_text)) > 0)",
            name="ck_cause_section_slide_items_alt_text_required",
        ),
    )


class CauseSectionCardRevision(Base, UUIDMixin):
    """Audit log for cause page draft and publish actions."""

    __tablename__ = "cause_section_card_revisions"

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    changed_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    action: Mapped[RevisionActionEnum] = mapped_column(
        Enum(
            RevisionActionEnum,
            name="cause_section_card_revision_action_enum",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
    )
    draft_version: Mapped[int] = mapped_column(Integer, nullable=False)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    change_summary: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    __table_args__ = (
        CheckConstraint("draft_version >= 1", name="ck_cause_section_card_revisions_draft_version"),
        Index(
            "ix_cause_section_card_revisions_event_changed_at",
            "event_id",
            "changed_at",
        ),
    )
