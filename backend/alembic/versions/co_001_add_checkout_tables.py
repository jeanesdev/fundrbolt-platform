"""Add checkout tables for donor event checkout (feature 044).

Revision ID: co_001
Revises: ros_003_multi_interval
Create Date: 2025-01-01 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "co_001"
down_revision: str | None = "ros_003_multi_interval"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── ENUMs ─────────────────────────────────────────────────────────────────
    checkout_status_enum = postgresql.ENUM(
        "not_started",
        "in_progress",
        "complete",
        name="checkout_status_enum",
        create_type=False,
    )
    checkout_status_enum.create(op.get_bind(), checkfirst=True)

    checkout_payment_method_enum = postgresql.ENUM(
        "card",
        "cash",
        "check",
        "daf",
        name="checkout_payment_method_enum",
        create_type=False,
    )
    checkout_payment_method_enum.create(op.get_bind(), checkfirst=True)

    checkout_item_source_type_enum = postgresql.ENUM(
        "auction_win",
        "quick_entry_bid",
        "quick_entry_donation",
        "ticket",
        "revenue_generator",
        "manual",
        name="checkout_item_source_type_enum",
        create_type=False,
    )
    checkout_item_source_type_enum.create(op.get_bind(), checkfirst=True)

    checkout_audit_action_enum = postgresql.ENUM(
        "item_added",
        "item_removed",
        "item_repriced",
        name="checkout_audit_action_enum",
        create_type=False,
    )
    checkout_audit_action_enum.create(op.get_bind(), checkfirst=True)

    # ── Table 1: processing_fee_configs (append-only) ─────────────────────────
    op.create_table(
        "processing_fee_configs",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "rate",
            sa.Numeric(5, 4),
            nullable=False,
            comment="Processing fee rate (e.g. 0.0290 = 2.90%)",
        ),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # Seed initial processing fee rate (2.90%)
    op.execute(
        """
        INSERT INTO processing_fee_configs (id, rate, created_by, created_at)
        SELECT gen_random_uuid(), 0.0290, NULL, now()
        WHERE NOT EXISTS (SELECT 1 FROM processing_fee_configs)
        """
    )

    # ── Table 2: checkout_configurations ──────────────────────────────────────
    op.create_table(
        "checkout_configurations",
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
            unique=True,
        ),
        sa.Column(
            "is_open",
            sa.Boolean,
            nullable=False,
            server_default="false",
        ),
        sa.Column(
            "donor_visible",
            sa.Boolean,
            nullable=False,
            server_default="false",
        ),
        sa.Column(
            "scheduled_open_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "opened_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "processing_fee_rate",
            sa.Numeric(5, 4),
            nullable=True,
            comment="Snapshot of processing fee rate at checkout open time",
        ),
        sa.Column(
            "cash_instructions",
            sa.Text,
            nullable=True,
        ),
        sa.Column(
            "celery_task_id",
            sa.Text,
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
    op.create_index(
        "ix_checkout_configurations_event_id",
        "checkout_configurations",
        ["event_id"],
        unique=True,
    )

    # ── Table 3: checkout_sessions ─────────────────────────────────────────────
    op.create_table(
        "checkout_sessions",
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
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "not_started",
                "in_progress",
                "complete",
                name="checkout_status_enum",
                create_type=False,
            ),
            nullable=False,
            server_default="not_started",
        ),
        sa.Column(
            "payment_method",
            sa.Enum(
                "card",
                "cash",
                "check",
                "daf",
                name="checkout_payment_method_enum",
                create_type=False,
            ),
            nullable=True,
        ),
        sa.Column(
            "cover_processing_fee",
            sa.Boolean,
            nullable=False,
            server_default="true",
        ),
        sa.Column(
            "auctioneer_tip_cents",
            sa.Integer,
            nullable=False,
            server_default="5000",
        ),
        sa.Column(
            "platform_tip_cents",
            sa.Integer,
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "subtotal_cents",
            sa.Integer,
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "processing_fee_cents",
            sa.Integer,
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "total_cents",
            sa.Integer,
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "completed_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "receipt_url",
            sa.Text,
            nullable=True,
        ),
        sa.Column(
            "items_updated_at",
            sa.DateTime(timezone=True),
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
        sa.UniqueConstraint("event_id", "user_id", name="uq_checkout_sessions_event_user"),
    )
    op.create_index(
        "ix_checkout_sessions_event_status",
        "checkout_sessions",
        ["event_id", "status"],
    )
    op.create_index(
        "ix_checkout_sessions_user_id",
        "checkout_sessions",
        ["user_id"],
    )

    # ── Table 4: checkout_items ────────────────────────────────────────────────
    op.create_table(
        "checkout_items",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("checkout_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "name",
            sa.String(200),
            nullable=False,
        ),
        sa.Column(
            "description",
            sa.Text,
            nullable=True,
        ),
        sa.Column(
            "original_amount_cents",
            sa.Integer,
            nullable=False,
        ),
        sa.Column(
            "adjusted_amount_cents",
            sa.Integer,
            nullable=True,
        ),
        sa.Column(
            "source_type",
            sa.Enum(
                "auction_win",
                "quick_entry_bid",
                "quick_entry_donation",
                "ticket",
                "revenue_generator",
                "manual",
                name="checkout_item_source_type_enum",
                create_type=False,
            ),
            nullable=False,
            server_default="manual",
        ),
        sa.Column(
            "source_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column(
            "display_order",
            sa.Integer,
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "deleted_at",
            sa.DateTime(timezone=True),
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
    op.create_index(
        "ix_checkout_items_session_id",
        "checkout_items",
        ["session_id"],
    )

    # ── Table 5: checkout_audit_logs ───────────────────────────────────────────
    op.create_table(
        "checkout_audit_logs",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("checkout_sessions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "admin_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "action",
            sa.Enum(
                "item_added",
                "item_removed",
                "item_repriced",
                name="checkout_audit_action_enum",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column(
            "item_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("checkout_items.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "field_changed",
            sa.String(50),
            nullable=True,
        ),
        sa.Column(
            "before_value",
            sa.Text,
            nullable=True,
        ),
        sa.Column(
            "after_value",
            sa.Text,
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )


def downgrade() -> None:
    op.drop_table("checkout_audit_logs")
    op.drop_table("checkout_items")
    op.drop_table("checkout_sessions")
    op.drop_index("ix_checkout_configurations_event_id", table_name="checkout_configurations")
    op.drop_table("checkout_configurations")
    op.drop_table("processing_fee_configs")

    # Drop ENUMs
    op.execute("DROP TYPE IF EXISTS checkout_audit_action_enum")
    op.execute("DROP TYPE IF EXISTS checkout_item_source_type_enum")
    op.execute("DROP TYPE IF EXISTS checkout_payment_method_enum")
    op.execute("DROP TYPE IF EXISTS checkout_status_enum")
