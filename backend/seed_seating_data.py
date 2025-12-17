# type: ignore
"""
Seed demo seating data for testing and development.

This script creates:
- 1 demo event with seating configured (10 tables, 8 guests per table)
- 30 registered guests (mix of donors and accompanying guests)
- Auto-assigned bidder numbers
- Mixed table assignments (some assigned, some unassigned)

Usage:
    poetry run python seed_seating_data.py
"""

import asyncio
import random
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.event import Event, EventStatus
from app.models.event_registration import EventRegistration
from app.models.npo import NPO, NPOStatus
from app.models.registration_guest import RegistrationGuest
from app.models.user import User


async def get_or_create_demo_npo(db: AsyncSession) -> NPO:
    """Get existing demo NPO or create one."""
    stmt = select(NPO).where(NPO.email == "demo@augeo.app")
    result = await db.execute(stmt)
    npo = result.scalar_one_or_none()

    if npo:
        print(f"✓ Using existing demo NPO: {npo.name}")
        return npo

    print("Creating demo NPO...")
    npo = NPO(
        id=uuid4(),
        name="Demo Charity Organization",
        description="Demo NPO for seating assignment testing",
        email="demo@augeo.app",
        phone="+1 (555) 999-0000",
        address={
            "street": "123 Demo St",
            "city": "Demo City",
            "state": "CA",
            "postal_code": "90001",
            "country": "USA",
        },
        tax_id="99-9999999",
        registration_number="NPO-DEMO",
        website_url="https://demo.augeo.app",
        status=NPOStatus.APPROVED,
        approved_at=datetime.now(UTC),
    )
    db.add(npo)
    await db.commit()
    await db.refresh(npo)
    print(f"✓ Created demo NPO: {npo.name}")
    return npo


