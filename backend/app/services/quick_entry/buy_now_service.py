"""Buy-it-now quick-entry service logic."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.auction_item import AuctionItem
from app.models.quick_entry_buy_now_bid import QuickEntryBuyNowBid
from app.services.quick_entry.service_base import QuickEntryServiceBase


class BuyNowService(QuickEntryServiceBase):
    """Service layer for buy-it-now quick-entry actions."""

    @classmethod
    async def get_buy_now_items(
        cls,
        db: AsyncSession,
        *,
        event_id: UUID,
    ) -> list[AuctionItem]:
        """Return auction items with buy-now enabled for this event."""
        stmt = (
            select(AuctionItem)
            .where(
                AuctionItem.event_id == event_id,
                AuctionItem.buy_now_enabled.is_(True),
            )
            .order_by(AuctionItem.bid_number.asc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @classmethod
    async def create_buy_now_bid(
        cls,
        db: AsyncSession,
        *,
        event_id: UUID,
        item_id: UUID,
        amount: int,
        bidder_number: int,
        entered_by_user_id: UUID,
    ) -> tuple[QuickEntryBuyNowBid, str | None]:
        """Record a buy-it-now bid for an auction item."""
        cls.validate_whole_dollar_amount(amount)

        # Verify item belongs to event and has buy-now enabled
        stmt = select(AuctionItem).where(
            AuctionItem.id == item_id,
            AuctionItem.event_id == event_id,
            AuctionItem.buy_now_enabled.is_(True),
        )
        result = await db.execute(stmt)
        item = result.scalar_one_or_none()
        if item is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Buy-it-now item not found for this event",
            )

        bidder = await cls.lookup_bidder_optional(
            db=db, event_id=event_id, bidder_number=bidder_number
        )

        now = datetime.now(UTC)
        bid = QuickEntryBuyNowBid(
            event_id=event_id,
            item_id=item_id,
            bidder_number=bidder_number,
            donor_user_id=bidder.donor_user_id if bidder else None,
            amount=amount,
            entered_at=now,
            entered_by_user_id=entered_by_user_id,
        )
        db.add(bid)

        cls.log_quick_entry_action(
            db,
            actor_user_id=entered_by_user_id,
            action="quick_entry_buy_now_bid_created",
            resource_type="quick_entry_buy_now_bid",
            resource_id=bid.id,
            event_id=event_id,
            metadata={
                "item_id": str(item_id),
                "bidder_number": bidder_number,
                "amount": amount,
            },
        )
        await db.commit()
        await db.refresh(bid)
        return bid, bidder.donor_display_name if bidder else None

    @classmethod
    async def list_buy_now_bids(
        cls,
        db: AsyncSession,
        *,
        event_id: UUID,
        item_id: UUID,
        limit: int = 50,
    ) -> list[QuickEntryBuyNowBid]:
        """Return the most recent buy-it-now bids for a given item."""
        stmt = (
            select(QuickEntryBuyNowBid)
            .where(
                QuickEntryBuyNowBid.event_id == event_id,
                QuickEntryBuyNowBid.item_id == item_id,
            )
            .options(
                selectinload(QuickEntryBuyNowBid.donor),
                selectinload(QuickEntryBuyNowBid.entered_by),
            )
            .order_by(QuickEntryBuyNowBid.entered_at.desc())
            .limit(limit)
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @classmethod
    async def get_summary(
        cls,
        db: AsyncSession,
        *,
        event_id: UUID,
    ) -> tuple[int, int]:
        """Return (total_raised, bid_count) for all buy-it-now bids in the event."""
        stmt = select(
            func.coalesce(func.sum(QuickEntryBuyNowBid.amount), 0),
            func.count(QuickEntryBuyNowBid.id),
        ).where(QuickEntryBuyNowBid.event_id == event_id)
        row = (await db.execute(stmt)).one()
        return int(row[0]), int(row[1])

    @classmethod
    async def delete_buy_now_bid(
        cls,
        db: AsyncSession,
        *,
        event_id: UUID,
        bid_id: UUID,
        deleted_by_user_id: UUID,
    ) -> None:
        """Hard-delete a buy-it-now bid record."""
        stmt = select(QuickEntryBuyNowBid).where(
            QuickEntryBuyNowBid.id == bid_id,
            QuickEntryBuyNowBid.event_id == event_id,
        )
        result = await db.execute(stmt)
        bid = result.scalar_one_or_none()
        if bid is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Buy-it-now bid not found",
            )

        cls.log_quick_entry_action(
            db,
            actor_user_id=deleted_by_user_id,
            action="quick_entry_buy_now_bid_deleted",
            resource_type="quick_entry_buy_now_bid",
            resource_id=bid.id,
            event_id=event_id,
            metadata={"item_id": str(bid.item_id), "bidder_number": bid.bidder_number},
        )
        await db.delete(bid)
        await db.commit()
