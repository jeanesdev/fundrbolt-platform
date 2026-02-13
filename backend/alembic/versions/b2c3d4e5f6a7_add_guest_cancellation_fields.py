"""
Add guest status and cancellation fields
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "b2c3d4e5f6a7"
down_revision = "3dc100800430"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "registration_guests",
        sa.Column("status", sa.String(length=20), nullable=False, server_default="confirmed"),
    )
    op.add_column(
        "registration_guests",
        sa.Column("cancellation_reason", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "registration_guests",
        sa.Column("cancellation_note", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("registration_guests", "cancellation_note")
    op.drop_column("registration_guests", "cancellation_reason")
    op.drop_column("registration_guests", "status")
