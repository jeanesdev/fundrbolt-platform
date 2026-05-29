"""Add paddle raise level notes to auctioneer settings.

Revision ID: 053_paddle_raise_level_notes
Revises: 0e231ed1bd15
Create Date: 2026-05-28
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision: str = "053_paddle_raise_level_notes"
down_revision: str | Sequence[str] | None = "0e231ed1bd15"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "auctioneer_event_settings",
        sa.Column(
            "paddle_raise_level_notes",
            JSONB,
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column("auctioneer_event_settings", "paddle_raise_level_notes")
