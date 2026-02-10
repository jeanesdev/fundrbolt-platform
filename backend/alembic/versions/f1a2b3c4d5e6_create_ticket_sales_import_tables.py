"""Create ticket sales import tables

Revision ID: f1a2b3c4d5e6
Revises: sponsorship_001
Create Date: 2026-01-27 20:15:00.000000

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "f1a2b3c4d5e6"
down_revision = "sponsorship_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create import_status_enum
    op.execute(
        """
        CREATE TYPE import_status_enum AS ENUM (
            'preflighted', 'imported', 'failed', 'canceled'
        )
        """
    )

    # Create import_format_enum
    op.execute(
        """
        CREATE TYPE import_format_enum AS ENUM (
            'json', 'csv', 'xlsx'
        )
        """
    )

    # Create issue_severity_enum
    op.execute(
        """
        CREATE TYPE issue_severity_enum AS ENUM (
            'error', 'warning'
        )
        """
    )

    # Create ticket_sales_import_batches table
    op.create_table(
        "ticket_sales_import_batches",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "preflighted",
                "imported",
                "failed",
                "canceled",
                name="import_status_enum",
                native_enum=False,
            ),
            nullable=False,
        ),
        sa.Column("source_filename", sa.String(length=255), nullable=False),
        sa.Column(
            "source_format",
            sa.Enum(
                "json",
                "csv",
                "xlsx",
                name="import_format_enum",
                native_enum=False,
            ),
            nullable=False,
        ),
        sa.Column("row_count", sa.Integer(), nullable=False),
        sa.Column("valid_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("warning_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("preflight_checksum", sa.String(length=64), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
        ),
        sa.ForeignKeyConstraint(
            ["event_id"],
            ["events.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("row_count > 0", name="check_import_batch_row_count_positive"),
        sa.CheckConstraint("row_count <= 5000", name="check_import_batch_row_count_max"),
        sa.CheckConstraint("valid_count >= 0", name="check_valid_count_positive"),
        sa.CheckConstraint("error_count >= 0", name="check_error_count_positive"),
        sa.CheckConstraint("warning_count >= 0", name="check_warning_count_positive"),
    )

    # Create indexes
    op.create_index(
        "ix_ticket_sales_import_batches_event_id",
        "ticket_sales_import_batches",
        ["event_id"],
    )

    # Create ticket_sales_import_issues table
    op.create_table(
        "ticket_sales_import_issues",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("batch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("row_number", sa.Integer(), nullable=False),
        sa.Column("field_name", sa.String(length=100), nullable=True),
        sa.Column(
            "severity",
            sa.Enum(
                "error",
                "warning",
                name="issue_severity_enum",
                native_enum=False,
            ),
            nullable=False,
        ),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("raw_value", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["batch_id"],
            ["ticket_sales_import_batches.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("row_number > 0", name="check_issue_row_number_positive"),
    )

    # Create indexes
    op.create_index(
        "ix_ticket_sales_import_issues_batch_id",
        "ticket_sales_import_issues",
        ["batch_id"],
    )

    # Add external_sale_id to ticket_purchases table
    op.add_column(
        "ticket_purchases",
        sa.Column("external_sale_id", sa.String(length=200), nullable=True),
    )
    op.add_column(
        "ticket_purchases",
        sa.Column("purchaser_name", sa.String(length=200), nullable=True),
    )
    op.add_column(
        "ticket_purchases",
        sa.Column("purchaser_email", sa.String(length=200), nullable=True),
    )
    op.add_column(
        "ticket_purchases",
        sa.Column("purchaser_phone", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "ticket_purchases",
        sa.Column("notes", sa.Text(), nullable=True),
    )

    # Create unique constraint on external_sale_id per event
    op.create_index(
        "ix_ticket_purchases_external_sale_id_event",
        "ticket_purchases",
        ["event_id", "external_sale_id"],
        unique=True,
        postgresql_where=sa.text("external_sale_id IS NOT NULL"),
    )


def downgrade() -> None:
    # Drop index and columns from ticket_purchases
    op.drop_index(
        "ix_ticket_purchases_external_sale_id_event",
        table_name="ticket_purchases",
        postgresql_where=sa.text("external_sale_id IS NOT NULL"),
    )
    op.drop_column("ticket_purchases", "notes")
    op.drop_column("ticket_purchases", "purchaser_phone")
    op.drop_column("ticket_purchases", "purchaser_email")
    op.drop_column("ticket_purchases", "purchaser_name")
    op.drop_column("ticket_purchases", "external_sale_id")

    # Drop ticket_sales_import_issues table
    op.drop_index("ix_ticket_sales_import_issues_batch_id")
    op.drop_table("ticket_sales_import_issues")

    # Drop ticket_sales_import_batches table
    op.drop_index("ix_ticket_sales_import_batches_event_id")
    op.drop_table("ticket_sales_import_batches")

    # Drop enums
    op.execute("DROP TYPE IF EXISTS issue_severity_enum")
    op.execute("DROP TYPE IF EXISTS import_format_enum")
    op.execute("DROP TYPE IF EXISTS import_status_enum")
