"""Add is_monthly column to quick_entry_paddle_raise_donations

Revision ID: 040_add_is_monthly_paddle
Revises: 039_add_donor_labels
Create Date: 2026-04-03
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "040_add_is_monthly_paddle"
down_revision = "039_add_donor_labels"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "quick_entry_paddle_raise_donations",
        sa.Column(
            "is_monthly",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("quick_entry_paddle_raise_donations", "is_monthly")