async def get_or_create_demo_event(db: AsyncSession, npo_id: UUID) -> Event:
    """Get existing demo event or create one."""
    stmt = select(Event).where(Event.name == "Demo Gala 2025")
    result = await db.execute(stmt)
    event = result.scalar_one_or_none()

    if event:
        print(f"✓ Using existing demo event: {event.name}")
        return event

    print("Creating demo event...")
    event = Event(
        id=uuid4(),
        npo_id=npo_id,
        name="Demo Gala 2025",
        slug="demo-gala-2025",
        event_datetime=datetime.now(UTC) + timedelta(days=30),
        timezone="America/Los_Angeles",
        venue_name="Grand Ballroom",
        venue_address="456 Event Blvd, Demo City, CA 90001",
        description="Demo fundraising gala with seating assignments",
        status=EventStatus.PUBLISHED,
        primary_color="#1E40AF",
        secondary_color="#3B82F6",
        # Configure seating: 10 tables, 8 guests per table = 80 capacity
        table_count=10,
        max_guests_per_table=8,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    print(f"✓ Created demo event: {event.name} (10 tables × 8 guests = 80 capacity)")
    return event


async def create_demo_users(db: AsyncSession, count: int = 20) -> list[User]:
    """Create demo donor users."""
    print(f"Creating {count} demo donor users...")
    users = []

    first_names = [
        "Alice",
        "Bob",
        "Carol",
        "David",
        "Emma",
        "Frank",
        "Grace",
        "Henry",
        "Iris",
        "Jack",
        "Kate",
        "Leo",
        "Maria",
        "Noah",
        "Olivia",
        "Paul",
        "Quinn",
        "Rachel",
        "Sam",
        "Tina",
        "Uma",
        "Victor",
        "Wendy",
        "Xavier",
        "Yara",
        "Zack",
        "Amy",
        "Ben",
        "Claire",
        "Dan",
    ]
    last_names = [
        "Anderson",
        "Brown",
        "Chen",
        "Davis",
        "Evans",
        "Foster",
        "Garcia",
        "Harris",
        "Ivanov",
        "Johnson",
        "Kim",
        "Lee",
        "Martinez",
        "Nelson",
        "O'Brien",
        "Patel",
        "Quinn",
        "Rodriguez",
        "Smith",
        "Taylor",
        "Underwood",
        "Vasquez",
        "Wilson",
        "Xavier",
        "Young",
        "Zhang",
    ]

    password_hash = hash_password("Demo123!")

    for i in range(count):
        first_name = random.choice(first_names)
        last_name = random.choice(last_names)
        email = f"{first_name.lower()}.{last_name.lower()}{i}@demo.example.com"

        # Check if user already exists
        stmt = select(User).where(User.email == email)
        result = await db.execute(stmt)
        existing_user = result.scalar_one_or_none()

        if existing_user:
            users.append(existing_user)
            continue

        user = User(
            id=uuid4(),
            email=email,
            first_name=first_name,
            last_name=last_name,
            password_hash=password_hash,
            role_name="donor",
            email_verified=True,
            profile_completed=True,
        )
        db.add(user)
        users.append(user)

    await db.commit()
    print(f"✓ Created {len(users)} demo users")
    return users


async def create_demo_registrations(
    db: AsyncSession,
    event: Event,
    users: list[User],
) -> list[EventRegistration]:
    """Create demo event registrations with guests."""
    print(f"Creating registrations for {len(users)} users...")
    registrations = []

    ticket_tiers = ["general_admission", "vip", "premium"]
    prices = {"general_admission": 10000, "vip": 25000, "premium": 50000}  # cents

    for user in users:
        # Check if registration already exists
        stmt = select(EventRegistration).where(
            EventRegistration.event_id == event.id,
            EventRegistration.user_id == user.id,
        )
        result = await db.execute(stmt)
        existing_reg = result.scalar_one_or_none()

        if existing_reg:
            registrations.append(existing_reg)
            continue

        tier = random.choice(ticket_tiers)

        registration = EventRegistration(
            id=uuid4(),
            event_id=event.id,
            user_id=user.id,
            status="confirmed",
            ticket_tier=tier,
            total_amount_cents=prices[tier],
            currency="USD",
        )
        db.add(registration)
        registrations.append(registration)

        # 30% chance to add 1-2 accompanying guests
        if random.random() < 0.3:
            num_guests = random.randint(1, 2)
            for g in range(num_guests):
                guest = RegistrationGuest(
                    id=uuid4(),
                    registration_id=registration.id,
                    name=f"Guest {g + 1} of {user.first_name}",
                    email=f"guest{g + 1}.{user.email}",
                )
                db.add(guest)

    await db.commit()
    print(f"✓ Created {len(registrations)} registrations")
    return registrations


async def assign_bidder_numbers(
    db: AsyncSession,
    registrations: list[EventRegistration],
) -> None:
    """Auto-assign bidder numbers to all registrations."""
    print("Assigning bidder numbers...")

    # Start from 100, assign sequentially
    next_bidder = 100

    for reg in registrations:
        if reg.bidder_number is None:
            reg.bidder_number = next_bidder
            reg.bidder_number_assigned_at = datetime.now(UTC)
            next_bidder += 1

    await db.commit()
    print(f"✓ Assigned bidder numbers 100-{next_bidder - 1}")


async def assign_tables_mixed(
    db: AsyncSession,
    event: Event,
    registrations: list[EventRegistration],
) -> None:
    """Assign tables to some registrations (leave some unassigned for demo)."""
    print("Assigning tables (mixed assignments)...")

    # Assign 70% of registrations to tables, leave 30% unassigned
    num_to_assign = int(len(registrations) * 0.7)
    regs_to_assign = random.sample(registrations, num_to_assign)

    # Get all guests for each registration (primary + accompanying)
    for reg in regs_to_assign:
        # Get guest count (1 for primary + accompanying guests)
        stmt = select(RegistrationGuest).where(RegistrationGuest.registration_id == reg.id)
        result = await db.execute(stmt)
        accompanying_guests = result.scalars().all()
        party_size = 1 + len(accompanying_guests)

        # Find a table with enough space
        assigned = False
        for table_num in range(1, event.table_count + 1):
            # Count current occupancy
            stmt = select(EventRegistration).where(
                EventRegistration.event_id == event.id,
                EventRegistration.table_number == table_num,
            )
            result = await db.execute(stmt)
            table_regs = result.scalars().all()

            current_count = 0
            for table_reg in table_regs:
                stmt = select(RegistrationGuest).where(
                    RegistrationGuest.registration_id == table_reg.id
                )
                result = await db.execute(stmt)
                table_reg_guests = result.scalars().all()
                current_count += 1 + len(table_reg_guests)

            available_space = event.max_guests_per_table - current_count

            if available_space >= party_size:
                reg.table_number = table_num
                reg.table_assigned_at = datetime.now(UTC)
                assigned = True
                break

        if not assigned:
            # If no space found, assign to random table anyway (for demo)
            reg.table_number = random.randint(1, event.table_count)
            reg.table_assigned_at = datetime.now(UTC)

    await db.commit()

    assigned_count = sum(1 for r in registrations if r.table_number is not None)
    unassigned_count = len(registrations) - assigned_count
    print(f"✓ Assigned {assigned_count} registrations to tables")
    print(f"✓ Left {unassigned_count} registrations unassigned")


async def check_in_some_guests(
    db: AsyncSession,
    registrations: list[EventRegistration],
) -> None:
    """Check in 40% of guests (for bidder number visibility testing)."""
    print("Checking in some guests...")

    num_to_check_in = int(len(registrations) * 0.4)
    regs_to_check_in = random.sample(registrations, num_to_check_in)

    for reg in regs_to_check_in:
        reg.check_in_time = datetime.now(UTC)

    await db.commit()
    print(f"✓ Checked in {num_to_check_in} guests")


async def print_summary(db: AsyncSession, event: Event) -> None:
    """Print summary of seeded data."""
    stmt = select(EventRegistration).where(EventRegistration.event_id == event.id)
    result = await db.execute(stmt)
    registrations = result.scalars().all()

    total_guests = 0
    assigned_tables = 0
    checked_in = 0

    for reg in registrations:
        stmt = select(RegistrationGuest).where(RegistrationGuest.registration_id == reg.id)
        result = await db.execute(stmt)
        guests = result.scalars().all()
        total_guests += 1 + len(guests)

        if reg.table_number is not None:
            assigned_tables += 1
        if reg.check_in_time is not None:
            checked_in += 1

    print("\n" + "=" * 60)
    print("SEATING DATA SUMMARY")
    print("=" * 60)
    print(f"Event: {event.name}")
    print(f"Tables: {event.table_count} (capacity: {event.max_guests_per_table} each)")
    print(f"Total Capacity: {event.table_count * event.max_guests_per_table} guests")
    print(f"\nRegistrations: {len(registrations)}")
    print(f"Total Guests: {total_guests} (primary + accompanying)")
    print(f"Assigned to Tables: {assigned_tables} registrations")
    print(f"Unassigned: {len(registrations) - assigned_tables} registrations")
    print(f"Checked In: {checked_in} registrations")
    print(f"Bidder Numbers: 100-{99 + len(registrations)}")
    print("=" * 60)
    print("\nTest scenarios available:")
    print("  - Auto-assign remaining unassigned guests")
    print("  - Manual table assignment with capacity validation")
    print("  - Bidder number visibility (checked-in vs not)")
    print("  - Guest-of-primary indicator (accompanying guests)")
    print("  - Table occupancy view with mixed assignments")
    print("=" * 60 + "\n")


async def main():
    """Main seeding function."""
    print("\n" + "=" * 60)
    print("SEEDING DEMO SEATING DATA")
    print("=" * 60 + "\n")

    async with AsyncSessionLocal() as db:
        try:
            # 1. Get or create demo NPO
            npo = await get_or_create_demo_npo(db)

            # 2. Get or create demo event with seating configured
            event = await get_or_create_demo_event(db, npo.id)

            # 3. Create demo users (donors)
            users = await create_demo_users(db, count=20)

            # 4. Create registrations with some accompanying guests
            registrations = await create_demo_registrations(db, event, users)

            # 5. Auto-assign bidder numbers
            await assign_bidder_numbers(db, registrations)

            # 6. Assign tables (70% assigned, 30% unassigned)
            await assign_tables_mixed(db, event, registrations)

            # 7. Check in some guests (40% checked in)
            await check_in_some_guests(db, registrations)

            # 8. Print summary
            await print_summary(db, event)

            print("✅ Seating data seeded successfully!\n")

        except Exception as e:
            print(f"\n❌ Error seeding data: {e}")
            await db.rollback()
            raise


if __name__ == "__main__":
    asyncio.run(main())
