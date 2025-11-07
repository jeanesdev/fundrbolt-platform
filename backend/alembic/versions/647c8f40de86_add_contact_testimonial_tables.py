"""add_contact_testimonial_tables

Revision ID: 647c8f40de86
Revises: dd0d2a81dcff
Create Date: 2025-11-06 17:27:30.093905

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "647c8f40de86"
down_revision = "dd0d2a81dcff"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create contact_submissions table
    op.create_table(
        "contact_submissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("sender_name", sa.String(100), nullable=False),
        sa.Column("sender_email", sa.String(255), nullable=False),
        sa.Column("subject", sa.String(200), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("ip_address", sa.String(45), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # Create indexes for contact_submissions
    op.create_index(
        "idx_contact_submissions_ip_created",
        "contact_submissions",
        ["ip_address", "created_at"],
    )
    op.create_index("idx_contact_submissions_status", "contact_submissions", ["status"])
    op.create_index(
        "idx_contact_submissions_created_at",
        "contact_submissions",
        [sa.text("created_at DESC")],
    )

    # Create testimonials table
    op.create_table(
        "testimonials",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("quote_text", sa.String(500), nullable=False),
        sa.Column("author_name", sa.String(100), nullable=False),
        sa.Column("author_role", sa.String(50), nullable=False),
        sa.Column("organization_name", sa.String(200), nullable=True),
        sa.Column("photo_url", sa.String(500), nullable=True),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
    )

    # Create indexes for testimonials
    op.create_index(
        "idx_testimonials_published_order",
        "testimonials",
        ["is_published", "display_order"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "idx_testimonials_role",
        "testimonials",
        ["author_role"],
        postgresql_where=sa.text("deleted_at IS NULL AND is_published = true"),
    )
    op.create_index("idx_testimonials_created_by", "testimonials", ["created_by"])


def downgrade() -> None:
    op.drop_index("idx_testimonials_created_by")
    op.drop_index("idx_testimonials_role")
    op.drop_index("idx_testimonials_published_order")
    op.drop_table("testimonials")

    op.drop_index("idx_contact_submissions_created_at")
    op.drop_index("idx_contact_submissions_status")
    op.drop_index("idx_contact_submissions_ip_created")
    op.drop_table("contact_submissions")
