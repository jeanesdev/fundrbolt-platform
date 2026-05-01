"""Update paddle raise default levels.

Revision ID: 049_paddle_defaults
Revises: 048_auctioneer_slide_fields
Create Date: 2026-04-30
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "049_paddle_defaults"
down_revision = "048_auctioneer_slide_fields"
branch_labels = None
depends_on = None

OLD_DEFAULT_LEVELS = "'[10000, 5000, 2500, 1000, 500, 250, 100, 50]'::jsonb"
NEW_DEFAULT_LEVELS = "'[10000, 5000, 2500, 1000, 500, 250, 100]'::jsonb"


def upgrade() -> None:
    op.alter_column(
        "auctioneer_event_settings",
        "paddle_raise_levels",
        existing_type=sa.dialects.postgresql.JSONB(astext_type=sa.Text()),
        server_default=sa.text(NEW_DEFAULT_LEVELS),
        existing_nullable=False,
    )
    op.execute(
        f"""
        UPDATE auctioneer_event_settings
        SET paddle_raise_levels = {NEW_DEFAULT_LEVELS}
        WHERE paddle_raise_levels = {OLD_DEFAULT_LEVELS}
        """
    )


def downgrade() -> None:
    op.alter_column(
        "auctioneer_event_settings",
        "paddle_raise_levels",
        existing_type=sa.dialects.postgresql.JSONB(astext_type=sa.Text()),
        server_default=sa.text(OLD_DEFAULT_LEVELS),
        existing_nullable=False,
    )
    op.execute(
        f"""
        UPDATE auctioneer_event_settings
        SET paddle_raise_levels = {OLD_DEFAULT_LEVELS}
        WHERE paddle_raise_levels = {NEW_DEFAULT_LEVELS}
        """
    )
