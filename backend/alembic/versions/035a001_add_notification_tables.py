"""Add notification tables.

Revision ID: 035a001_notifications
Revises: 034a002_npo_reopened
Create Date: 2025-01-15 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "035a001_notifications"
down_revision: str | None = "034a002_npo_reopened"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create enum types
    notification_type_enum = postgresql.ENUM(
        "outbid",
        "auction_opened",
        "auction_closing_soon",
        "auction_closed",
        "item_won",
        "admin_bid_placed",
        "paddle_raise",
        "checkout_reminder",
        "bid_confirmation",
        "proxy_bid_triggered",
        "welcome",
        "custom",
        name="notification_type_enum",
        create_type=False,
    )
    notification_type_enum.create(op.get_bind(), checkfirst=True)

    notification_priority_enum = postgresql.ENUM(
        "low",
        "normal",
        "high",
        "urgent",
        name="notification_priority_enum",
        create_type=False,
    )
    notification_priority_enum.create(op.get_bind(), checkfirst=True)

    delivery_channel_enum = postgresql.ENUM(
        "inapp",
        "push",
        "email",
        "sms",
        name="delivery_channel_enum",
        create_type=False,
    )
    delivery_channel_enum.create(op.get_bind(), checkfirst=True)

    delivery_status_enum = postgresql.ENUM(
        "pending",
        "sent",
        "delivered",
        "failed",
        "skipped",
        name="delivery_status_enum",
        create_type=False,
    )
    delivery_status_enum.create(op.get_bind(), checkfirst=True)

    campaign_status_enum = postgresql.ENUM(
        "draft",
        "sending",
        "sent",
        "failed",
        name="campaign_status_enum",
        create_type=False,
    )
    campaign_status_enum.create(op.get_bind(), checkfirst=True)

    # Create notification_campaigns table first (notifications FK references it)
    op.create_table(
        "notification_campaigns",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "event_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("events.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "sender_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column(
            "recipient_criteria",
            sa.dialects.postgresql.JSONB(),
            nullable=False,
        ),
        sa.Column("channels", sa.dialects.postgresql.JSONB(), nullable=False),
        sa.Column("recipient_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("delivered_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "status",
            campaign_status_enum,
            nullable=False,
            server_default="draft",
        ),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # Create notifications table
    op.create_table(
        "notifications",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "event_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("events.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("notification_type", notification_type_enum, nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "priority",
            notification_priority_enum,
            nullable=False,
            server_default="normal",
        ),
        sa.Column("data", sa.dialects.postgresql.JSONB(), nullable=True),
        sa.Column(
            "is_read",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "campaign_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("notification_campaigns.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_by",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_index(
        "ix_notifications_user_event",
        "notifications",
        ["user_id", "event_id", sa.text("created_at DESC")],
    )
    op.create_index(
        "ix_notifications_user_unread",
        "notifications",
        ["user_id", "event_id"],
        postgresql_where=sa.text("is_read = false"),
    )
    op.create_index(
        "ix_notifications_expires",
        "notifications",
        ["expires_at"],
        postgresql_where=sa.text("expires_at IS NOT NULL"),
    )

    # Create notification_delivery_statuses table
    op.create_table(
        "notification_delivery_statuses",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "notification_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("notifications.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("channel", delivery_channel_enum, nullable=False),
        sa.Column(
            "status",
            delivery_status_enum,
            nullable=False,
            server_default="pending",
        ),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column("external_id", sa.String(255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "notification_id",
            "channel",
            name="uq_delivery_status_notification_channel",
        ),
    )
    op.create_index(
        "ix_delivery_status_pending",
        "notification_delivery_statuses",
        ["notification_id"],
        postgresql_where=sa.text("status = 'pending'"),
    )

    # Create notification_preferences table
    op.create_table(
        "notification_preferences",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("notification_type", notification_type_enum, nullable=False),
        sa.Column("channel", delivery_channel_enum, nullable=False),
        sa.Column(
            "enabled",
            sa.Boolean(),
            nullable=False,
            server_default="true",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "user_id",
            "notification_type",
            "channel",
            name="uq_notification_preference_user_type_channel",
        ),
    )

    # Create push_subscriptions table
    op.create_table(
        "push_subscriptions",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("endpoint", sa.Text(), nullable=False, unique=True),
        sa.Column("p256dh_key", sa.Text(), nullable=False),
        sa.Column("auth_key", sa.Text(), nullable=False),
        sa.Column("platform", sa.String(20), nullable=True),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default="true",
        ),
        sa.Column("deactivated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deactivation_reason", sa.String(100), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_push_sub_user_active",
        "push_subscriptions",
        ["user_id"],
        postgresql_where=sa.text("is_active = true"),
    )


def downgrade() -> None:
    op.drop_index("ix_push_sub_user_active", table_name="push_subscriptions")
    op.drop_table("push_subscriptions")

    op.drop_table("notification_preferences")

    op.drop_index(
        "ix_delivery_status_pending",
        table_name="notification_delivery_statuses",
    )
    op.drop_table("notification_delivery_statuses")

    op.drop_index("ix_notifications_expires", table_name="notifications")
    op.drop_index("ix_notifications_user_unread", table_name="notifications")
    op.drop_index("ix_notifications_user_event", table_name="notifications")
    op.drop_table("notifications")

    op.drop_table("notification_campaigns")

    # Drop enum types
    sa.Enum(name="campaign_status_enum").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="delivery_status_enum").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="delivery_channel_enum").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="notification_priority_enum").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="notification_type_enum").drop(op.get_bind(), checkfirst=True)
