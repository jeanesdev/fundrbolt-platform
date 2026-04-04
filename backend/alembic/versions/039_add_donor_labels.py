"""Add donor labels tables

Revision ID: 039_add_donor_labels
Revises: 038_add_event_hashtag
Create Date: 2026-04-03
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "039_add_donor_labels"
down_revision = "038_add_event_hashtag"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "donor_labels",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("npo_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("color", sa.String(7), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["npo_id"], ["npos.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_donor_labels_npo_id", "donor_labels", ["npo_id"])

    op.create_table(
        "donor_label_assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("label_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["label_id"], ["donor_labels.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "label_id", name="uq_donor_label_assignments_pair"),
    )
    op.create_index("ix_donor_label_assignments_user_id", "donor_label_assignments", ["user_id"])
    op.create_index("ix_donor_label_assignments_label_id", "donor_label_assignments", ["label_id"])


def downgrade() -> None:
    op.drop_table("donor_label_assignments")
    op.drop_table("donor_labels")
