"""add hero transition style to events

Revision ID: 6a0f12b3c4d5
Revises: 4f6a8b9c1d2e
Create Date: 2026-03-02 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "6a0f12b3c4d5"
down_revision: str | None = "4f6a8b9c1d2e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "events",
        sa.Column(
            "hero_transition_style",
            sa.String(length=32),
            nullable=False,
            server_default="documentary_style",
        ),
    )


def downgrade() -> None:
    op.drop_column("events", "hero_transition_style")
