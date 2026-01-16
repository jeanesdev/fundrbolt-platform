"""create_promo_code_applications_table

Revision ID: a081d79a05cc
Revises: 72f1de25e0a6
Create Date: 2026-01-06 22:19:23.745763

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "a081d79a05cc"
down_revision = "72f1de25e0a6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create promo_code_applications table (depends on ticket_purchases which is created later)
    op.create_table(
        "promo_code_applications",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "promo_code_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("promo_codes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "ticket_purchase_id", postgresql.UUID(as_uuid=True), nullable=False
        ),  # FK added later
        sa.Column("discount_amount", sa.Numeric(10, 2), nullable=False),
        sa.Column(
            "applied_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint("discount_amount >= 0", name="check_discount_amount_positive"),
    )

    # Create indexes
    op.create_index("idx_promo_applications_promo_id", "promo_code_applications", ["promo_code_id"])
    op.create_index(
        "idx_promo_applications_purchase_id", "promo_code_applications", ["ticket_purchase_id"]
    )


def downgrade() -> None:
    op.drop_index("idx_promo_applications_purchase_id", table_name="promo_code_applications")
    op.drop_index("idx_promo_applications_promo_id", table_name="promo_code_applications")
    op.drop_table("promo_code_applications")
