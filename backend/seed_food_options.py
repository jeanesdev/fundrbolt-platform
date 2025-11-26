"""Seed script for event food options test data.

This script creates sample food options for existing events to support
meal selection testing in the donor PWA.

Usage:
    cd backend && poetry run python seed_food_options.py
"""

import asyncio
import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_connection
from app.models.event import Event, FoodOption


async def seed_food_options():
    """Create food options for all active events without food options."""
    print("🍽️  Starting food options seed...")

    # Get database connection
    conn = await get_db_connection()

    try:
        async with AsyncSession(conn, expire_on_commit=False) as session:
            # Find events that don't have food options yet
            stmt = (
                select(Event)
                .outerjoin(FoodOption, Event.id == FoodOption.event_id)
                .where(FoodOption.id.is_(None))  # No food options yet
            )
            result = await session.execute(stmt)
            events_without_food = result.scalars().all()

            if not events_without_food:
                print("✅ All events already have food options!")
                return

            print(f"📋 Found {len(events_without_food)} events without food options")

            # Standard food options to add to each event
            food_options_data = [
                {
                    "name": "Chicken Parmesan",
                    "description": "Breaded chicken breast with marinara sauce and melted mozzarella, served with pasta",
                    "display_order": 1,
                },
                {
                    "name": "Grilled Salmon",
                    "description": "Atlantic salmon fillet grilled to perfection, served with roasted vegetables and rice pilaf",
                    "display_order": 2,
                },
                {
                    "name": "Vegetarian Pasta Primavera",
                    "description": "Penne pasta with fresh seasonal vegetables in a light garlic cream sauce",
                    "display_order": 3,
                },
                {
                    "name": "Caesar Salad (Vegan)",
                    "description": "Crisp romaine lettuce with vegan Caesar dressing, croutons, and chickpeas",
                    "display_order": 4,
                },
            ]

            # Add food options to each event
            total_created = 0
            for event in events_without_food:
                print(f"  📝 Adding food options to: {event.name}")

                for option_data in food_options_data:
                    food_option = FoodOption(
                        id=uuid.uuid4(),
                        event_id=event.id,
                        name=option_data["name"],
                        description=option_data["description"],
                        display_order=option_data["display_order"],
                        created_at=datetime.utcnow(),
                        updated_at=datetime.utcnow(),
                    )
                    session.add(food_option)
                    total_created += 1

            # Commit all food options
            await session.commit()

            print(
                f"✅ Successfully created {total_created} food options across {len(events_without_food)} events!"
            )
            print("")
            print("Food options added:")
            for option in food_options_data:
                print(f"  • {option['name']}: {option['description']}")

    except Exception as e:
        print(f"❌ Error seeding food options: {e}")
        raise
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed_food_options())
