"""Shared branding theme templates for event page setup."""

from __future__ import annotations

import uuid

from sqlalchemy import CheckConstraint, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin


class BrandingThemeTemplate(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "branding_theme_templates"

    name: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)

    primary_color: Mapped[str] = mapped_column(String(7), nullable=False)
    secondary_color: Mapped[str] = mapped_column(String(7), nullable=False)
    background_color: Mapped[str] = mapped_column(String(7), nullable=False)
    accent_color: Mapped[str] = mapped_column(String(7), nullable=False)

    page_background_style: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default="solid"
    )
    page_background_gradient_start_color: Mapped[str] = mapped_column(String(7), nullable=False)
    page_background_gradient_end_color: Mapped[str] = mapped_column(String(7), nullable=False)

    action_card_background_style: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default="gradient"
    )
    action_card_gradient_start_color: Mapped[str] = mapped_column(String(7), nullable=False)
    action_card_gradient_end_color: Mapped[str] = mapped_column(String(7), nullable=False)
    action_card_background_opacity: Mapped[float] = mapped_column(
        nullable=False, server_default="1"
    )

    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )

    __table_args__ = (
        CheckConstraint(
            "page_background_style IN ('solid','gradient','image')",
            name="ck_branding_theme_page_background_style",
        ),
        CheckConstraint(
            "action_card_background_style IN ('solid','gradient')",
            name="ck_branding_theme_action_card_background_style",
        ),
        CheckConstraint(
            "action_card_background_opacity >= 0 AND action_card_background_opacity <= 1",
            name="ck_branding_theme_card_opacity_range",
        ),
        CheckConstraint(
            "primary_color ~* '^#[0-9A-Fa-f]{6}$'",
            name="ck_branding_theme_primary_color_hex",
        ),
        CheckConstraint(
            "secondary_color ~* '^#[0-9A-Fa-f]{6}$'",
            name="ck_branding_theme_secondary_color_hex",
        ),
        CheckConstraint(
            "background_color ~* '^#[0-9A-Fa-f]{6}$'",
            name="ck_branding_theme_background_color_hex",
        ),
        CheckConstraint(
            "accent_color ~* '^#[0-9A-Fa-f]{6}$'",
            name="ck_branding_theme_accent_color_hex",
        ),
        CheckConstraint(
            "page_background_gradient_start_color ~* '^#[0-9A-Fa-f]{6}$'",
            name="ck_branding_theme_page_gradient_start_hex",
        ),
        CheckConstraint(
            "page_background_gradient_end_color ~* '^#[0-9A-Fa-f]{6}$'",
            name="ck_branding_theme_page_gradient_end_hex",
        ),
        CheckConstraint(
            "action_card_gradient_start_color ~* '^#[0-9A-Fa-f]{6}$'",
            name="ck_branding_theme_card_gradient_start_hex",
        ),
        CheckConstraint(
            "action_card_gradient_end_color ~* '^#[0-9A-Fa-f]{6}$'",
            name="ck_branding_theme_card_gradient_end_hex",
        ),
    )
