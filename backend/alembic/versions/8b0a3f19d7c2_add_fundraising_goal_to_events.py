"""add fundraising goal to events

Revision ID: 8b0a3f19d7c2
Revises: 21c13f0e5b43
Create Date: 2026-02-25 00:00:00.000000

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "8b0a3f19d7c2"
down_revision = "21c13f0e5b43"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "events",
        sa.Column(
            "fundraising_goal",
            sa.Numeric(12, 2),
            nullable=True,
            comment="Optional fundraising goal for event dashboard totals",
        ),
    )


def downgrade() -> None:
    op.drop_column("events", "fundraising_goal")
