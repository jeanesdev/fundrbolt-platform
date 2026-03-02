"""create_ticket_audit_logs_table

Revision ID: 5f531d2c8eb9
Revises: cd94a1f5be66
Create Date: 2026-01-06 22:19:26.001492

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "5f531d2c8eb9"
down_revision = "cd94a1f5be66"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create ticket_audit_logs table for ticket management changes
    op.create_table(
        "ticket_audit_logs",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "coordinator_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("field_name", sa.String(100), nullable=False),
        sa.Column("old_value", sa.Text(), nullable=True),
        sa.Column("new_value", sa.Text(), nullable=True),
        sa.Column(
            "changed_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # Create indexes
    op.create_index(
        "idx_ticket_audit_logs_entity", "ticket_audit_logs", ["entity_type", "entity_id"]
    )
    op.create_index("idx_ticket_audit_logs_coordinator_id", "ticket_audit_logs", ["coordinator_id"])
    op.create_index("idx_ticket_audit_logs_changed_at", "ticket_audit_logs", ["changed_at"])

    # Create trigger to prevent modifications to ticket_audit_logs
    op.execute("""
        CREATE OR REPLACE FUNCTION prevent_ticket_audit_log_modification()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION 'Ticket audit log records are immutable and cannot be modified or deleted';
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        CREATE TRIGGER prevent_ticket_audit_log_update
        BEFORE UPDATE OR DELETE ON ticket_audit_logs
        FOR EACH ROW
        EXECUTE FUNCTION prevent_ticket_audit_log_modification();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS prevent_ticket_audit_log_update ON ticket_audit_logs")
    op.execute("DROP FUNCTION IF EXISTS prevent_ticket_audit_log_modification()")
    op.drop_index("idx_ticket_audit_logs_changed_at", table_name="ticket_audit_logs")
    op.drop_index("idx_ticket_audit_logs_coordinator_id", table_name="ticket_audit_logs")
    op.drop_index("idx_ticket_audit_logs_entity", table_name="ticket_audit_logs")
    op.drop_table("ticket_audit_logs")
