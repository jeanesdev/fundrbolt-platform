"""create_option_responses_table

Revision ID: f264ff29ec74
Revises: 1914067a6724
Create Date: 2026-01-06 22:19:20.905360

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "f264ff29ec74"
down_revision = "1914067a6724"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create option_responses table (depends on ticket_purchases which is created later)
    # This will be populated after ticket_purchases table is created
    op.create_table(
        "option_responses",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "ticket_purchase_id", postgresql.UUID(as_uuid=True), nullable=False
        ),  # FK added later
        sa.Column(
            "custom_option_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("custom_ticket_options.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("response_value", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # Create indexes
    op.create_index("idx_option_responses_purchase_id", "option_responses", ["ticket_purchase_id"])
    op.create_index("idx_option_responses_option_id", "option_responses", ["custom_option_id"])


def downgrade() -> None:
    op.drop_index("idx_option_responses_option_id", table_name="option_responses")
    op.drop_index("idx_option_responses_purchase_id", table_name="option_responses")
    op.drop_table("option_responses")
