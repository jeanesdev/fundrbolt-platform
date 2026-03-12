"""add_payment_processing_tables

Revision ID: pay033_001
Revises: 034a002_npo_reopened, badge_color_002
Create Date: 2026-03-10 00:00:00.000000

Migration plan:
  M1 — payment_gateway_credentials (per-NPO encrypted Deluxe credentials)
  M2 — payment_profiles (tokenized saved cards, one vault per user/NPO pair)
  M3 — payment_transactions (immutable audit record for every payment event)
  M4 — payment_receipts (PDF receipt metadata and email delivery tracking)
  M5 — ticket_purchases.payment_transaction_id (FK to payment_transactions)
  M6 — events.checkout_open (end-of-night self-checkout toggle)
  M7 — partial indexes for pending-poll cron and email-retry cron
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "pay033_001"
down_revision: str | Sequence[str] | None = "badge_color_002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add payment processing tables and column additions."""

    # ── M1: payment_gateway_credentials ─────────────────────────────────────
    op.create_table(
        "payment_gateway_credentials",
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
            unique=True,
        ),
        sa.Column("gateway_name", sa.String(50), nullable=False, server_default="deluxe"),
        sa.Column("merchant_id_enc", sa.Text, nullable=False),
        sa.Column("api_key_enc", sa.Text, nullable=False),
        sa.Column("api_secret_enc", sa.Text, nullable=False),
        sa.Column("gateway_id", sa.String(100), nullable=True),
        sa.Column("is_live_mode", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.CheckConstraint(
            "gateway_name IN ('deluxe', 'stub')",
            name="ck_payment_gateway_credentials_gateway_name",
        ),
    )
    op.create_index(
        "ix_payment_gateway_credentials_npo_id",
        "payment_gateway_credentials",
        ["npo_id"],
        unique=True,
    )

    # ── M2: payment_profiles ─────────────────────────────────────────────────
    op.create_table(
        "payment_profiles",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "npo_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("npos.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("gateway_profile_id", sa.String(255), nullable=False),
        sa.Column("card_last4", sa.String(4), nullable=False),
        sa.Column("card_brand", sa.String(20), nullable=False),
        sa.Column("card_expiry_month", sa.SmallInteger, nullable=False),
        sa.Column("card_expiry_year", sa.SmallInteger, nullable=False),
        sa.Column("billing_name", sa.String(200), nullable=True),
        sa.Column("billing_zip", sa.String(10), nullable=True),
        sa.Column("is_default", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.UniqueConstraint(
            "user_id",
            "npo_id",
            "gateway_profile_id",
            name="uq_payment_profiles_user_npo_gateway",
        ),
    )
    op.create_index("ix_payment_profiles_user_id", "payment_profiles", ["user_id"])
    op.create_index("ix_payment_profiles_npo_id", "payment_profiles", ["npo_id"])
    op.create_index(
        "ix_payment_profiles_user_npo",
        "payment_profiles",
        ["user_id", "npo_id"],
    )
    op.create_index(
        "ix_payment_profiles_gateway_profile_id",
        "payment_profiles",
        ["gateway_profile_id"],
    )

    # ── Create enum types for M3 ─────────────────────────────────────────────
    op.execute(
        "CREATE TYPE transaction_type_enum AS ENUM ('charge', 'auth_only', 'capture', 'void', 'refund')"
    )
    op.execute(
        "CREATE TYPE transaction_status_enum AS ENUM ('pending', 'authorized', 'captured', 'voided', 'refunded', 'declined', 'error')"
    )

    # ── M3: payment_transactions ─────────────────────────────────────────────
    op.create_table(
        "payment_transactions",
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
            nullable=False,
        ),
        sa.Column(
            "event_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("events.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "payment_profile_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("payment_profiles.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "initiated_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        # Self-FK added after table creation (circular reference)
        sa.Column(
            "gateway_transaction_id",
            sa.String(255),
            nullable=True,
            unique=True,
        ),
        sa.Column(
            "idempotency_key",
            sa.String(64),
            nullable=True,
            unique=True,
        ),
        sa.Column(
            "transaction_type",
            postgresql.ENUM(
                "charge",
                "auth_only",
                "capture",
                "void",
                "refund",
                name="transaction_type_enum",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column(
            "status",
            postgresql.ENUM(
                "pending",
                "authorized",
                "captured",
                "voided",
                "refunded",
                "declined",
                "error",
                name="transaction_status_enum",
                create_type=False,
            ),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("line_items", postgresql.JSONB, nullable=True),
        sa.Column("gateway_response", postgresql.JSONB, nullable=True),
        sa.Column("session_created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reason", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.CheckConstraint("amount >= 0", name="ck_payment_transactions_amount_non_negative"),
    )

    # Add self-FK for parent_transaction_id after table exists
    op.add_column(
        "payment_transactions",
        sa.Column(
            "parent_transaction_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("payment_transactions.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    # Composite and standard indexes for payment_transactions
    op.create_index(
        "ix_payment_transactions_npo_id",
        "payment_transactions",
        ["npo_id"],
    )
    op.create_index(
        "ix_payment_transactions_event_id",
        "payment_transactions",
        ["event_id"],
    )
    op.create_index(
        "ix_payment_transactions_user_id",
        "payment_transactions",
        ["user_id"],
    )
    op.create_index(
        "ix_payment_transactions_user_event",
        "payment_transactions",
        ["user_id", "event_id"],
    )
    op.create_index(
        "ix_payment_transactions_event_status",
        "payment_transactions",
        ["event_id", "status"],
    )
    op.create_index(
        "ix_payment_transactions_npo_created",
        "payment_transactions",
        ["npo_id", "created_at"],
    )

    # ── M4: payment_receipts ─────────────────────────────────────────────────
    op.create_table(
        "payment_receipts",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "transaction_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("payment_transactions.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("pdf_url", sa.String(500), nullable=True),
        sa.Column("pdf_generated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("email_address", sa.String(255), nullable=False),
        sa.Column("email_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("email_attempts", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index(
        "ix_payment_receipts_transaction_id",
        "payment_receipts",
        ["transaction_id"],
        unique=True,
    )

    # ── M5: ticket_purchases.payment_transaction_id ──────────────────────────
    op.add_column(
        "ticket_purchases",
        sa.Column(
            "payment_transaction_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("payment_transactions.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_ticket_purchases_payment_transaction_id",
        "ticket_purchases",
        ["payment_transaction_id"],
    )

    # ── M6: events.checkout_open ─────────────────────────────────────────────
    op.execute(
        "ALTER TABLE events ADD COLUMN IF NOT EXISTS checkout_open BOOLEAN NOT NULL DEFAULT false"
    )

    # ── M7: Partial indexes ───────────────────────────────────────────────────
    # Pending transactions for polling fallback cron
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_payment_transactions_pending_session
        ON payment_transactions (status, session_created_at)
        WHERE status = 'pending';
        """
    )
    # Receipts pending email delivery for retry cron
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_payment_receipts_email_retry
        ON payment_receipts (email_sent_at, email_attempts)
        WHERE email_sent_at IS NULL;
        """
    )


def downgrade() -> None:
    """Remove all payment processing tables and column additions."""

    # M7: Partial indexes
    op.execute("DROP INDEX IF EXISTS ix_payment_receipts_email_retry;")
    op.execute("DROP INDEX IF EXISTS ix_payment_transactions_pending_session;")

    # M6: events.checkout_open
    op.execute("ALTER TABLE events DROP COLUMN IF EXISTS checkout_open")

    # M5: ticket_purchases.payment_transaction_id
    op.drop_index("ix_ticket_purchases_payment_transaction_id", table_name="ticket_purchases")
    op.drop_column("ticket_purchases", "payment_transaction_id")

    # M4: payment_receipts
    op.drop_table("payment_receipts")

    # M3: payment_transactions
    op.drop_table("payment_transactions")
    op.execute("DROP TYPE IF EXISTS transaction_status_enum;")
    op.execute("DROP TYPE IF EXISTS transaction_type_enum;")

    # M2: payment_profiles
    op.drop_table("payment_profiles")

    # M1: payment_gateway_credentials
    op.drop_table("payment_gateway_credentials")
