"""seed super admin user

Revision ID: 004
Revises: 003
Create Date: 2025-10-24

"""

import os
import uuid
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "004"
down_revision: str | None = "003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Seed super admin user from environment variables."""
    # Import hash_password here to avoid circular imports
    from app.core.security import hash_password

    # Get super admin credentials from environment
    super_admin_email = os.getenv("SUPER_ADMIN_EMAIL", "admin@fundrbolt.com")
    super_admin_password = os.getenv("SUPER_ADMIN_PASSWORD", "")
    super_admin_first_name = os.getenv("SUPER_ADMIN_FIRST_NAME", "Super")
    super_admin_last_name = os.getenv("SUPER_ADMIN_LAST_NAME", "Admin")

    if not super_admin_password:
        print(
            "WARNING: SUPER_ADMIN_PASSWORD not set in environment. "
            "Super admin user will not be created."
        )
        return

    # Check if super admin already exists
    conn = op.get_bind()
    result = conn.execute(
        sa.text("SELECT id FROM users WHERE email = :email"),
        {"email": super_admin_email},
    )
    existing_user = result.fetchone()

    if existing_user:
        print(f"Super admin user '{super_admin_email}' already exists. Skipping.")
        return

    # Get super_admin role ID
    result = conn.execute(
        sa.text("SELECT id FROM roles WHERE name = 'super_admin'"),
    )
    role_row = result.fetchone()

    if not role_row:
        print("ERROR: super_admin role not found in roles table.")
        print("Please ensure migration 001 has been run.")
        return

    super_admin_role_id = role_row[0]

    # Hash the password
    password_hash = hash_password(super_admin_password)

    # Generate UUID for super admin
    super_admin_id = uuid.uuid4()

    # Insert super admin user
    conn.execute(
        sa.text(
            """
            INSERT INTO users (
                id, email, password_hash, first_name, last_name,
                email_verified, is_active, role_id
            )
            VALUES (
                :id, :email, :password_hash, :first_name, :last_name,
                :email_verified, :is_active, :role_id
            )
        """
        ),
        {
            "id": super_admin_id,
            "email": super_admin_email,
            "password_hash": password_hash,
            "first_name": super_admin_first_name,
            "last_name": super_admin_last_name,
            "email_verified": True,  # Super admin is pre-verified
            "is_active": True,  # Super admin is active immediately
            "role_id": super_admin_role_id,
        },
    )

    print(f"✅ Super admin user created successfully: {super_admin_email}")
    print(f"   Name: {super_admin_first_name} {super_admin_last_name}")
    print("   Role: super_admin")
    print("   Email verified: True")
    print("   Status: Active")


def downgrade() -> None:
    """Remove super admin user."""
    # Get super admin email from environment (or use default)
    super_admin_email = os.getenv("SUPER_ADMIN_EMAIL", "admin@fundrbolt.com")

    # Delete super admin user
    conn = op.get_bind()
    conn.execute(
        sa.text("DELETE FROM users WHERE email = :email"),
        {"email": super_admin_email},
    )

    print(f"Super admin user '{super_admin_email}' removed.")
