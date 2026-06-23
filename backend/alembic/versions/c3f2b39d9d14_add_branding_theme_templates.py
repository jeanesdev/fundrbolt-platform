"""add branding theme templates

Revision ID: c3f2b39d9d14
Revises: b91f2e7c4d5a
Create Date: 2026-06-20 12:15:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c3f2b39d9d14"
down_revision: str | None = "b91f2e7c4d5a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "branding_theme_templates",
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("primary_color", sa.String(length=7), nullable=False),
        sa.Column("secondary_color", sa.String(length=7), nullable=False),
        sa.Column("background_color", sa.String(length=7), nullable=False),
        sa.Column("accent_color", sa.String(length=7), nullable=False),
        sa.Column(
            "page_background_style",
            sa.String(length=16),
            server_default="solid",
            nullable=False,
        ),
        sa.Column("page_background_gradient_start_color", sa.String(length=7), nullable=False),
        sa.Column("page_background_gradient_end_color", sa.String(length=7), nullable=False),
        sa.Column(
            "action_card_background_style",
            sa.String(length=16),
            server_default="gradient",
            nullable=False,
        ),
        sa.Column("action_card_gradient_start_color", sa.String(length=7), nullable=False),
        sa.Column("action_card_gradient_end_color", sa.String(length=7), nullable=False),
        sa.Column(
            "action_card_background_opacity",
            sa.Float(),
            server_default="1",
            nullable=False,
        ),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
        sa.CheckConstraint(
            "page_background_style IN ('solid','gradient','image')",
            name="ck_branding_theme_page_background_style",
        ),
        sa.CheckConstraint(
            "action_card_background_style IN ('solid','gradient')",
            name="ck_branding_theme_action_card_background_style",
        ),
        sa.CheckConstraint(
            "action_card_background_opacity >= 0 AND action_card_background_opacity <= 1",
            name="ck_branding_theme_card_opacity_range",
        ),
        sa.CheckConstraint(
            "primary_color ~* '^#[0-9A-Fa-f]{6}$'",
            name="ck_branding_theme_primary_color_hex",
        ),
        sa.CheckConstraint(
            "secondary_color ~* '^#[0-9A-Fa-f]{6}$'",
            name="ck_branding_theme_secondary_color_hex",
        ),
        sa.CheckConstraint(
            "background_color ~* '^#[0-9A-Fa-f]{6}$'",
            name="ck_branding_theme_background_color_hex",
        ),
        sa.CheckConstraint(
            "accent_color ~* '^#[0-9A-Fa-f]{6}$'",
            name="ck_branding_theme_accent_color_hex",
        ),
        sa.CheckConstraint(
            "page_background_gradient_start_color ~* '^#[0-9A-Fa-f]{6}$'",
            name="ck_branding_theme_page_gradient_start_hex",
        ),
        sa.CheckConstraint(
            "page_background_gradient_end_color ~* '^#[0-9A-Fa-f]{6}$'",
            name="ck_branding_theme_page_gradient_end_hex",
        ),
        sa.CheckConstraint(
            "action_card_gradient_start_color ~* '^#[0-9A-Fa-f]{6}$'",
            name="ck_branding_theme_card_gradient_start_hex",
        ),
        sa.CheckConstraint(
            "action_card_gradient_end_color ~* '^#[0-9A-Fa-f]{6}$'",
            name="ck_branding_theme_card_gradient_end_hex",
        ),
    )

    op.execute(
        sa.text(
            """
            INSERT INTO branding_theme_templates (
                id, name, primary_color, secondary_color, background_color, accent_color,
                page_background_style, page_background_gradient_start_color, page_background_gradient_end_color,
                action_card_background_style, action_card_gradient_start_color, action_card_gradient_end_color,
                action_card_background_opacity
            ) VALUES
                ('f6bde53d-c7a6-4f7a-9e95-4d63eb4dd001', 'Classic Gala Navy & Gold', '#1F2A44', '#C9A227', '#F7F4EA', '#D4AF37', 'gradient', '#F7F4EA', '#E9DFC7', 'gradient', '#1F2A44', '#2D3E63', 0.95),
                ('f6bde53d-c7a6-4f7a-9e95-4d63eb4dd002', 'Evergreen Charity', '#1F5C49', '#8BBF9F', '#F1F8F3', '#2E8B57', 'gradient', '#F1F8F3', '#DDEFE4', 'gradient', '#1F5C49', '#2B7A62', 0.92),
                ('f6bde53d-c7a6-4f7a-9e95-4d63eb4dd003', 'Sunrise Citrus', '#D9480F', '#F59F00', '#FFF7ED', '#E85D04', 'gradient', '#FFF7ED', '#FFEFD5', 'gradient', '#D9480F', '#F76707', 0.92),
                ('f6bde53d-c7a6-4f7a-9e95-4d63eb4dd004', 'Ocean Breeze', '#0B4F6C', '#01A7C2', '#F0FBFF', '#0284C7', 'gradient', '#F0FBFF', '#DDF4FA', 'gradient', '#0B4F6C', '#11698E', 0.92),
                ('f6bde53d-c7a6-4f7a-9e95-4d63eb4dd005', 'Lavender Evening', '#4B3F72', '#7E6BA8', '#F5F2FB', '#9D4EDD', 'gradient', '#F5F2FB', '#E9E0F7', 'gradient', '#4B3F72', '#6A4C93', 0.92),
                ('f6bde53d-c7a6-4f7a-9e95-4d63eb4dd006', 'Rosewood Charity', '#7A1E48', '#B23A62', '#FFF1F6', '#C9184A', 'gradient', '#FFF1F6', '#FFE4EC', 'gradient', '#7A1E48', '#A3345D', 0.92),
                ('f6bde53d-c7a6-4f7a-9e95-4d63eb4dd007', 'Midnight Neon', '#0B132B', '#1C2541', '#EAF2FF', '#00B4D8', 'gradient', '#EAF2FF', '#D8E7FF', 'gradient', '#0B132B', '#1C2541', 0.94),
                ('f6bde53d-c7a6-4f7a-9e95-4d63eb4dd008', 'Desert Sandstone', '#8C4A32', '#C97B63', '#FFF8F2', '#D97706', 'gradient', '#FFF8F2', '#FCE8D8', 'gradient', '#8C4A32', '#B35C40', 0.90),
                ('f6bde53d-c7a6-4f7a-9e95-4d63eb4dd009', 'Forest Night', '#1B4332', '#2D6A4F', '#EDF6F0', '#52B788', 'gradient', '#EDF6F0', '#DCEEE3', 'gradient', '#1B4332', '#2D6A4F', 0.93),
                ('f6bde53d-c7a6-4f7a-9e95-4d63eb4dd010', 'Platinum Slate', '#2F3E46', '#52796F', '#F6FAF9', '#84A98C', 'gradient', '#F6FAF9', '#E5EFEC', 'gradient', '#2F3E46', '#3F5A64', 0.93),
                ('f6bde53d-c7a6-4f7a-9e95-4d63eb4dd011', 'Ruby Night', '#5B0E2D', '#8E2043', '#FFF2F6', '#C1121F', 'gradient', '#FFF2F6', '#FFE5EC', 'gradient', '#5B0E2D', '#8E2043', 0.94),
                ('f6bde53d-c7a6-4f7a-9e95-4d63eb4dd012', 'Skyline Cobalt', '#1D4E89', '#3A86FF', '#EEF5FF', '#2563EB', 'gradient', '#EEF5FF', '#DDEBFF', 'gradient', '#1D4E89', '#2563EB', 0.93)
            ON CONFLICT (name) DO NOTHING
            """
        )
    )


def downgrade() -> None:
    op.drop_table("branding_theme_templates")
