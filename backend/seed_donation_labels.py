"""Seed default global donation labels.

Usage:
    cd backend && poetry run python seed_donation_labels.py
"""

import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_connection
from app.models.donation_label import DonationLabel

DEFAULT_LABELS = ["Last Leader", "Head or Tails", "Table Raise"]


async def seed_donation_labels() -> None:
    """Create default global donation labels when missing."""
    conn = await get_db_connection()
    created_count = 0
    try:
        async with AsyncSession(conn, expire_on_commit=False) as session:
            existing_names = {
                name.casefold()
                for name in (
                    await session.execute(
                        select(DonationLabel.name).where(DonationLabel.is_active.is_(True))
                    )
                )
                .scalars()
                .all()
            }

            for label_name in DEFAULT_LABELS:
                if label_name.casefold() in existing_names:
                    continue
                session.add(
                    DonationLabel(
                        event_id=None,
                        name=label_name,
                        is_active=True,
                    )
                )
                created_count += 1
            await session.commit()
    finally:
        await conn.close()

    print(f"Created {created_count} donation labels")


if __name__ == "__main__":
    asyncio.run(seed_donation_labels())
