"""
Seed script to add guests to the Connect and Celebrate Gala 2026 event.

This script:
1. Finds the event by name
2. Gets existing registrations
3. Adds guests to those registrations
4. Optionally adds meal selections for guests
"""

import asyncio
import sys
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import AsyncSessionLocal
from app.models.event import Event
from app.models.event_registration import EventRegistration
from app.models.meal_selection import MealSelection
from app.models.registration_guest import RegistrationGuest
from app.models.user import User

# Guest data to seed
GUEST_DATA = [
    {
        "name": "Sarah Thompson",
        "email": "sarah.thompson@example.com",
        "phone": "+1(555)123-4567",
    },
    {
        "name": "Michael Chen",
        "email": "michael.chen@example.com",
        "phone": "+1(555)234-5678",
    },
    {
        "name": "Emily Rodriguez",
        "email": "emily.rodriguez@example.com",
        "phone": "+1(555)345-6789",
    },
    {
        "name": "David Kim",
        "email": "david.kim@example.com",
        "phone": "+1(555)456-7890",
    },
    {
        "name": "Jessica Martinez",
        "email": "jessica.martinez@example.com",
        "phone": "+1(555)567-8901",
    },
    {
        "name": "Christopher Lee",
        "email": "christopher.lee@example.com",
        "phone": "+1(555)678-9012",
    },
    {
        "name": "Amanda Johnson",
        "email": "amanda.johnson@example.com",
        "phone": "+1(555)789-0123",
    },
    {
        "name": "Daniel Brown",
        "email": "daniel.brown@example.com",
        "phone": "+1(555)890-1234",
    },
    {
        "name": "Olivia Davis",
        "email": "olivia.davis@example.com",
        "phone": "+1(555)901-2345",
    },
    {
        "name": "Ryan Wilson",
        "email": "ryan.wilson@example.com",
        "phone": "+1(555)012-3456",
    },
    {
        "name": "Sophia Anderson",
        "email": "sophia.anderson@example.com",
        "phone": "+1(555)123-5678",
    },
    {
        "name": "Matthew Taylor",
        "email": "matthew.taylor@example.com",
        "phone": "+1(555)234-6789",
    },
]


async def seed_guests(db: AsyncSession) -> None:
    """Seed guests for Connect and Celebrate Gala 2026."""

    # Find the event
    print("🔍 Finding Connect and Celebrate Gala 2026...")
    event_result = await db.execute(
        select(Event)
        .where(Event.name.ilike("%Connect and Celebrate Gala 2026%"))
        .options(selectinload(Event.food_options))
    )
    event = event_result.scalar_one_or_none()

    if not event:
        print("❌ Event not found!")
        return

    print(f"✅ Found event: {event.name} (ID: {event.id})")

    # Get food options for meal selections
    food_options = list(event.food_options)
    print(f"🍽️  Found {len(food_options)} food options:")
    for option in food_options:
        print(f"   - {option.name}")

    # Get existing registrations
    print("\n🔍 Finding existing registrations...")
    reg_result = await db.execute(
        select(EventRegistration)
        .where(EventRegistration.event_id == event.id)
        .options(
            selectinload(EventRegistration.user),
            selectinload(EventRegistration.guests),
        )
    )
    registrations = list(reg_result.scalars().all())

    if not registrations:
        print("⚠️  No registrations found! Creating demo registrations...")

        # Get some users to create registrations
        users_result = await db.execute(select(User).limit(3))
        users = list(users_result.scalars().all())

        if not users:
            print("❌ No users found! Please create users first.")
            return

        # Create registrations for those users
        for user in users:
            registration = EventRegistration(
                user_id=user.id,
                event_id=event.id,
                status="confirmed",
                number_of_guests=4,  # Will add 3 guests per registration
            )
            db.add(registration)

        await db.flush()

        # Re-fetch registrations
        reg_result = await db.execute(
            select(EventRegistration)
            .where(EventRegistration.event_id == event.id)
            .options(
                selectinload(EventRegistration.user),
                selectinload(EventRegistration.guests),
            )
        )
        registrations = list(reg_result.scalars().all())
        print(f"✅ Created {len(registrations)} registrations")

    print(f"✅ Found {len(registrations)} registrations:")
    for reg in registrations:
        print(
            f"   - {reg.user.first_name} {reg.user.last_name} ({len(reg.guests)} existing guests)"
        )

    # Distribute guests across registrations
    print(f"\n👥 Adding {len(GUEST_DATA)} guests...")
    guests_per_registration = len(GUEST_DATA) // len(registrations)
    remaining_guests = len(GUEST_DATA) % len(registrations)

    guest_index = 0
    created_count = 0

    for reg_idx, registration in enumerate(registrations):
        # Calculate how many guests for this registration
        num_guests = guests_per_registration
        if reg_idx < remaining_guests:
            num_guests += 1

        print(
            f"\n   Adding {num_guests} guests to {registration.user.first_name} {registration.user.last_name}'s registration:"
        )

        for _ in range(num_guests):
            if guest_index >= len(GUEST_DATA):
                break

            guest_data = GUEST_DATA[guest_index]

            # Check if guest already exists by email
            existing_guest_result = await db.execute(
                select(RegistrationGuest).where(
                    RegistrationGuest.registration_id == registration.id,
                    RegistrationGuest.email == guest_data["email"],
                )
            )
            existing_guest = existing_guest_result.scalar_one_or_none()

            if existing_guest:
                print(f"      ⏭️  {guest_data['name']} already exists (skipping)")
                guest_index += 1
                continue

            # Create guest
            guest = RegistrationGuest(
                registration_id=registration.id,
                name=guest_data["name"],
                email=guest_data["email"],
                phone=guest_data["phone"],
                invited_by_admin=False,
                invitation_sent_at=None,
            )
            db.add(guest)
            await db.flush()  # Flush to get the guest ID

            # Add meal selection if food options exist
            if food_options:
                # Rotate through food options
                food_option = food_options[created_count % len(food_options)]

                meal_selection = MealSelection(
                    registration_id=registration.id,
                    guest_id=guest.id,
                    food_option_id=food_option.id,
                )
                db.add(meal_selection)

            print(f"      ✅ {guest_data['name']} ({guest_data['email']})")
            if food_options:
                print(f"         Meal: {food_option.name}")

            created_count += 1
            guest_index += 1

    # Commit all changes
    await db.commit()

    print(f"\n✅ Successfully created {created_count} guests!")
    print("🍽️  Assigned meal selections to all guests")


async def main():
    """Main function."""
    async with AsyncSessionLocal() as db:
        try:
            await seed_guests(db)
        except Exception as e:
            print(f"❌ Error: {e}")
            import traceback

            traceback.print_exc()
            await db.rollback()
            raise


if __name__ == "__main__":
    print("=" * 60)
    print("Seeding Guests for Connect and Celebrate Gala 2026")
    print("=" * 60)
    asyncio.run(main())
    print("=" * 60)
    print("Done!")
    print("=" * 60)
