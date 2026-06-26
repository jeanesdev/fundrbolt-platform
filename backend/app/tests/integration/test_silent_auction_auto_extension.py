"""Integration tests for silent auction anti-sniping extension behavior."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auction_item import AuctionItem, AuctionType, ItemStatus
from app.models.silent_auction_extension_policy import (
    SilentAuctionExtensionPolicy,
    SilentAuctionItemExtensionState,
)
from app.services.silent_auction_extension_service import SilentAuctionExtensionService


@pytest.mark.asyncio
async def test_late_bid_applies_extension_within_window(
    db_session: AsyncSession,
    test_event: Any,
    test_user: Any,
) -> None:
    test_event.auction_close_datetime = datetime.now(UTC) + timedelta(minutes=2)

    item = AuctionItem(
        event_id=test_event.id,
        external_id="ext-late-bid-001",
        bid_number=111,
        title="Silent Item",
        description="Silent item for extension test",
        auction_type=AuctionType.SILENT.value,
        starting_bid=Decimal("100.00"),
        bid_increment=Decimal("10.00"),
        buy_now_enabled=False,
        quantity_available=1,
        status=ItemStatus.PUBLISHED.value,
        created_by=test_user.id,
    )
    db_session.add(item)
    await db_session.flush()

    service = SilentAuctionExtensionService(db_session)
    accepted_at = test_event.auction_close_datetime - timedelta(minutes=1)
    result = await service.evaluate_and_apply_extension(
        event_id=test_event.id,
        auction_item_id=item.id,
        accepted_at=accepted_at,
    )

    assert result.extension_applied_minutes == 3
    assert result.item_effective_close_at is not None
    await db_session.commit()


@pytest.mark.asyncio
async def test_max_extension_cap_prevents_more_extension(
    db_session: AsyncSession,
    test_event: Any,
    test_user: Any,
) -> None:
    test_event.auction_close_datetime = datetime.now(UTC) + timedelta(minutes=2)

    item = AuctionItem(
        event_id=test_event.id,
        external_id="ext-cap-001",
        bid_number=112,
        title="Silent Item Cap",
        description="Silent item for cap test",
        auction_type=AuctionType.SILENT.value,
        starting_bid=Decimal("100.00"),
        bid_increment=Decimal("10.00"),
        buy_now_enabled=False,
        quantity_available=1,
        status=ItemStatus.PUBLISHED.value,
        created_by=test_user.id,
    )
    db_session.add(item)
    await db_session.flush()

    service = SilentAuctionExtensionService(db_session)
    await service.update_policy(
        event_id=test_event.id,
        auto_extension_enabled=True,
        extension_duration_minutes=3,
        max_total_extension_minutes=0,
        updated_by_user_id=test_user.id,
    )

    accepted_at = test_event.auction_close_datetime - timedelta(minutes=1)
    result = await service.evaluate_and_apply_extension(
        event_id=test_event.id,
        auction_item_id=item.id,
        accepted_at=accepted_at,
    )

    assert result.extension_applied_minutes == 0
    assert result.max_extension_reached is True


@pytest.mark.asyncio
async def test_legacy_event_policy_is_auto_created_on_evaluation(
    db_session: AsyncSession,
    test_event: Any,
    test_user: Any,
) -> None:
    test_event.auction_close_datetime = datetime.now(UTC) + timedelta(minutes=3)

    item = AuctionItem(
        event_id=test_event.id,
        external_id="ext-legacy-001",
        bid_number=113,
        title="Legacy Silent Item",
        description="Silent item for legacy policy creation",
        auction_type=AuctionType.SILENT.value,
        starting_bid=Decimal("100.00"),
        bid_increment=Decimal("10.00"),
        buy_now_enabled=False,
        quantity_available=1,
        status=ItemStatus.PUBLISHED.value,
        created_by=test_user.id,
    )
    db_session.add(item)
    await db_session.flush()

    # Ensure no policy exists yet.
    existing = await db_session.execute(
        select(SilentAuctionExtensionPolicy).where(
            SilentAuctionExtensionPolicy.event_id == test_event.id
        )
    )
    assert existing.scalar_one_or_none() is None

    service = SilentAuctionExtensionService(db_session)
    accepted_at = test_event.auction_close_datetime - timedelta(minutes=1)
    await service.evaluate_and_apply_extension(
        event_id=test_event.id,
        auction_item_id=item.id,
        accepted_at=accepted_at,
    )

    created = await db_session.execute(
        select(SilentAuctionExtensionPolicy).where(
            SilentAuctionExtensionPolicy.event_id == test_event.id
        )
    )
    assert created.scalar_one_or_none() is not None

    state = await db_session.execute(
        select(SilentAuctionItemExtensionState).where(
            SilentAuctionItemExtensionState.event_id == test_event.id,
            SilentAuctionItemExtensionState.auction_item_id == item.id,
        )
    )
    assert state.scalar_one_or_none() is not None
