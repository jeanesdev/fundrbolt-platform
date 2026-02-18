"""make_user_import_npo_nullable

Revision ID: 0f1e2d3c4b5a
Revises: f9a0b1c2d3e4
Create Date: 2026-02-17 00:00:00.000000

"""

from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "0f1e2d3c4b5a"
down_revision = "f9a0b1c2d3e4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "user_import_batches",
        "npo_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "user_import_batches",
        "npo_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False,
    )
