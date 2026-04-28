"""Add donate_now_media table for hero slideshow images/videos.

Revision ID: 045_add_donate_now_media
Revises: 044_add_event_id_to_npo_donations
Create Date: 2026-04-21

"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "045_add_donate_now_media"
down_revision = "044_npo_donations_event_id"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "donate_now_media",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "config_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("donate_now_page_configs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("media_type", sa.String(20), nullable=False),
        sa.Column("file_url", sa.String(500), nullable=False),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("file_type", sa.String(100), nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=False),
        sa.Column("blob_name", sa.String(500), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "uploaded_by",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "media_type IN ('image', 'video')",
            name="check_donate_now_media_type",
        ),
        sa.CheckConstraint(
            "file_size <= 10485760",
            name="check_donate_now_media_file_size_max_10mb",
        ),
    )
    op.create_index("ix_donate_now_media_config_id", "donate_now_media", ["config_id"])


def downgrade() -> None:
    op.drop_index("ix_donate_now_media_config_id", table_name="donate_now_media")
    op.drop_table("donate_now_media")
