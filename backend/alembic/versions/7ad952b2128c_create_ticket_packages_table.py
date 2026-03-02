"""create_ticket_packages_table

Revision ID: 7ad952b2128c
Revises: ac89c13f550c
Create Date: 2026-01-06 22:15:36.097470

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "7ad952b2128c"
down_revision = "ac89c13f550c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create ticket_packages table
    op.create_table(
        "ticket_packages",
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
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column("seats_per_package", sa.Integer(), nullable=False),
        sa.Column("quantity_limit", sa.Integer(), nullable=True),
        sa.Column("sold_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("image_url", sa.String(500), nullable=True),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default="true"),
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
        sa.CheckConstraint("price >= 0", name="check_ticket_package_price_positive"),
        sa.CheckConstraint(
            "seats_per_package >= 1 AND seats_per_package <= 100",
            name="check_seats_per_package_range",
        ),
        sa.CheckConstraint(
            "quantity_limit IS NULL OR quantity_limit >= sold_count",
            name="check_quantity_limit_vs_sold",
        ),
        sa.CheckConstraint("sold_count >= 0", name="check_sold_count_positive"),
        sa.UniqueConstraint(
            "event_id", "display_order", name="uq_ticket_package_event_display_order"
        ),
    )

    # Create indexes
    op.create_index("idx_ticket_packages_event_id", "ticket_packages", ["event_id"])
    op.create_index(
        "idx_ticket_packages_display_order", "ticket_packages", ["event_id", "display_order"]
    )


def downgrade() -> None:
    op.drop_index("idx_ticket_packages_display_order", table_name="ticket_packages")
    op.drop_index("idx_ticket_packages_event_id", table_name="ticket_packages")
    op.drop_table("ticket_packages")
