"""create_ticket_purchases_table

Revision ID: 66b5a902fd37
Revises: a081d79a05cc
Create Date: 2026-01-06 22:19:24.482093

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "66b5a902fd37"
down_revision = "a081d79a05cc"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enum type for payment_status
    op.execute("""
        CREATE TYPE payment_status_enum AS ENUM ('pending', 'completed', 'failed', 'refunded')
    """)

    # Create ticket_purchases table
    op.create_table(
        "ticket_purchases",
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
            "ticket_package_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("ticket_packages.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False
        ),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("total_price", sa.Numeric(10, 2), nullable=False),
        sa.Column(
            "payment_status",
            postgresql.ENUM(
                "pending",
                "completed",
                "failed",
                "refunded",
                name="payment_status_enum",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column(
            "purchased_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint("quantity > 0", name="check_purchase_quantity_positive"),
        sa.CheckConstraint("total_price >= 0", name="check_total_price_positive"),
    )

    # Create indexes
    op.create_index("idx_ticket_purchases_event_id", "ticket_purchases", ["event_id"])
    op.create_index("idx_ticket_purchases_package_id", "ticket_purchases", ["ticket_package_id"])
    op.create_index("idx_ticket_purchases_user_id", "ticket_purchases", ["user_id"])

    # Add foreign key constraints to option_responses and promo_code_applications
    op.create_foreign_key(
        "fk_option_responses_purchase_id",
        "option_responses",
        "ticket_purchases",
        ["ticket_purchase_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_promo_applications_purchase_id",
        "promo_code_applications",
        "ticket_purchases",
        ["ticket_purchase_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_promo_applications_purchase_id", "promo_code_applications", type_="foreignkey"
    )
    op.drop_constraint("fk_option_responses_purchase_id", "option_responses", type_="foreignkey")
    op.drop_index("idx_ticket_purchases_user_id", table_name="ticket_purchases")
    op.drop_index("idx_ticket_purchases_package_id", table_name="ticket_purchases")
    op.drop_index("idx_ticket_purchases_event_id", table_name="ticket_purchases")
    op.drop_table("ticket_purchases")
    op.execute("DROP TYPE payment_status_enum")
