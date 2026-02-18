"""
Add cancellation_reason and cancellation_note to event_registrations
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = None  # Set this to the latest revision id in your project
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "event_registrations", sa.Column("cancellation_reason", sa.String(length=50), nullable=True)
    )
    op.add_column(
        "event_registrations", sa.Column("cancellation_note", sa.String(length=255), nullable=True)
    )


def downgrade():
    op.drop_column("event_registrations", "cancellation_note")
    op.drop_column("event_registrations", "cancellation_reason")
