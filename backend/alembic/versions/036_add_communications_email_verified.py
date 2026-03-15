"""Add communications_email_verified column to users table.

Revision ID: 036_add_communications_email_verified
Revises: 035_add_communications_email
Create Date: 2026-03-15 00:00:00.000000

Adds a boolean flag indicating whether the communications_email address
has been OTP-verified.  Unverified addresses are not used for mail delivery.
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "036_add_communications_email_verified"
down_revision = "035_add_communications_email"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "communications_email_verified",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "communications_email_verified")
