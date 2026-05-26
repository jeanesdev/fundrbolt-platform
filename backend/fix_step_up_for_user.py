"""
One-off script: mark all social identity links for a user as step_up_verified
so they can log in via social auth without a password step-up.

Usage:
    cd backend
    poetry run python fix_step_up_for_user.py justin@fundrbolt.com
"""

import asyncio
import sys
from datetime import UTC, datetime

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.social_identity_link import SocialIdentityLink
from app.models.user import User


async def fix_step_up(email: str) -> None:
    async with AsyncSessionLocal() as db:
        # Find the user
        result = await db.execute(select(User).where(User.email == email.lower()))
        user = result.scalar_one_or_none()
        if not user:
            print(f"No user found with email: {email}")
            return

        print(
            f"Found user: {user.id} ({user.first_name} {user.last_name}), role={user.role.name if user.role else 'N/A'}"
        )
        print(
            f"  has_local_password={user.has_local_password}, must_change_password={user.must_change_password}"
        )

        # Find all social identity links
        links_result = await db.execute(
            select(SocialIdentityLink).where(
                SocialIdentityLink.user_id == user.id,
                SocialIdentityLink.is_active == True,  # noqa: E712
            )
        )
        links = links_result.scalars().all()

        if not links:
            print("No active social identity links found.")
            return

        for link in links:
            print(
                f"  Link: provider={link.provider_key}, step_up_verified_at={link.step_up_verified_at}"
            )
            if link.step_up_verified_at is None:
                link.step_up_verified_at = datetime.now(UTC)
                print("    -> Marked as step-up verified")
            else:
                print("    -> Already verified, skipping")

        await db.commit()
        print("Done.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: poetry run python fix_step_up_for_user.py <email>")
        sys.exit(1)
    asyncio.run(fix_step_up(sys.argv[1]))
