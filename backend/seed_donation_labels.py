"""Seed default donation labels for events.

Usage:
    cd backend && poetry run python seed_donation_labels.py
"""

import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_connection
from app.models.donation_label import DonationLabel
from app.models.event import Event

DEFAULT_LABELS = ["Last Hero", "Coin Toss"]


async def seed_donation_labels() -> None:
    """Create default donation labels for all events when missing."""
    conn = await get_db_connection()
    created_count = 0
    try:
        async with AsyncSession(conn, expire_on_commit=False) as session:
            events = (await session.execute(select(Event.id))).scalars().all()
            for event_id in events:
                existing_names = set(
                    (
                        await session.execute(
                            select(DonationLabel.name).where(DonationLabel.event_id == event_id)
                        )
                    )
                    .scalars()
                    .all()
                )
                for label_name in DEFAULT_LABELS:
                    if label_name not in existing_names:
                        session.add(
                            DonationLabel(
                                event_id=event_id,
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
