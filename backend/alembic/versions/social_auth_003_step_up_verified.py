"""Add step_up_verified_at to social_identity_links

Revision ID: social_auth_003
Revises: fix_admin_001
Create Date: 2026-05-24

Tracks when an admin user successfully completed the one-time step-up
password verification for a given social identity link. Subsequent logins
with the same social identity skip the step-up prompt.
"""

import sqlalchemy as sa

from alembic import op

revision: str = "social_auth_003"
down_revision: str = "fix_admin_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "social_identity_links",
        sa.Column("step_up_verified_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("social_identity_links", "step_up_verified_at")
