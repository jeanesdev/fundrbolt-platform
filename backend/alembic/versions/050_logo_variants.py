"""Add event and NPO logo icon usage tags.

Revision ID: 050_logo_variants
Revises: 049_paddle_defaults
Create Date: 2026-04-30
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "050_logo_variants"
down_revision: str | Sequence[str] | None = "049_paddle_defaults"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE event_media_usage_tag ADD VALUE IF NOT EXISTS 'npo_logo_icon'")
    op.execute("ALTER TYPE event_media_usage_tag ADD VALUE IF NOT EXISTS 'event_logo_icon'")


def downgrade() -> None:
    op.execute(
        """
        UPDATE event_media
        SET usage_tag = 'npo_logo'
        WHERE usage_tag = 'npo_logo_icon'
        """
    )
    op.execute(
        """
        UPDATE event_media
        SET usage_tag = 'event_logo'
        WHERE usage_tag = 'event_logo_icon'
        """
    )
    op.execute("ALTER TYPE event_media_usage_tag RENAME TO event_media_usage_tag_old")
    op.execute(
        """
        CREATE TYPE event_media_usage_tag AS ENUM (
            'main_event_page_hero',
            'event_layout_map',
            'npo_logo',
            'event_logo'
        )
        """
    )
    op.execute(
        """
        ALTER TABLE event_media
        ALTER COLUMN usage_tag TYPE event_media_usage_tag
        USING usage_tag::text::event_media_usage_tag
        """
    )
    op.execute("DROP TYPE event_media_usage_tag_old")
