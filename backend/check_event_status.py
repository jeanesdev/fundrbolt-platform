"""Check event status in database."""

import asyncio

from sqlalchemy import select

from app.core.database import get_db
from app.models.event import Event


async def main():
    """Check events matching the slug pattern."""
    async for db in get_db():
        result = await db.execute(
            select(Event.slug, Event.name, Event.status).where(
                Event.slug.like("%christmas%") | Event.slug.like("%gala%")
            )
        )
        events = result.all()
        if events:
            print("Events found:")
            for event in events:
                print(f"  Slug: {event[0]}")
                print(f"  Name: {event[1]}")
                print(f"  Status: {event[2]}")
                print()
        else:
            print("No matching events found")
        break


if __name__ == "__main__":
    asyncio.run(main())
