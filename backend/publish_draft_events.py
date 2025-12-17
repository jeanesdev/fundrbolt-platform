"""Publish draft events to make them active."""

import asyncio

from sqlalchemy import select, update

from app.core.database import get_db
from app.models.event import Event, EventStatus


async def main():
    """Publish events with DRAFT status."""
    async for db in get_db():
        # Find draft events
        result = await db.execute(
            select(Event.slug, Event.name, Event.status).where(Event.status == EventStatus.DRAFT)
        )
        events = result.all()

        if not events:
            print("No draft events found")
            break

        print(f"Found {len(events)} draft event(s):")
        for event in events:
            print(f"  - {event[1]} ({event[0]})")

        # Ask for confirmation
        response = input("\nPublish all draft events? (y/n): ")
        if response.lower() != "y":
            print("Cancelled")
            break

        # Update all draft events to ACTIVE
        await db.execute(
            update(Event).where(Event.status == EventStatus.DRAFT).values(status=EventStatus.ACTIVE)
        )
        await db.commit()

        print(f"\n✅ Successfully published {len(events)} event(s)")
        break


if __name__ == "__main__":
    asyncio.run(main())
