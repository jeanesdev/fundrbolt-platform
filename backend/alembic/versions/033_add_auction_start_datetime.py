"""add auction_start_datetime to events

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-03-06 18:00:00.000000

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "d3e4f5a6b7c8"
down_revision = "c2d3e4f5a6b7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "events",
        sa.Column(
            "auction_start_datetime",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
            comment="When the silent auction opens for bidding (optional)",
        ),
    )


def downgrade() -> None:
    op.drop_column("events", "auction_start_datetime")
