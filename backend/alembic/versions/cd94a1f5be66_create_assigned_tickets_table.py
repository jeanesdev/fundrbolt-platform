"""create_assigned_tickets_table

Revision ID: cd94a1f5be66
Revises: 66b5a902fd37
Create Date: 2026-01-06 22:19:25.222382

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "cd94a1f5be66"
down_revision = "66b5a902fd37"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create assigned_tickets table
    op.create_table(
        "assigned_tickets",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "ticket_purchase_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("ticket_purchases.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("ticket_number", sa.Integer(), nullable=False),
        sa.Column("qr_code", sa.String(255), nullable=False),
        sa.Column(
            "assigned_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("qr_code", name="uq_assigned_ticket_qr_code"),
    )

    # Create indexes
    op.create_index("idx_assigned_tickets_purchase_id", "assigned_tickets", ["ticket_purchase_id"])
    op.create_index("idx_assigned_tickets_qr_code", "assigned_tickets", ["qr_code"])


def downgrade() -> None:
    op.drop_index("idx_assigned_tickets_qr_code", table_name="assigned_tickets")
    op.drop_index("idx_assigned_tickets_purchase_id", table_name="assigned_tickets")
    op.drop_table("assigned_tickets")
