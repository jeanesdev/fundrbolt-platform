"""add explicit gradient color fields

Revision ID: b91f2e7c4d5a
Revises: 8c4e9d1a2b3c
Create Date: 2026-06-19 07:45:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b91f2e7c4d5a"
down_revision: str | Sequence[str] | None = "8c4e9d1a2b3c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "events",
        sa.Column("page_background_gradient_start_color", sa.String(length=7), nullable=True),
    )
    op.add_column(
        "events",
        sa.Column("page_background_gradient_end_color", sa.String(length=7), nullable=True),
    )
    op.add_column(
        "events",
        sa.Column("action_card_gradient_start_color", sa.String(length=7), nullable=True),
    )
    op.add_column(
        "events",
        sa.Column("action_card_gradient_end_color", sa.String(length=7), nullable=True),
    )

    op.create_check_constraint(
        "check_page_bg_gradient_start_color_format",
        "events",
        "page_background_gradient_start_color IS NULL OR page_background_gradient_start_color ~ '^#[0-9A-Fa-f]{6}$'",
    )
    op.create_check_constraint(
        "check_page_bg_gradient_end_color_format",
        "events",
        "page_background_gradient_end_color IS NULL OR page_background_gradient_end_color ~ '^#[0-9A-Fa-f]{6}$'",
    )
    op.create_check_constraint(
        "check_action_card_gradient_start_color_format",
        "events",
        "action_card_gradient_start_color IS NULL OR action_card_gradient_start_color ~ '^#[0-9A-Fa-f]{6}$'",
    )
    op.create_check_constraint(
        "check_action_card_gradient_end_color_format",
        "events",
        "action_card_gradient_end_color IS NULL OR action_card_gradient_end_color ~ '^#[0-9A-Fa-f]{6}$'",
    )


def downgrade() -> None:
    op.drop_constraint("check_action_card_gradient_end_color_format", "events", type_="check")
    op.drop_constraint("check_action_card_gradient_start_color_format", "events", type_="check")
    op.drop_constraint("check_page_bg_gradient_end_color_format", "events", type_="check")
    op.drop_constraint("check_page_bg_gradient_start_color_format", "events", type_="check")

    op.drop_column("events", "action_card_gradient_end_color")
    op.drop_column("events", "action_card_gradient_start_color")
    op.drop_column("events", "page_background_gradient_end_color")
    op.drop_column("events", "page_background_gradient_start_color")
