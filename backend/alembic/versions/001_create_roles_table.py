"""create roles table

Revision ID: 001
Revises:
Create Date: 2025-01-19

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create roles table and seed initial data."""
    # Create roles table
    op.create_table(
        "roles",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("name", sa.String(50), unique=True, nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("scope", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("NOW()"),
            onupdate=sa.text("NOW()"),
        ),
        sa.CheckConstraint(
            "name IN ('super_admin', 'npo_admin', 'event_coordinator', 'staff', 'donor')",
            name="role_name_valid",
        ),
        sa.CheckConstraint(
            "scope IN ('platform', 'npo', 'event', 'own')",
            name="role_scope_valid",
        ),
    )

    # Create unique index on name
    op.create_index("idx_roles_name", "roles", ["name"], unique=True)

    # Seed roles
    op.execute(
        """
        INSERT INTO roles (name, description, scope) VALUES
            ('super_admin',
             'Fundrbolt platform staff with full access to all NPOs and events',
             'platform'),
            ('npo_admin',
             'Full management access within assigned nonprofit organization(s)',
             'npo'),
            ('event_coordinator', 'Event and auction management within assigned NPO', 'npo'),
            ('staff', 'Donor registration and check-in within assigned events', 'event'),
            ('donor', 'Bidding and profile management only', 'own')
        """
    )


def downgrade() -> None:
    """Drop roles table."""
    op.drop_index("idx_roles_name", table_name="roles")
    op.drop_table("roles")
