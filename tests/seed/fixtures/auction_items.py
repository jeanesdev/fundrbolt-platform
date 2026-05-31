from __future__ import annotations

from decimal import Decimal

from factories import AuctionItemFactory, create_factory_model
from helpers import bind_all_factories, make_blob_url
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auction_item import AuctionItem


async def seed(session: AsyncSession, state: dict[str, object]) -> dict[str, int]:
    bind_all_factories(session)
    counts = {"created": 0, "unchanged": 0}
    users = state["users"]
    items_by_event: dict[str, list[AuctionItem]] = {}

    for event_slug, event in state["events"].items():
        event_items: list[AuctionItem] = []
        for offset in range(10):
            item_number = 100 + offset
            item_type = "silent" if offset < 5 else "live"
            starting_bid = Decimal(str(50 + (offset * 25)))
            result = await session.execute(
                select(AuctionItem).where(
                    AuctionItem.event_id == event.id,
                    AuctionItem.bid_number == item_number,
                )
            )
            item = result.scalar_one_or_none()
            if item is None:
                item = await create_factory_model(
                    session,
                    AuctionItemFactory,
                    event_id=event.id,
                    created_by=users["npo_admin"].id,
                    bid_number=item_number,
                    title=f"{event.name} Item {offset + 1}",
                    auction_type=item_type,
                    starting_bid=starting_bid,
                    item_webpage=make_blob_url(
                        "auction-items", f"{event_slug}-{item_number}.png"
                    ),
                )
                counts["created"] += 1
            else:
                counts["unchanged"] += 1
            event_items.append(item)
        items_by_event[event_slug] = event_items
    state["auction_items"] = items_by_event
    return counts
