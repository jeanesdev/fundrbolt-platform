"""add event_end_datetime to events

Revision ID: e4f5a6b7c8d9
Revises: d3e4f5a6b7c8
Create Date: 2026-03-10 10:00:00.000000

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "e4f5a6b7c8d9"
down_revision = "d3e4f5a6b7c8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "events",
        sa.Column(
            "event_end_datetime",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
            comment="When the event ends (optional). Shown on countdown after event start.",
        ),
    )


def downgrade() -> None:
    op.drop_column("events", "event_end_datetime")
