"""create_custom_ticket_options_table

Revision ID: 1914067a6724
Revises: 7ad952b2128c
Create Date: 2026-01-06 22:19:20.213495

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "1914067a6724"
down_revision = "7ad952b2128c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enum type for option_type
    op.execute("""
        CREATE TYPE option_type_enum AS ENUM ('boolean', 'multi_select', 'text_input')
    """)

    # Create custom_ticket_options table
    op.create_table(
        "custom_ticket_options",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "ticket_package_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("ticket_packages.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("option_label", sa.String(200), nullable=False),
        sa.Column(
            "option_type",
            postgresql.ENUM(
                "boolean", "multi_select", "text_input", name="option_type_enum", create_type=False
            ),
            nullable=False,
        ),
        sa.Column("choices", postgresql.JSONB(), nullable=True),
        sa.Column("is_required", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "option_type IN ('boolean', 'text_input') OR (option_type = 'multi_select' AND choices IS NOT NULL)",
            name="check_multi_select_has_choices",
        ),
    )

    # Create indexes
    op.create_index(
        "idx_custom_ticket_options_package_id", "custom_ticket_options", ["ticket_package_id"]
    )
    op.create_index(
        "idx_custom_ticket_options_display_order",
        "custom_ticket_options",
        ["ticket_package_id", "display_order"],
    )


def downgrade() -> None:
    op.drop_index("idx_custom_ticket_options_display_order", table_name="custom_ticket_options")
    op.drop_index("idx_custom_ticket_options_package_id", table_name="custom_ticket_options")
    op.drop_table("custom_ticket_options")
    op.execute("DROP TYPE option_type_enum")
