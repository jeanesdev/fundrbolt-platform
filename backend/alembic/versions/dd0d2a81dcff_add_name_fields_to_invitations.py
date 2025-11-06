"""add_name_fields_to_invitations

Revision ID: dd0d2a81dcff
Revises: 011
Create Date: 2025-11-05 09:23:44.486167

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "dd0d2a81dcff"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add optional first_name and last_name fields to invitations table
    op.add_column("invitations", sa.Column("first_name", sa.String(length=100), nullable=True))
    op.add_column("invitations", sa.Column("last_name", sa.String(length=100), nullable=True))


def downgrade() -> None:
    # Remove first_name and last_name fields
    op.drop_column("invitations", "last_name")
    op.drop_column("invitations", "first_name")
