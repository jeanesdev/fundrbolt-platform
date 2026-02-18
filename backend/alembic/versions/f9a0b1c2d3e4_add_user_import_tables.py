"""add_user_import_tables

Revision ID: f9a0b1c2d3e4
Revises: e3f7b8c9d012
Create Date: 2026-02-17 00:00:00.000000

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "f9a0b1c2d3e4"
down_revision = "e3f7b8c9d012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE user_import_status AS ENUM ('preflight', 'committed', 'failed');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
        """
    )
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE user_import_issue_severity AS ENUM ('error', 'warning');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
        """
    )

    op.create_table(
        "user_import_batches",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "npo_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("npos.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "initiated_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("file_checksum", sa.String(length=64), nullable=False),
        sa.Column("file_type", sa.String(length=20), nullable=False),
        sa.Column(
            "status",
            postgresql.ENUM(
                "preflight",
                "committed",
                "failed",
                name="user_import_status",
                create_type=False,
            ),
            nullable=False,
            server_default="preflight",
        ),
        sa.Column("total_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("valid_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("warning_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("skipped_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "membership_added_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column("failed_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    op.create_index("ix_user_import_batches_npo_id", "user_import_batches", ["npo_id"])
    op.create_index(
        "ix_user_import_batches_initiated_by_user_id",
        "user_import_batches",
        ["initiated_by_user_id"],
    )

    op.create_table(
        "user_import_issues",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "batch_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("user_import_batches.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("row_number", sa.Integer(), nullable=False),
        sa.Column(
            "severity",
            postgresql.ENUM(
                "error",
                "warning",
                name="user_import_issue_severity",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("field_name", sa.String(length=100), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("raw_value", sa.Text(), nullable=True),
    )

    op.create_index("ix_user_import_issues_batch_id", "user_import_issues", ["batch_id"])


def downgrade() -> None:
    op.drop_index("ix_user_import_issues_batch_id", table_name="user_import_issues")
    op.drop_table("user_import_issues")

    op.drop_index("ix_user_import_batches_initiated_by_user_id", table_name="user_import_batches")
    op.drop_index("ix_user_import_batches_npo_id", table_name="user_import_batches")
    op.drop_table("user_import_batches")

    op.execute("DROP TYPE IF EXISTS user_import_issue_severity CASCADE")
    op.execute("DROP TYPE IF EXISTS user_import_status CASCADE")
