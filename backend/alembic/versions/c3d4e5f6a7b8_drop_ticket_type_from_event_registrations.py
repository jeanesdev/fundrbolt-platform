"""
Drop ticket_type from event_registrations
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "c3d4e5f6a7b8"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("event_registrations", "ticket_type")


def downgrade() -> None:
    op.add_column(
        "event_registrations",
        sa.Column("ticket_type", sa.String(length=100), nullable=True),
    )
