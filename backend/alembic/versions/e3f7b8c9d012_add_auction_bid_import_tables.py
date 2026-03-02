"""Add auction bid import tables.

Revision ID: e3f7b8c9d012
Revises: d4e5f6a7b8c9
Create Date: 2026-02-14 14:30:00.000000

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "e3f7b8c9d012"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE auction_bid_import_status_enum AS ENUM (
                'preflighted', 'imported', 'failed', 'canceled'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
        """
    )
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE auction_bid_import_format_enum AS ENUM ('json', 'csv', 'xlsx');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
        """
    )
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE auction_bid_import_issue_severity_enum AS ENUM ('error', 'warning');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
        """
    )

    op.create_table(
        "auction_bid_import_batches",
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
                name="auction_bid_import_status_enum",
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
                name="auction_bid_import_format_enum",
                native_enum=False,
            ),
            nullable=False,
        ),
        sa.Column("row_count", sa.Integer(), nullable=False),
        sa.Column("valid_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("warning_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("skipped_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("preflight_checksum", sa.String(length=64), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.CheckConstraint("row_count > 0", name="check_auction_bid_import_row_count_positive"),
        sa.CheckConstraint(
            "row_count <= 10000",
            name="check_auction_bid_import_row_count_max",
        ),
        sa.CheckConstraint(
            "valid_count >= 0", name="check_auction_bid_import_valid_count_positive"
        ),
        sa.CheckConstraint(
            "error_count >= 0", name="check_auction_bid_import_error_count_positive"
        ),
        sa.CheckConstraint(
            "warning_count >= 0", name="check_auction_bid_import_warning_count_positive"
        ),
        sa.CheckConstraint(
            "created_count >= 0", name="check_auction_bid_import_created_count_positive"
        ),
        sa.CheckConstraint(
            "skipped_count >= 0", name="check_auction_bid_import_skipped_count_positive"
        ),
        sa.CheckConstraint(
            "failed_count >= 0", name="check_auction_bid_import_failed_count_positive"
        ),
    )

    op.create_index(
        "ix_auction_bid_import_batches_event_id",
        "auction_bid_import_batches",
        ["event_id"],
    )

    op.create_table(
        "auction_bid_import_issues",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("batch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("row_number", sa.Integer(), nullable=False),
        sa.Column("field_name", sa.String(length=100), nullable=True),
        sa.Column(
            "severity",
            sa.Enum(
                "error",
                "warning",
                name="auction_bid_import_issue_severity_enum",
                native_enum=False,
            ),
            nullable=False,
        ),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("raw_value", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["batch_id"],
            ["auction_bid_import_batches.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "row_number > 0", name="check_auction_bid_import_issue_row_number_positive"
        ),
    )

    op.create_index(
        "ix_auction_bid_import_issues_batch_id",
        "auction_bid_import_issues",
        ["batch_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_auction_bid_import_issues_batch_id")
    op.drop_table("auction_bid_import_issues")

    op.drop_index("ix_auction_bid_import_batches_event_id")
    op.drop_table("auction_bid_import_batches")

    op.execute("DROP TYPE IF EXISTS auction_bid_import_issue_severity_enum CASCADE")
    op.execute("DROP TYPE IF EXISTS auction_bid_import_format_enum CASCADE")
    op.execute("DROP TYPE IF EXISTS auction_bid_import_status_enum CASCADE")
