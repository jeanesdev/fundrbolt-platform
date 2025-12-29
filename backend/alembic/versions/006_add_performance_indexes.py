"""Add performance indexes for query optimization

Revision ID: 006_add_performance_indexes
Revises: 005_create_audit_logs_table
Create Date: 2025-10-25

Performance indexes based on data-model.md for common query patterns:
- User lookups by role, NPO, verification status
- Session lookups by user and expiry
- Audit log queries by user, action type, timestamp
"""

from sqlalchemy import text

from alembic import op

# revision identifiers, used by Alembic.
revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add performance indexes for frequently queried columns."""

    # Drop any pre-existing indexes to make the migration idempotent when rerun
    op.execute("DROP INDEX IF EXISTS idx_users_npo_id")
    op.execute("DROP INDEX IF EXISTS idx_users_role_npo")
    op.execute("DROP INDEX IF EXISTS idx_sessions_expires_at")
    op.execute("DROP INDEX IF EXISTS idx_sessions_user_expires")
    op.execute("DROP INDEX IF EXISTS idx_audit_logs_user_created")
    op.execute("DROP INDEX IF EXISTS idx_audit_logs_action_created")

    # Users table - only create missing indexes
    # idx_users_email, idx_users_role_id, idx_users_created_at,
    # idx_users_email_verified already exist
    op.create_index(
        "idx_users_npo_id",
        "users",
        ["npo_id"],
        unique=False,
        postgresql_where=text("npo_id IS NOT NULL"),
    )
    op.create_index(
        "idx_users_role_npo",
        "users",
        ["role_id", "npo_id"],
        unique=False,
    )

    # Sessions table - only create missing indexes
    # idx_sessions_user_id, idx_sessions_created_at already exist
    op.create_index(
        "idx_sessions_expires_at",
        "sessions",
        ["expires_at"],
        unique=False,
    )
    op.create_index(
        "idx_sessions_user_expires",
        "sessions",
        ["user_id", "expires_at"],
        unique=False,
    )

    # Audit logs - only create missing composite indexes
    # idx_audit_logs_user_id, idx_audit_logs_action, idx_audit_logs_created_at already exist
    op.create_index(
        "idx_audit_logs_user_created",
        "audit_logs",
        ["user_id", text("created_at DESC")],
        unique=False,
    )
    op.create_index(
        "idx_audit_logs_action_created",
        "audit_logs",
        ["action", text("created_at DESC")],
        unique=False,
    )


def downgrade() -> None:
    """Remove performance indexes."""

    # Audit logs
    op.drop_index("idx_audit_logs_action_created", table_name="audit_logs")
    op.drop_index("idx_audit_logs_user_created", table_name="audit_logs")

    # Sessions
    op.drop_index("idx_sessions_user_expires", table_name="sessions")
    op.drop_index("idx_sessions_expires_at", table_name="sessions")

    # Users
    op.drop_index("idx_users_role_npo", table_name="users")
    op.drop_index("idx_users_npo_id", table_name="users")
