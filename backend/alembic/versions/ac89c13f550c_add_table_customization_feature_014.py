"""Add table customization (Feature 014)

Revision ID: ac89c13f550c
Revises: fc956ee403ec
Create Date: 2026-01-01 14:26:42.852951

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "ac89c13f550c"
down_revision = "fc956ee403ec"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create event_tables table (T001)
    op.create_table(
        "event_tables",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("table_number", sa.Integer(), nullable=False),
        sa.Column("custom_capacity", sa.Integer(), nullable=True),
        sa.Column("table_name", sa.String(length=50), nullable=True),
        sa.Column("table_captain_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["table_captain_id"], ["registration_guests.id"], ondelete="SET NULL"
        ),
        # Unique constraint (event_id, table_number) (T003)
        sa.UniqueConstraint("event_id", "table_number", name="uq_event_tables_event_table_number"),
        # Check constraints (T004)
        sa.CheckConstraint(
            "custom_capacity IS NULL OR (custom_capacity >= 1 AND custom_capacity <= 20)",
            name="ck_event_tables_capacity_range",
        ),
        sa.CheckConstraint(
            "table_name IS NULL OR LENGTH(TRIM(table_name)) > 0",
            name="ck_event_tables_name_not_empty",
        ),
    )

    # Create indexes (T005)
    op.create_index("idx_event_tables_event_id", "event_tables", ["event_id"])
    op.create_index("idx_event_tables_captain_id", "event_tables", ["table_captain_id"])
    op.create_index("idx_event_tables_composite", "event_tables", ["event_id", "table_number"])

    # Add is_table_captain field to registration_guests table (T002)
    op.add_column(
        "registration_guests",
        sa.Column("is_table_captain", sa.Boolean(), nullable=False, server_default="false"),
    )

    # Create index for table captain queries (T005)
    op.create_index(
        "idx_registration_guests_table_captain",
        "registration_guests",
        ["table_number", "is_table_captain"],
    )

    # Backfill data migration for existing events with table_count > 0 (T006)
    op.execute("""
        INSERT INTO event_tables (id, event_id, table_number, custom_capacity, table_name, table_captain_id, created_at, updated_at)
        SELECT
            gen_random_uuid() as id,
            e.id as event_id,
            gs.table_num as table_number,
            NULL as custom_capacity,
            NULL as table_name,
            NULL as table_captain_id,
            NOW() as created_at,
            NOW() as updated_at
        FROM events e
        CROSS JOIN generate_series(1, e.table_count) as gs(table_num)
        WHERE e.table_count > 0
        ON CONFLICT (event_id, table_number) DO NOTHING;
    """)


def downgrade() -> None:
    # Drop indexes
    op.drop_index("idx_registration_guests_table_captain", table_name="registration_guests")
    op.drop_index("idx_event_tables_composite", table_name="event_tables")
    op.drop_index("idx_event_tables_captain_id", table_name="event_tables")
    op.drop_index("idx_event_tables_event_id", table_name="event_tables")

    # Remove is_table_captain field from registration_guests
    op.drop_column("registration_guests", "is_table_captain")

    # Drop event_tables table
    op.drop_table("event_tables")
