from __future__ import annotations

from factories import SponsorFactory, create_factory_model
from helpers import bind_all_factories, make_blob_url
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sponsor import Sponsor

SPONSOR_LEVELS = ["Gold", "Gold", "Silver", "Silver", "Bronze"]


async def seed(session: AsyncSession, state: dict[str, object]) -> dict[str, int]:
    bind_all_factories(session)
    counts = {"created": 0, "unchanged": 0}
    users = state["users"]
    for event_slug, event in state["events"].items():
        for index, level in enumerate(SPONSOR_LEVELS, start=1):
            name = f"{event.name} {level} Sponsor {index}"
            result = await session.execute(
                select(Sponsor).where(
                    Sponsor.event_id == event.id, Sponsor.name == name
                )
            )
            if result.scalar_one_or_none() is None:
                await create_factory_model(
                    session,
                    SponsorFactory,
                    event_id=event.id,
                    created_by=users["npo_admin"].id,
                    name=name,
                    sponsor_level=level,
                    logo_url=make_blob_url("sponsors", f"{event_slug}-{index}.png"),
                    logo_blob_name=f"sponsors/{event_slug}-{index}.png",
                    thumbnail_url=make_blob_url(
                        "sponsors", f"{event_slug}-{index}-thumb.png"
                    ),
                    thumbnail_blob_name=f"sponsors/{event_slug}-{index}-thumb.png",
                    display_order=index,
                )
                counts["created"] += 1
            else:
                counts["unchanged"] += 1
    return counts
