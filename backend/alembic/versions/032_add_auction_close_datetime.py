"""add auction_close_datetime to events

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6, 030a0b1c2d3e
Create Date: 2026-03-06 12:00:00.000000

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "c2d3e4f5a6b7"
down_revision = ("b1c2d3e4f5a6", "030a0b1c2d3e")
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "events",
        sa.Column(
            "auction_close_datetime",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
            comment="When the silent auction closes (optional)",
        ),
    )


def downgrade() -> None:
    op.drop_column("events", "auction_close_datetime")
