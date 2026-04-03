"""add_checklist_tables

Revision ID: 037a001_add_checklist_tables
Revises: 037_event_custom_options
Create Date: 2026-04-03 00:00:00.000000

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "037a001_add_checklist_tables"
down_revision: str = "037_event_custom_options"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enum type for checklist item status
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE checklist_item_status_enum AS ENUM (
                'not_complete', 'in_progress', 'complete'
            );
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)

    # Create checklist_templates table
    op.create_table(
        "checklist_templates",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "npo_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("npos.id", ondelete="RESTRICT"),
            nullable=True,
            index=True,
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "is_system_default",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
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
    )

    # Unique constraint: no duplicate template names per NPO
    op.create_unique_constraint(
        "uq_checklist_templates_npo_id_name",
        "checklist_templates",
        ["npo_id", "name"],
    )

    # Partial unique index: only one is_default=TRUE per npo_id
    op.execute("""
        CREATE UNIQUE INDEX ix_checklist_templates_npo_default
        ON checklist_templates (npo_id)
        WHERE is_default = TRUE;
    """)

    # Check constraint: is_system_default implies npo_id IS NULL
    op.create_check_constraint(
        "ck_system_default_no_npo",
        "checklist_templates",
        "NOT is_system_default OR npo_id IS NULL",
    )

    # Create checklist_template_items table
    op.create_table(
        "checklist_template_items",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "template_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("checklist_templates.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("offset_days", sa.Integer(), nullable=True),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )

    # Check constraint: title has at least 1 character
    op.create_check_constraint(
        "ck_template_item_title_nonempty",
        "checklist_template_items",
        "length(title) >= 1",
    )

    # Create checklist_items table
    op.create_table(
        "checklist_items",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "event_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("events.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column(
            "status",
            postgresql.ENUM(
                "not_complete",
                "in_progress",
                "complete",
                name="checklist_item_status_enum",
                create_type=False,
            ),
            nullable=False,
            server_default=sa.text("'not_complete'"),
        ),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "due_date_is_template_derived",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("offset_days", sa.Integer(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
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
    )

    # Check constraint: title has at least 1 character
    op.create_check_constraint(
        "ck_checklist_item_title_nonempty",
        "checklist_items",
        "length(title) >= 1",
    )


def downgrade() -> None:
    op.drop_table("checklist_items")
    op.drop_table("checklist_template_items")
    op.drop_constraint("ck_system_default_no_npo", "checklist_templates", type_="check")
    op.execute("DROP INDEX IF EXISTS ix_checklist_templates_npo_default")
    op.drop_table("checklist_templates")
    op.execute("DROP TYPE IF EXISTS checklist_item_status_enum")
