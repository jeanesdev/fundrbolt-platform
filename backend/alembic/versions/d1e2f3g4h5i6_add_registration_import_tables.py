"""add_registration_import_tables

Revision ID: d1e2f3g4h5i6
Revises: c1f1c2d3e4f5
Create Date: 2026-02-07 17:45:00.000000

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "d1e2f3g4h5i6"
down_revision = "c1f1c2d3e4f5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enum types
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE import_batch_status AS ENUM ('preflight', 'completed', 'failed');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE validation_severity AS ENUM ('error', 'warning');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # Create registration_import_batches table
    op.create_table(
        "registration_import_batches",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "event_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("events.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "status",
            postgresql.ENUM(
                "preflight",
                "completed",
                "failed",
                name="import_batch_status",
                create_type=False,
            ),
            nullable=False,
            server_default="preflight",
        ),
        sa.Column("file_type", sa.String(20), nullable=False, comment="File type: json, csv, xlsx"),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("total_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("valid_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("warning_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("skipped_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            comment="Additional metadata (e.g., processing time)",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Create registration_validation_issues table
    op.create_table(
        "registration_validation_issues",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "batch_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("registration_import_batches.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "row_number",
            sa.Integer(),
            nullable=False,
            comment="1-indexed row number from the file",
        ),
        sa.Column(
            "severity",
            postgresql.ENUM("error", "warning", name="validation_severity", create_type=False),
            nullable=False,
        ),
        sa.Column(
            "field_name",
            sa.String(100),
            nullable=True,
            comment="Field that caused the issue (if applicable)",
        ),
        sa.Column("message", sa.Text(), nullable=False, comment="Human-readable error message"),
    )

    # Create indexes
    op.create_index(
        "idx_import_batches_event_created",
        "registration_import_batches",
        ["event_id", "created_at"],
    )
    op.create_index(
        "idx_validation_issues_batch_severity",
        "registration_validation_issues",
        ["batch_id", "severity"],
    )


def downgrade() -> None:
    # Drop indexes
    op.drop_index(
        "idx_validation_issues_batch_severity", table_name="registration_validation_issues"
    )
    op.drop_index("idx_import_batches_event_created", table_name="registration_import_batches")

    # Drop tables
    op.drop_table("registration_validation_issues")
    op.drop_table("registration_import_batches")

    # Drop enum types
    op.execute("DROP TYPE IF EXISTS validation_severity CASCADE")
    op.execute("DROP TYPE IF EXISTS import_batch_status CASCADE")
