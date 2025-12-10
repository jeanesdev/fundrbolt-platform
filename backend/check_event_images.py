"""Check event image URLs in database."""

import asyncio

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.event import Event


async def main():
    """Check events and their image URLs."""
    async for db in get_db():
        result = await db.execute(
            select(Event)
            .options(selectinload(Event.media))
            .where(Event.slug == "chn-christmas-gala-2025-2")
        )
        event = result.scalar_one_or_none()

        if event:
            print(f"Event: {event.name}")
            print(f"Slug: {event.slug}")
            print(f"Status: {event.status}")

            print(f"\nLogo URL: {event.logo_url}")

            print(f"\nMedia Files ({len(event.media)} total):")
            if event.media:
                for media in event.media:
                    print(f"  - Type: {media.media_type}")
                    print(f"    File: {media.file_path}")
                    print(f"    URL: {media.file_url}")
                    print(f"    Display Order: {media.display_order}")
                    print(f"    Status: {media.scan_status}")
                    print()
            else:
                print("  No media files uploaded")

            print("\nBranding Colors:")
            print(f"  Primary: {event.primary_color}")
            print(f"  Secondary: {event.secondary_color}")
        else:
            print("Event not found")
        break


if __name__ == "__main__":
    asyncio.run(main())
