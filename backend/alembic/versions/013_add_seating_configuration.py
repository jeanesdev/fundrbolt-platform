"""Add seating configuration to events table

Revision ID: 013_add_seating_configuration
Revises: 41727abf4033
Create Date: 2025-12-11

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "f8e3a1b2c9d4"
down_revision = "41727abf4033"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add seating configuration columns to events table
    op.add_column("events", sa.Column("table_count", sa.Integer(), nullable=True))
    op.add_column("events", sa.Column("max_guests_per_table", sa.Integer(), nullable=True))

    # Add check constraints
    op.create_check_constraint(
        "ck_events_table_count_positive", "events", "table_count IS NULL OR table_count > 0"
    )
    op.create_check_constraint(
        "ck_events_max_guests_per_table_positive",
        "events",
        "max_guests_per_table IS NULL OR max_guests_per_table > 0",
    )


def downgrade() -> None:
    # Drop check constraints
    op.drop_constraint("ck_events_max_guests_per_table_positive", "events", type_="check")
    op.drop_constraint("ck_events_table_count_positive", "events", type_="check")

    # Drop columns
    op.drop_column("events", "max_guests_per_table")
    op.drop_column("events", "table_count")
