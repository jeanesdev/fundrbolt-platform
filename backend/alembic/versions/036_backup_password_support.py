"""Add has_local_password support for backup passwords.

Revision ID: 036_backup_password_support
Revises: 035a001_notifications, 036_comms_email_verified, 036_tp_001
Create Date: 2026-03-18 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "036_backup_password_support"
down_revision: str | Sequence[str] | None = (
    "035a001_notifications",
    "036_comms_email_verified",
    "036_tp_001",
)
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "has_local_password",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "has_local_password")
