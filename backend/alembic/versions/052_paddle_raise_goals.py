"""Add paddle raise goals to auctioneer settings.

Revision ID: 052_paddle_goals
Revises: 051_last_year_total
Create Date: 2026-04-30
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision: str = "052_paddle_goals"
down_revision: str | Sequence[str] | None = "051_last_year_total"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "auctioneer_event_settings",
        sa.Column("paddle_raise_total_goal", sa.Numeric(12, 2), nullable=True),
    )
    op.add_column(
        "auctioneer_event_settings",
        sa.Column(
            "paddle_raise_level_goals",
            JSONB,
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column("auctioneer_event_settings", "paddle_raise_level_goals")
    op.drop_column("auctioneer_event_settings", "paddle_raise_total_goal")
