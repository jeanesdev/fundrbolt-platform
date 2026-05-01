"""Add last year total to events.

Revision ID: 051_last_year_total
Revises: 050_logo_variants
Create Date: 2026-04-30
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "051_last_year_total"
down_revision: str | Sequence[str] | None = "050_logo_variants"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("events", sa.Column("last_year_total", sa.Numeric(12, 2), nullable=True))


def downgrade() -> None:
    op.drop_column("events", "last_year_total")
