"""add_event_tables

Revision ID: afd211422425
Revises: 32fe21a12190
Create Date: 2025-11-07 18:42:14.013886

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "afd211422425"
down_revision = "32fe21a12190"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enum types (with existence check)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE event_status AS ENUM ('draft', 'active', 'closed');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE event_media_status AS ENUM ('uploaded', 'scanned', 'quarantined');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE event_link_type AS ENUM ('video', 'website', 'social_media');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # Create events table
    op.create_table(
        "events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "npo_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("npos.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("custom_slug", sa.String(255), nullable=True),
        sa.Column(
            "status",
            postgresql.ENUM("draft", "active", "closed", name="event_status", create_type=False),
            nullable=False,
            server_default="draft",
            index=True,
        ),
        sa.Column(
            "event_datetime",
            sa.DateTime(timezone=True),
            nullable=False,
            index=True,
        ),
        sa.Column("timezone", sa.String(50), nullable=False),
        sa.Column("venue_name", sa.String(255), nullable=True),
        sa.Column("venue_address", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("logo_url", sa.String(500), nullable=True),
        sa.Column("primary_color", sa.String(7), nullable=True),
        sa.Column("secondary_color", sa.String(7), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
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
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "updated_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('draft', 'active', 'closed')",
            name="check_event_status",
        ),
        sa.CheckConstraint(
            "primary_color IS NULL OR primary_color ~ '^#[0-9A-Fa-f]{6}$'",
            name="check_primary_color_format",
        ),
        sa.CheckConstraint(
            "secondary_color IS NULL OR secondary_color ~ '^#[0-9A-Fa-f]{6}$'",
            name="check_secondary_color_format",
        ),
    )

    # Create event_media table
    op.create_table(
        "event_media",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "event_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("events.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("file_url", sa.String(500), nullable=False),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("file_type", sa.String(100), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "status",
            postgresql.ENUM(
                "uploaded", "scanned", "quarantined", name="event_media_status", create_type=False
            ),
            nullable=False,
            server_default="uploaded",
        ),
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
        sa.Column(
            "uploaded_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('uploaded', 'scanned', 'quarantined')",
            name="check_media_status",
        ),
        sa.CheckConstraint(
            "file_size <= 10485760",
            name="check_file_size_max_10mb",
        ),
    )

    # Create index for ordered media retrieval
    op.create_index(
        "idx_event_media_display_order",
        "event_media",
        ["event_id", "display_order"],
    )

    # Create event_links table
    op.create_table(
        "event_links",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "event_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("events.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "link_type",
            postgresql.ENUM(
                "video", "website", "social_media", name="event_link_type", create_type=False
            ),
            nullable=False,
        ),
        sa.Column("url", sa.String(500), nullable=False),
        sa.Column("label", sa.String(255), nullable=True),
        sa.Column("platform", sa.String(50), nullable=True),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
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
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "link_type IN ('video', 'website', 'social_media')",
            name="check_link_type",
        ),
    )

    # Create index for ordered link retrieval
    op.create_index(
        "idx_event_links_link_type",
        "event_links",
        ["event_id", "link_type"],
    )

    # Create food_options table
    op.create_table(
        "food_options",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "event_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("events.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
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
        sa.CheckConstraint(
            "name IS NOT NULL AND trim(name) != ''",
            name="check_food_option_name_not_empty",
        ),
    )

    # Create index for ordered food option retrieval
    op.create_index(
        "idx_food_options_display_order",
        "food_options",
        ["event_id", "display_order"],
    )


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table("food_options")
    op.drop_table("event_links")
    op.drop_table("event_media")
    op.drop_table("events")

    # Drop enum types
    op.execute("DROP TYPE IF EXISTS event_link_type")
    op.execute("DROP TYPE IF EXISTS event_media_status")
    op.execute("DROP TYPE IF EXISTS event_status")
