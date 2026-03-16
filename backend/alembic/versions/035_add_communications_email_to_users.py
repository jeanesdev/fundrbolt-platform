"""Add communications_email column to users table.

Revision ID: 035_add_communications_email
Revises: 034a002_npo_reopened
Create Date: 2026-03-15 00:00:00.000000

Adds an optional second email address that is used for outbound communications
(event notifications, receipts, etc.).  The original `email` column remains the
sign-in / authentication email; `communications_email` overrides it for all
non-auth outbound mail when set.
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "035_add_communications_email"
down_revision = "034a002_npo_reopened"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "communications_email",
            sa.String(255),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_users_communications_email",
        "users",
        ["communications_email"],
    )


def downgrade() -> None:
    op.drop_index("ix_users_communications_email", table_name="users")
    op.drop_column("users", "communications_email")
