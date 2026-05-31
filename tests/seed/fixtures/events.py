from __future__ import annotations

from datetime import UTC, datetime, timedelta

from factories import EventFactory, create_factory_model
from helpers import bind_all_factories, make_blob_url
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event, EventStatus, FoodOption

EVENT_DEFINITIONS = {
    "seed-future-event": ("Seed Future Event", EventStatus.DRAFT, 30),
    "seed-live-event": ("Seed Live Event", EventStatus.ACTIVE, 1),
    "seed-past-event": ("Seed Past Event", EventStatus.CLOSED, -7),
}


async def seed(session: AsyncSession, state: dict[str, object]) -> dict[str, int]:
    bind_all_factories(session)
    counts = {"created": 0, "unchanged": 0}
    npo = state["npo"]
    users = state["users"]
    events: dict[str, Event] = {}

    for slug, (name, status, offset_days) in EVENT_DEFINITIONS.items():
        result = await session.execute(select(Event).where(Event.slug == slug))
        event = result.scalar_one_or_none()
        event_datetime = datetime.now(UTC) + timedelta(days=offset_days)
        if event is None:
            event = await create_factory_model(
                session,
                EventFactory,
                npo_id=npo.id,
                name=name,
                slug=slug,
                status=status,
                event_datetime=event_datetime,
                logo_url=make_blob_url("logos", f"{slug}.png"),
                created_by=users["npo_admin"].id,
                updated_by=users["npo_admin"].id,
            )
            counts["created"] += 1
        else:
            event.status = status
            event.event_datetime = event_datetime
            event.logo_url = make_blob_url("logos", f"{slug}.png")
            await session.commit()
            counts["unchanged"] += 1

        for order, food_name in enumerate(("Chicken", "Vegetarian", "Vegan")):
            food_result = await session.execute(
                select(FoodOption).where(
                    FoodOption.event_id == event.id, FoodOption.name == food_name
                )
            )
            if food_result.scalar_one_or_none() is None:
                session.add(
                    FoodOption(
                        event_id=event.id,
                        name=food_name,
                        description=f"{food_name} entree",
                        display_order=order,
                    )
                )
        await session.commit()
        events[slug] = event

    state["events"] = events
    return counts
