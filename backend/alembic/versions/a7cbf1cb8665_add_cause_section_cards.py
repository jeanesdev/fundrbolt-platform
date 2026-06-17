"""add_cause_section_cards

Revision ID: a7cbf1cb8665
Revises: nudge_001_add_event_nudge_tables
Create Date: 2026-06-15 22:00:19.669636

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "a7cbf1cb8665"
down_revision = "nudge_001_add_event_nudge_tables"
branch_labels = None
depends_on = None


CAUSE_SECTION_CARD_TYPE_ENUM = postgresql.ENUM(
    "text",
    "slideshow",
    "video",
    "built_in",
    name="cause_section_card_type_enum",
    create_type=False,
)
CAUSE_SECTION_CARD_MEDIA_SOURCE_ENUM = postgresql.ENUM(
    "upload",
    "external",
    name="cause_section_card_media_source_enum",
    create_type=False,
)
CAUSE_SECTION_SLIDE_VARIANT_ENUM = postgresql.ENUM(
    "image_only",
    "text_over_image",
    "text_only",
    name="cause_section_slide_variant_enum",
    create_type=False,
)
CAUSE_SECTION_SLIDE_MEDIA_SOURCE_ENUM = postgresql.ENUM(
    "upload",
    "external",
    name="cause_section_slide_media_source_enum",
    create_type=False,
)
CAUSE_SECTION_REVISION_ACTION_ENUM = postgresql.ENUM(
    "draft_saved",
    "published",
    "reverted",
    name="cause_section_card_revision_action_enum",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()

    CAUSE_SECTION_CARD_TYPE_ENUM.create(bind, checkfirst=True)
    CAUSE_SECTION_CARD_MEDIA_SOURCE_ENUM.create(bind, checkfirst=True)
    CAUSE_SECTION_SLIDE_VARIANT_ENUM.create(bind, checkfirst=True)
    CAUSE_SECTION_SLIDE_MEDIA_SOURCE_ENUM.create(bind, checkfirst=True)
    CAUSE_SECTION_REVISION_ACTION_ENUM.create(bind, checkfirst=True)

    op.create_table(
        "event_cause_page_config",
        sa.Column("event_id", sa.UUID(), nullable=False),
        sa.Column("draft_version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("published_version", sa.Integer(), server_default="0", nullable=False),
        sa.Column("last_published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_published_by_user_id", sa.UUID(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("draft_version >= 1", name="ck_event_cause_page_config_draft_version"),
        sa.CheckConstraint(
            "published_version >= 0",
            name="ck_event_cause_page_config_published_version_nonnegative",
        ),
        sa.CheckConstraint(
            "published_version <= draft_version",
            name="ck_event_cause_page_config_versions_ordered",
        ),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["last_published_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_id", name="uq_event_cause_page_config_event_id"),
    )
    op.create_index(
        op.f("ix_event_cause_page_config_event_id"),
        "event_cause_page_config",
        ["event_id"],
        unique=False,
    )

    op.create_table(
        "cause_section_cards",
        sa.Column("event_id", sa.UUID(), nullable=False),
        sa.Column("draft_version", sa.Integer(), nullable=False),
        sa.Column("card_type", CAUSE_SECTION_CARD_TYPE_ENUM, nullable=False),
        sa.Column("built_in_section_key", sa.String(length=64), nullable=True),
        sa.Column("display_order", sa.Integer(), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("title", sa.String(length=200), nullable=True),
        sa.Column("show_header", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("is_collapsible", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("background_color_token", sa.String(length=64), nullable=True),
        sa.Column("border_color_token", sa.String(length=64), nullable=True),
        sa.Column("content_html", sa.Text(), nullable=True),
        sa.Column("video_url", sa.String(length=2048), nullable=True),
        sa.Column("video_media_source", CAUSE_SECTION_CARD_MEDIA_SOURCE_ENUM, nullable=True),
        sa.Column("video_autoplay", sa.Boolean(), nullable=True),
        sa.Column("video_muted_by_default", sa.Boolean(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "(card_type = 'built_in' AND built_in_section_key IS NOT NULL) "
            "OR (card_type <> 'built_in' AND built_in_section_key IS NULL)",
            name="ck_cause_section_cards_built_in_key_required",
        ),
        sa.CheckConstraint(
            "built_in_section_key IS NULL "
            "OR built_in_section_key IN ('about', 'sponsors', 'event_details')",
            name="ck_cause_section_cards_built_in_key_valid",
        ),
        sa.CheckConstraint("display_order >= 0", name="ck_cause_section_cards_display_order"),
        sa.CheckConstraint("draft_version >= 1", name="ck_cause_section_cards_draft_version"),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "event_id",
            "draft_version",
            "display_order",
            name="uq_cause_section_cards_event_version_order",
        ),
    )
    op.create_index(
        op.f("ix_cause_section_cards_event_id"),
        "cause_section_cards",
        ["event_id"],
        unique=False,
    )
    op.create_index(
        "ix_cause_section_cards_event_version_order",
        "cause_section_cards",
        ["event_id", "draft_version", "display_order"],
        unique=False,
    )
    op.create_index(
        "ix_cause_section_cards_event_version_built_in_key",
        "cause_section_cards",
        ["event_id", "draft_version", "built_in_section_key"],
        unique=True,
        postgresql_where=sa.text("built_in_section_key IS NOT NULL"),
    )

    op.create_table(
        "cause_section_slide_items",
        sa.Column("card_id", sa.UUID(), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False),
        sa.Column("slide_variant", CAUSE_SECTION_SLIDE_VARIANT_ENUM, nullable=False),
        sa.Column("media_url", sa.String(length=2048), nullable=True),
        sa.Column("media_source", CAUSE_SECTION_SLIDE_MEDIA_SOURCE_ENUM, nullable=True),
        sa.Column("alt_text", sa.String(length=500), nullable=True),
        sa.Column("overlay_html", sa.Text(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "(slide_variant = 'text_only') OR media_url IS NOT NULL",
            name="ck_cause_section_slide_items_media_required",
        ),
        sa.CheckConstraint(
            "(slide_variant = 'text_only') OR media_source IS NOT NULL",
            name="ck_cause_section_slide_items_media_source_required",
        ),
        sa.CheckConstraint(
            "(slide_variant = 'text_only') "
            "OR (alt_text IS NOT NULL AND length(trim(alt_text)) > 0)",
            name="ck_cause_section_slide_items_alt_text_required",
        ),
        sa.CheckConstraint(
            "display_order >= 0",
            name="ck_cause_section_slide_items_display_order",
        ),
        sa.ForeignKeyConstraint(["card_id"], ["cause_section_cards.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "card_id",
            "display_order",
            name="uq_cause_section_slide_items_card_order",
        ),
    )
    op.create_index(
        op.f("ix_cause_section_slide_items_card_id"),
        "cause_section_slide_items",
        ["card_id"],
        unique=False,
    )

    op.create_table(
        "cause_section_card_revisions",
        sa.Column("event_id", sa.UUID(), nullable=False),
        sa.Column("changed_by_user_id", sa.UUID(), nullable=False),
        sa.Column("action", CAUSE_SECTION_REVISION_ACTION_ENUM, nullable=False),
        sa.Column("draft_version", sa.Integer(), nullable=False),
        sa.Column("changed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("change_summary", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.CheckConstraint(
            "draft_version >= 1",
            name="ck_cause_section_card_revisions_draft_version",
        ),
        sa.ForeignKeyConstraint(["changed_by_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_cause_section_card_revisions_event_id"),
        "cause_section_card_revisions",
        ["event_id"],
        unique=False,
    )
    op.create_index(
        "ix_cause_section_card_revisions_event_changed_at",
        "cause_section_card_revisions",
        ["event_id", "changed_at"],
        unique=False,
    )


def downgrade() -> None:
    bind = op.get_bind()

    op.drop_index(
        "ix_cause_section_card_revisions_event_changed_at",
        table_name="cause_section_card_revisions",
    )
    op.drop_index(
        op.f("ix_cause_section_card_revisions_event_id"),
        table_name="cause_section_card_revisions",
    )
    op.drop_table("cause_section_card_revisions")

    op.drop_index(
        op.f("ix_cause_section_slide_items_card_id"),
        table_name="cause_section_slide_items",
    )
    op.drop_table("cause_section_slide_items")

    op.drop_index(
        "ix_cause_section_cards_event_version_built_in_key",
        table_name="cause_section_cards",
    )
    op.drop_index(
        "ix_cause_section_cards_event_version_order",
        table_name="cause_section_cards",
    )
    op.drop_index(op.f("ix_cause_section_cards_event_id"), table_name="cause_section_cards")
    op.drop_table("cause_section_cards")

    op.drop_index(
        op.f("ix_event_cause_page_config_event_id"),
        table_name="event_cause_page_config",
    )
    op.drop_table("event_cause_page_config")

    CAUSE_SECTION_REVISION_ACTION_ENUM.drop(bind, checkfirst=True)
    CAUSE_SECTION_SLIDE_MEDIA_SOURCE_ENUM.drop(bind, checkfirst=True)
    CAUSE_SECTION_SLIDE_VARIANT_ENUM.drop(bind, checkfirst=True)
    CAUSE_SECTION_CARD_MEDIA_SOURCE_ENUM.drop(bind, checkfirst=True)
    CAUSE_SECTION_CARD_TYPE_ENUM.drop(bind, checkfirst=True)
