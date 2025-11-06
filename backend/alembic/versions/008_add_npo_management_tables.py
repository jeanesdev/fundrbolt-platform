"""add npo management tables

Revision ID: 008
Revises: 007
Create Date: 2025-10-31

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "008"
down_revision: str | None = "007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create NPO management tables for multi-tenant organization management."""

    # 1. Create NPO status enum (using CREATE TYPE IF NOT EXISTS)
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE npo_status AS ENUM (
                'draft',
                'pending_approval',
                'approved',
                'suspended',
                'rejected'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
        """
    )

    # 2. Create npos table
    op.create_table(
        "npos",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("name", sa.String(255), nullable=False, unique=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("mission_statement", sa.Text, nullable=True),
        sa.Column("tax_id", sa.String(50), nullable=True),
        sa.Column("website_url", sa.String(500), nullable=True),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("address", postgresql.JSON, nullable=True),
        sa.Column("registration_number", sa.String(100), nullable=True),
        sa.Column(
            "status",
            postgresql.ENUM(
                "draft",
                "pending_approval",
                "approved",
                "suspended",
                "rejected",
                name="npo_status",
                create_type=False,
            ),
            nullable=False,
            server_default="draft",
        ),
        sa.Column(
            "created_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )

    # 3. Create indexes for npos table
    op.create_index("ix_npos_name", "npos", ["name"])
    op.create_index("ix_npos_email", "npos", ["email"])
    op.create_index("ix_npos_status", "npos", ["status"])
    op.create_index("ix_npos_created_by_user_id", "npos", ["created_by_user_id"])

    # 4. Create application status enum
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE application_status AS ENUM (
                'submitted',
                'under_review',
                'approved',
                'rejected'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
        """
    )

    # 5. Create npo_applications table
    op.create_table(
        "npo_applications",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "npo_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("npos.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "status",
            postgresql.ENUM(
                "submitted",
                "under_review",
                "approved",
                "rejected",
                name="application_status",
                create_type=False,
            ),
            nullable=False,
            server_default="submitted",
        ),
        sa.Column("review_notes", postgresql.JSON, nullable=True),
        sa.Column(
            "reviewed_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )

    # 6. Create indexes for npo_applications table
    op.create_index("ix_npo_applications_npo_id", "npo_applications", ["npo_id"])
    op.create_index("ix_npo_applications_status", "npo_applications", ["status"])
    op.create_index("ix_npo_applications_submitted_at", "npo_applications", ["submitted_at"])

    # 7. Create member role and status enums
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE member_role AS ENUM (
                'admin',
                'co_admin',
                'staff'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
        """
    )

    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE member_status AS ENUM (
                'active',
                'invited',
                'suspended',
                'removed'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
        """
    )

    # 8. Create npo_members table
    op.create_table(
        "npo_members",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "npo_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("npos.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "role",
            postgresql.ENUM("admin", "co_admin", "staff", name="member_role", create_type=False),
            nullable=False,
        ),
        sa.Column(
            "status",
            postgresql.ENUM(
                "active", "invited", "suspended", "removed", name="member_status", create_type=False
            ),
            nullable=False,
            server_default="invited",
        ),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "invited_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )

    # 9. Create indexes and constraints for npo_members table
    op.create_index("ix_npo_members_npo_id", "npo_members", ["npo_id"])
    op.create_index("ix_npo_members_user_id", "npo_members", ["user_id"])
    op.create_index("ix_npo_members_role", "npo_members", ["role"])
    op.create_index("ix_npo_members_status", "npo_members", ["status"])
    op.create_unique_constraint("uq_npo_member", "npo_members", ["npo_id", "user_id"])

    # 10. Create npo_branding table
    op.create_table(
        "npo_branding",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "npo_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("npos.id", ondelete="CASCADE"),
            unique=True,
            nullable=False,
        ),
        sa.Column("primary_color", sa.String(7), nullable=True),
        sa.Column("secondary_color", sa.String(7), nullable=True),
        sa.Column("logo_url", sa.String(500), nullable=True),
        sa.Column("social_media_links", postgresql.JSON, nullable=True),
        sa.Column("custom_css_properties", postgresql.JSON, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )

    # 11. Create index for npo_branding table
    op.create_index("ix_npo_branding_npo_id", "npo_branding", ["npo_id"])

    # 12. Create invitation status enum
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE invitation_status AS ENUM (
                'pending',
                'accepted',
                'expired',
                'revoked'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
        """
    )

    # 13. Create invitations table
    op.create_table(
        "invitations",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "npo_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("npos.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "invited_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "invited_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("role", sa.String(50), nullable=False),
        sa.Column(
            "status",
            postgresql.ENUM(
                "pending",
                "accepted",
                "expired",
                "revoked",
                name="invitation_status",
                create_type=False,
            ),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("token_hash", sa.String(255), unique=True, nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )

    # 14. Create indexes for invitations table
    op.create_index("ix_invitations_npo_id", "invitations", ["npo_id"])
    op.create_index("ix_invitations_email", "invitations", ["email"])
    op.create_index("ix_invitations_status", "invitations", ["status"])
    op.create_index("ix_invitations_token_hash", "invitations", ["token_hash"])
    op.create_index("ix_invitations_expires_at", "invitations", ["expires_at"])

    # 15. Create composite indexes for common queries
    op.create_index("ix_npo_members_npo_status", "npo_members", ["npo_id", "status"])
    op.create_index("ix_npo_members_user_status", "npo_members", ["user_id", "status"])
    op.create_index("ix_invitations_npo_status", "invitations", ["npo_id", "status"])
    op.create_index("ix_invitations_email_status", "invitations", ["email", "status"])


def downgrade() -> None:
    """Drop NPO management tables."""

    # Drop tables in reverse order
    op.drop_table("invitations")
    op.drop_table("npo_branding")
    op.drop_table("npo_members")
    op.drop_table("npo_applications")
    op.drop_table("npos")

    # Drop enums
    op.execute("DROP TYPE IF EXISTS invitation_status")
    op.execute("DROP TYPE IF EXISTS member_status")
    op.execute("DROP TYPE IF EXISTS member_role")
    op.execute("DROP TYPE IF EXISTS application_status")
    op.execute("DROP TYPE IF EXISTS npo_status")
