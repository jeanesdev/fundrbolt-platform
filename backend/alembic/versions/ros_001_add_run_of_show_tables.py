"""Add run-of-show tables and system default template.

Revision ID: ros_001
Revises: rg_add_image_fields
Create Date: 2026-05-10
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "ros_001"
down_revision: str | None = "rg_add_image_fields"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create ENUMs
    ros_notification_recipient_type_enum = postgresql.ENUM(
        "donors",
        "auctioneer",
        "all_attendees",
        name="ros_notification_recipient_type_enum",
        create_type=True,
    )
    ros_notification_recipient_type_enum.create(op.get_bind(), checkfirst=True)

    ros_notification_delivery_status_enum = postgresql.ENUM(
        "pending",
        "delivered",
        "failed",
        "cancelled",
        name="ros_notification_delivery_status_enum",
        create_type=True,
    )
    ros_notification_delivery_status_enum.create(op.get_bind(), checkfirst=True)

    # Table 1: run_of_show_templates
    op.create_table(
        "run_of_show_templates",
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
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column(
            "is_system_default",
            sa.Boolean,
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
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.UniqueConstraint("npo_id", "name", name="uq_ros_templates_npo_id_name"),
        sa.CheckConstraint(
            "NOT is_system_default OR npo_id IS NULL",
            name="ck_ros_system_default_no_npo",
        ),
    )
    op.create_index("ix_run_of_show_templates_npo_id", "run_of_show_templates", ["npo_id"])

    # Table 2: run_of_show_template_items
    op.create_table(
        "run_of_show_template_items",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "template_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("run_of_show_templates.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column(
            "offset_minutes",
            sa.Integer,
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "donor_visible_default",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "auctioneer_visible_default",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "display_order",
            sa.Integer,
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.CheckConstraint("offset_minutes >= 0", name="ck_ros_template_item_offset_nonneg"),
    )
    op.create_index(
        "ix_run_of_show_template_items_template_id",
        "run_of_show_template_items",
        ["template_id"],
    )

    # Table 3: run_of_show_items
    op.create_table(
        "run_of_show_items",
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
        ),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("scheduled_time", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "donor_visible",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "auctioneer_visible",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "is_complete",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("completed_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "display_order",
            sa.Integer,
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.CheckConstraint("length(title) >= 1", name="ck_ros_item_title_nonempty"),
    )
    op.create_index("ix_run_of_show_items_event_id", "run_of_show_items", ["event_id"])
    op.create_index(
        "ix_ros_items_event_scheduled_time",
        "run_of_show_items",
        ["event_id", "scheduled_time"],
    )

    # Table 4: scheduled_run_of_show_notifications
    op.create_table(
        "scheduled_run_of_show_notifications",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "ros_item_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("run_of_show_items.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("message_body", sa.Text, nullable=False),
        sa.Column(
            "recipient_type",
            sa.Enum(
                "donors",
                "auctioneer",
                "all_attendees",
                name="ros_notification_recipient_type_enum",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("scheduled_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column(
            "delivery_status",
            sa.Enum(
                "pending",
                "delivered",
                "failed",
                "cancelled",
                name="ros_notification_delivery_status_enum",
                create_type=False,
            ),
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column("celery_task_id", sa.String(255), nullable=True),
        sa.Column("delivered_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("failure_reason", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
    )

    # Seed the "3-Hour Gala" system default template
    op.execute("""
        DO $$
        DECLARE
            template_id UUID := gen_random_uuid();
        BEGIN
            INSERT INTO run_of_show_templates (id, npo_id, name, is_system_default, created_by)
            VALUES (template_id, NULL, '3-Hour Gala', TRUE, NULL);

            INSERT INTO run_of_show_template_items (id, template_id, title, offset_minutes, donor_visible_default, auctioneer_visible_default, display_order)
            VALUES
                (gen_random_uuid(), template_id, 'Doors Open', 0, TRUE, TRUE, 0),
                (gen_random_uuid(), template_id, 'Welcome Reception / Cocktail Hour', 15, TRUE, TRUE, 1),
                (gen_random_uuid(), template_id, 'Guests Take Seats', 60, TRUE, TRUE, 2),
                (gen_random_uuid(), template_id, 'Opening Remarks', 70, TRUE, TRUE, 3),
                (gen_random_uuid(), template_id, 'Sponsor Recognition', 80, TRUE, TRUE, 4),
                (gen_random_uuid(), template_id, 'Dinner Service Begins', 90, TRUE, TRUE, 5),
                (gen_random_uuid(), template_id, 'Silent Auction Closes', 95, FALSE, TRUE, 6),
                (gen_random_uuid(), template_id, 'Live Auction Begins', 100, TRUE, TRUE, 7),
                (gen_random_uuid(), template_id, 'Fund-a-Need / Paddle Raise', 120, TRUE, TRUE, 8),
                (gen_random_uuid(), template_id, 'Live Auction Closes', 150, FALSE, TRUE, 9),
                (gen_random_uuid(), template_id, 'Award Presentation / Mission Moment', 155, TRUE, TRUE, 10),
                (gen_random_uuid(), template_id, 'Closing Remarks', 165, TRUE, TRUE, 11),
                (gen_random_uuid(), template_id, 'Checkout Opens', 170, TRUE, TRUE, 12),
                (gen_random_uuid(), template_id, 'Event Concludes', 180, TRUE, TRUE, 13);
        END $$;
    """)


def downgrade() -> None:
    op.drop_table("scheduled_run_of_show_notifications")
    op.drop_index("ix_ros_items_event_scheduled_time", table_name="run_of_show_items")
    op.drop_index("ix_run_of_show_items_event_id", table_name="run_of_show_items")
    op.drop_table("run_of_show_items")
    op.drop_index(
        "ix_run_of_show_template_items_template_id",
        table_name="run_of_show_template_items",
    )
    op.drop_table("run_of_show_template_items")
    op.drop_index("ix_run_of_show_templates_npo_id", table_name="run_of_show_templates")
    op.drop_table("run_of_show_templates")

    op.execute("DROP TYPE IF EXISTS ros_notification_delivery_status_enum")
    op.execute("DROP TYPE IF EXISTS ros_notification_recipient_type_enum")
