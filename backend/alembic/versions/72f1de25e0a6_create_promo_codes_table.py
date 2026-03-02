"""create_promo_codes_table

Revision ID: 72f1de25e0a6
Revises: f264ff29ec74
Create Date: 2026-01-06 22:19:22.969303

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "72f1de25e0a6"
down_revision = "f264ff29ec74"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enum type for discount_type
    op.execute("""
        CREATE TYPE discount_type_enum AS ENUM ('percentage', 'fixed_amount')
    """)

    # Create promo_codes table
    op.create_table(
        "promo_codes",
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
        sa.Column("code", sa.String(50), nullable=False),
        sa.Column(
            "discount_type",
            postgresql.ENUM(
                "percentage", "fixed_amount", name="discount_type_enum", create_type=False
            ),
            nullable=False,
        ),
        sa.Column("discount_value", sa.Numeric(10, 2), nullable=False),
        sa.Column("max_uses", sa.Integer(), nullable=True),
        sa.Column("used_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("valid_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("valid_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False
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
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.CheckConstraint("discount_value > 0", name="check_promo_discount_value_positive"),
        sa.CheckConstraint(
            "(discount_type = 'percentage' AND discount_value <= 100) OR discount_type = 'fixed_amount'",
            name="check_percentage_max_100",
        ),
        sa.CheckConstraint(
            "max_uses IS NULL OR max_uses >= used_count", name="check_max_uses_vs_used"
        ),
        sa.CheckConstraint("used_count >= 0", name="check_used_count_positive"),
        sa.UniqueConstraint("event_id", "code", name="uq_promo_code_event_code"),
    )

    # Create indexes
    op.create_index("idx_promo_codes_event_id", "promo_codes", ["event_id"])
    op.create_index("idx_promo_codes_code", "promo_codes", ["event_id", "code"])


def downgrade() -> None:
    op.drop_index("idx_promo_codes_code", table_name="promo_codes")
    op.drop_index("idx_promo_codes_event_id", table_name="promo_codes")
    op.drop_table("promo_codes")
    op.execute("DROP TYPE discount_type_enum")
