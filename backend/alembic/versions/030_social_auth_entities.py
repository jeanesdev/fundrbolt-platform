"""add social auth entities

Revision ID: 030a0b1c2d3e
Revises: 6a0f12b3c4d5
Create Date: 2026-03-04 00:00:00.000000

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "030a0b1c2d3e"
down_revision = "6a0f12b3c4d5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Social auth attempts
    op.create_table(
        "social_auth_attempts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("provider_key", sa.String(20), nullable=False, index=True),
        sa.Column("app_context", sa.String(20), nullable=False),
        sa.Column("state_token", sa.String(255), nullable=False, unique=True, index=True),
        sa.Column("pkce_verifier_hash", sa.String(255), nullable=True),
        sa.Column("redirect_uri", sa.String(1024), nullable=True),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("result", sa.String(30), nullable=False, server_default="started"),
        sa.Column("failure_code", sa.String(100), nullable=True),
        sa.Column("client_ip", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(512), nullable=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True, index=True),
    )

    # Social identity links
    op.create_table(
        "social_identity_links",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("provider_key", sa.String(20), nullable=False, index=True),
        sa.Column("provider_subject", sa.String(255), nullable=False),
        sa.Column("provider_email", sa.String(255), nullable=True),
        sa.Column("provider_email_verified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "linked_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("linked_via_attempt_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.UniqueConstraint("provider_key", "provider_subject", name="uq_provider_subject"),
    )

    # Social pending link confirmations
    op.create_table(
        "social_pending_link_confirmations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "attempt_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("social_auth_attempts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "candidate_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("provider_key", sa.String(20), nullable=False),
        sa.Column("provider_subject", sa.String(255), nullable=False),
        sa.Column("confirmation_token", sa.String(255), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Social email verification challenges
    op.create_table(
        "social_email_verification_challenges",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "attempt_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("social_auth_attempts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("verification_token", sa.String(255), nullable=False, unique=True),
        sa.Column("verification_status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column(
            "issued_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Social admin step-up challenges
    op.create_table(
        "social_admin_step_up_challenges",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "attempt_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("social_auth_attempts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("step_up_token", sa.String(255), nullable=False, unique=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column(
            "issued_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("social_admin_step_up_challenges")
    op.drop_table("social_email_verification_challenges")
    op.drop_table("social_pending_link_confirmations")
    op.drop_table("social_identity_links")
    op.drop_table("social_auth_attempts")
