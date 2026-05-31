from __future__ import annotations

from datetime import UTC, datetime

from factories import (
    EventTableFactory,
    RegistrationFactory,
    RegistrationGuestFactory,
    create_factory_model,
)
from helpers import bind_all_factories
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event_registration import EventRegistration
from app.models.event_table import EventTable
from app.models.registration_guest import RegistrationGuest


async def seed(session: AsyncSession, state: dict[str, object]) -> dict[str, int]:
    bind_all_factories(session)
    counts = {"created": 0, "unchanged": 0}
    users = state["users"]
    live_event = state["events"]["seed-live-event"]

    for table_number in range(1, 6):
        result = await session.execute(
            select(EventTable).where(
                EventTable.event_id == live_event.id,
                EventTable.table_number == table_number,
            )
        )
        table = result.scalar_one_or_none()
        if table is None:
            await create_factory_model(
                session,
                EventTableFactory,
                event_id=live_event.id,
                table_number=table_number,
                custom_capacity=10 if table_number == 1 else 8,
                table_name="VIP Table" if table_number == 1 else None,
            )
            counts["created"] += 1
        else:
            counts["unchanged"] += 1

    reg_result = await session.execute(
        select(EventRegistration).where(
            EventRegistration.event_id == live_event.id,
            EventRegistration.user_id == users["donor"].id,
            EventRegistration.number_of_guests == 1,
        )
    )
    registration = reg_result.scalar_one_or_none()
    if registration is None:
        registration = await create_factory_model(
            session,
            RegistrationFactory,
            event_id=live_event.id,
            user_id=users["donor"].id,
            number_of_guests=1,
        )
        counts["created"] += 1
    else:
        counts["unchanged"] += 1

    guest_result = await session.execute(
        select(RegistrationGuest).where(
            RegistrationGuest.registration_id == registration.id,
            RegistrationGuest.is_primary.is_(True),
        )
    )
    guest = guest_result.scalar_one_or_none()
    if guest is None:
        guest = await create_factory_model(
            session,
            RegistrationGuestFactory,
            registration_id=registration.id,
            user_id=users["donor"].id,
            name=f"{users['donor'].first_name} {users['donor'].last_name}",
            email=users["donor"].email,
            phone=users["donor"].phone,
            is_primary=True,
        )
    guest.checked_in = True
    guest.check_in_time = datetime.now(UTC)
    guest.bidder_number = 101
    guest.table_number = 1
    guest.is_table_captain = True
    await session.commit()

    multi_result = await session.execute(
        select(EventRegistration).where(
            EventRegistration.event_id == live_event.id,
            EventRegistration.number_of_guests == 3,
        )
    )
    multi_registration = multi_result.scalar_one_or_none()
    if multi_registration is None:
        multi_registration = await create_factory_model(
            session,
            RegistrationFactory,
            event_id=live_event.id,
            user_id=users["checkin_staff"].id,
            number_of_guests=3,
        )
        await create_factory_model(
            session,
            RegistrationGuestFactory,
            registration_id=multi_registration.id,
            user_id=users["checkin_staff"].id,
            name="Automation Staff",
            email=users["checkin_staff"].email,
            is_primary=True,
            bidder_number=102,
            table_number=2,
        )
        await create_factory_model(
            session,
            RegistrationGuestFactory,
            registration_id=multi_registration.id,
            name="Guest One",
            email="automation+guest1@fundrbolt.com",
            table_number=2,
        )
        await create_factory_model(
            session,
            RegistrationGuestFactory,
            registration_id=multi_registration.id,
            name="Guest Two",
            email="automation+guest2@fundrbolt.com",
            table_number=2,
        )
        counts["created"] += 1
    else:
        counts["unchanged"] += 1

    state["registration"] = registration
    state["primary_guest"] = guest
    return counts
