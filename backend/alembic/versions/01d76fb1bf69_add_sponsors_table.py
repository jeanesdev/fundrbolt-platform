"""add_sponsors_table

Revision ID: 01d76fb1bf69
Revises: 8202f93bb2fb
Create Date: 2025-11-12 08:40:50.031706

"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

# revision identifiers, used by Alembic.
revision = "01d76fb1bf69"
down_revision = "8202f93bb2fb"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create sponsors table with all fields, indexes, and constraints."""
    op.create_table(
        "sponsors",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("event_id", UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("logo_url", sa.String(length=500), nullable=False),
        sa.Column("logo_blob_name", sa.String(length=500), nullable=False),
        sa.Column("thumbnail_url", sa.String(length=500), nullable=False),
        sa.Column("thumbnail_blob_name", sa.String(length=500), nullable=False),
        sa.Column("website_url", sa.String(length=500), nullable=True),
        sa.Column("logo_size", sa.String(length=20), nullable=False, server_default="large"),
        sa.Column("sponsor_level", sa.String(length=100), nullable=True),
        sa.Column("contact_name", sa.String(length=200), nullable=True),
        sa.Column("contact_email", sa.String(length=200), nullable=True),
        sa.Column("contact_phone", sa.String(length=20), nullable=True),
        sa.Column("address_line1", sa.String(length=200), nullable=True),
        sa.Column("address_line2", sa.String(length=200), nullable=True),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("state", sa.String(length=100), nullable=True),
        sa.Column("postal_code", sa.String(length=20), nullable=True),
        sa.Column("country", sa.String(length=100), nullable=True),
        sa.Column("donation_amount", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column("created_by", UUID(as_uuid=True), nullable=False),
        # Foreign keys
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        # Constraints
        sa.UniqueConstraint("event_id", "name", name="uq_sponsor_name_per_event"),
        sa.CheckConstraint("donation_amount >= 0", name="ck_donation_nonnegative"),
        sa.CheckConstraint("display_order >= 0", name="ck_display_order_nonnegative"),
        sa.CheckConstraint(
            "logo_size IN ('xsmall', 'small', 'medium', 'large', 'xlarge')",
            name="ck_logo_size_enum",
        ),
    )

    # Create indexes
    op.create_index("idx_sponsors_event_id", "sponsors", ["event_id"])
    op.create_index("idx_sponsors_display_order", "sponsors", ["event_id", "display_order"])
    op.create_index("idx_sponsors_created_by", "sponsors", ["created_by"])


def downgrade() -> None:
    """Drop sponsors table and all associated indexes."""
    op.drop_index("idx_sponsors_created_by", table_name="sponsors")
    op.drop_index("idx_sponsors_display_order", table_name="sponsors")
    op.drop_index("idx_sponsors_event_id", table_name="sponsors")
    op.drop_table("sponsors")
