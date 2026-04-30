"""Add review state to support wall entries.

Revision ID: 047_sw_review_state
Revises: 046_add_donate_now_branding
Create Date: 2026-04-30
"""

import sqlalchemy as sa

from alembic import op

revision = "047_sw_review_state"
down_revision = "046_add_donate_now_branding"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "support_wall_entries",
        sa.Column(
            "is_reviewed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("support_wall_entries", "is_reviewed")
