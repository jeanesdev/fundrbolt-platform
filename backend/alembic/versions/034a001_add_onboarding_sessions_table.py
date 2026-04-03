"""add_onboarding_sessions_table

Revision ID: 034a001_add_onboarding_sessions
Revises: badge_color_002
Create Date: 2026-03-10 00:00:00.000000

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "034a001_add_onboarding_sessions"
down_revision = "badge_color_002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enum type for session type
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE onboardingsessiontype AS ENUM ('user_signup', 'npo_onboarding');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)

    # Create onboarding_sessions table
    op.create_table(
        "onboarding_sessions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("token", sa.Text(), nullable=False, unique=True),
        sa.Column(
            "session_type",
            postgresql.ENUM(
                "user_signup",
                "npo_onboarding",
                name="onboardingsessiontype",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column(
            "current_step",
            sa.String(50),
            nullable=False,
            server_default="account",
        ),
        sa.Column(
            "completed_steps",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "form_data",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # Create indexes
    op.create_index(
        "ix_onboarding_sessions_token",
        "onboarding_sessions",
        ["token"],
        unique=True,
    )
    op.create_index(
        "ix_onboarding_sessions_user_id",
        "onboarding_sessions",
        ["user_id"],
    )
    op.create_index(
        "ix_onboarding_sessions_expires_at",
        "onboarding_sessions",
        ["expires_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_onboarding_sessions_expires_at", table_name="onboarding_sessions")
    op.drop_index("ix_onboarding_sessions_user_id", table_name="onboarding_sessions")
    op.drop_index("ix_onboarding_sessions_token", table_name="onboarding_sessions")
    op.drop_table("onboarding_sessions")
    op.execute("DROP TYPE IF EXISTS onboardingsessiontype")
