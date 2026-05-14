"""Fix admin credentials - upsert super admin with correct password

Revision ID: fix_admin_001
Revises: restore_user_addr_001
Create Date: 2025-05-14

This migration ensures the super admin user exists and has the correct
password from the SUPER_ADMIN_PASSWORD environment variable.

Unlike migration 004_seed_superadmin.py (which skips if the user exists),
this migration will UPDATE the password hash if the user already exists,
and CREATE the user if they don't.

This is a one-time fix for production environments where the seed migration
ran without SUPER_ADMIN_PASSWORD being set.
"""

import os
import uuid
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "fix_admin_001"
down_revision: str | None = "restore_user_addr_001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upsert super admin user with correct credentials."""
    from app.core.security import hash_password

    super_admin_email = os.getenv("SUPER_ADMIN_EMAIL", "admin@fundrbolt.com")
    super_admin_password = os.getenv("SUPER_ADMIN_PASSWORD", "")

    if not super_admin_password:
        print(
            "WARNING: SUPER_ADMIN_PASSWORD not set in environment. "
            "Skipping admin credential fix."
        )
        return

    conn = op.get_bind()

    # Check if user already exists
    result = conn.execute(
        sa.text("SELECT id FROM users WHERE email = :email"),
        {"email": super_admin_email},
    )
    existing_user = result.fetchone()

    password_hash = hash_password(super_admin_password)

    if existing_user:
        # User exists — update password hash and ensure active + verified
        conn.execute(
            sa.text(
                """
                UPDATE users
                SET password_hash = :hash,
                    is_active = TRUE,
                    email_verified = TRUE
                WHERE email = :email
                """
            ),
            {"hash": password_hash, "email": super_admin_email},
        )
        print(f"✅ Super admin password updated for: {super_admin_email}")
    else:
        # User doesn't exist — create it
        result = conn.execute(
            sa.text("SELECT id FROM roles WHERE name = 'super_admin'"),
        )
        role_row = result.fetchone()

        if not role_row:
            print("ERROR: super_admin role not found in roles table.")
            print("Please ensure migration 001 has been run.")
            return

        super_admin_id = uuid.uuid4()
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
                "first_name": "Super",
                "last_name": "Admin",
                "email_verified": True,
                "is_active": True,
                "role_id": role_row[0],
            },
        )
        print(f"✅ Super admin user created: {super_admin_email}")
        print("   Name: Super Admin")
        print("   Role: super_admin")
        print("   Email verified: True")
        print("   Status: Active")


def downgrade() -> None:
    """No-op: do not remove admin user on downgrade."""
    pass
