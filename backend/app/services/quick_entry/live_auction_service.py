"""Live auction quick-entry service logic."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auction_item import AuctionItem
from app.models.event_registration import EventRegistration
from app.models.quick_entry_bid import QuickEntryBid, QuickEntryBidStatus
from app.models.registration_guest import RegistrationGuest
from app.services.quick_entry.service_base import QuickEntryServiceBase


class LiveAuctionService(QuickEntryServiceBase):
    """Service layer for live auction quick-entry actions."""

    @classmethod
    async def create_live_bid(
        cls,
        db: AsyncSession,
        *,
        event_id: UUID,
        item_id: UUID,
        amount: int,
        bidder_number: int,
        entered_by_user_id: UUID,
    ) -> tuple[QuickEntryBid, str | None, int | None]:
        """Create and persist a quick-entry bid for a live auction item."""
        cls.validate_whole_dollar_amount(amount)

        await cls._get_live_item_or_404(db=db, event_id=event_id, item_id=item_id)

        bidder = await cls.lookup_bidder(db=db, event_id=event_id, bidder_number=bidder_number)

        bid = QuickEntryBid(
            event_id=event_id,
            item_id=item_id,
            amount=amount,
            bidder_number=bidder_number,
            donor_user_id=bidder.donor_user_id,
            accepted_at=datetime.now(UTC),
            entered_by_user_id=entered_by_user_id,
        )
        db.add(bid)
        cls.log_quick_entry_action(
            db,
            actor_user_id=entered_by_user_id,
            action="quick_entry_live_bid_created",
            resource_type="quick_entry_live_bid",
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

        return bid, bidder.donor_display_name, bidder.table_number

    @classmethod
    async def get_live_summary(
        cls,
        db: AsyncSession,
        *,
        event_id: UUID,
        item_id: UUID,
    ) -> tuple[
        int, int, int, datetime, list[QuickEntryBid], dict[int, tuple[str | None, int | None]]
    ]:
        """Return summary metrics and chronological bid log for a live item."""
        await cls._get_live_item_or_404(db=db, event_id=event_id, item_id=item_id)

        stmt = (
            select(QuickEntryBid)
            .where(
                QuickEntryBid.event_id == event_id,
                QuickEntryBid.item_id == item_id,
                QuickEntryBid.status.in_([QuickEntryBidStatus.ACTIVE, QuickEntryBidStatus.WINNING]),
            )
            .order_by(QuickEntryBid.accepted_at.asc())
        )
        result = await db.execute(stmt)
        bids = list(result.scalars().all())

        if bids:
            highest_bid = sorted(bids, key=lambda bid: (-bid.amount, bid.accepted_at))[0].amount
            updated_at = bids[-1].accepted_at
        else:
            highest_bid = 0
            updated_at = datetime.now(UTC)

        unique_bidder_count = len({bid.bidder_number for bid in bids})
        bidder_context = await cls._get_bidder_context(
            db=db,
            event_id=event_id,
            bidder_numbers={bid.bidder_number for bid in bids},
        )

        return highest_bid, len(bids), unique_bidder_count, updated_at, bids, bidder_context

    @classmethod
    async def delete_live_bid(
        cls,
        db: AsyncSession,
        *,
        event_id: UUID,
        bid_id: UUID,
        deleted_by_user_id: UUID,
    ) -> None:
        """Soft-delete a live quick-entry bid entry."""
        stmt = select(QuickEntryBid).where(
            QuickEntryBid.id == bid_id,
            QuickEntryBid.event_id == event_id,
            QuickEntryBid.status != QuickEntryBidStatus.DELETED,
        )
        result = await db.execute(stmt)
        bid = result.scalar_one_or_none()
        if bid is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Quick-entry bid not found"
            )

        bid.status = QuickEntryBidStatus.DELETED
        bid.deleted_at = datetime.now(UTC)
        bid.deleted_by_user_id = deleted_by_user_id
        cls.log_quick_entry_action(
            db,
            actor_user_id=deleted_by_user_id,
            action="quick_entry_live_bid_deleted",
            resource_type="quick_entry_live_bid",
            resource_id=bid.id,
            event_id=event_id,
            metadata={"item_id": str(bid.item_id)},
        )
        await db.commit()

    @classmethod
    async def assign_winner_to_highest_bid(
        cls,
        db: AsyncSession,
        *,
        event_id: UUID,
        item_id: UUID,
        assigned_by_user_id: UUID,
    ) -> QuickEntryBid:
        """Assign winner status to current highest valid bid for an item."""
        await cls._get_live_item_or_404(db=db, event_id=event_id, item_id=item_id)

        stmt = (
            select(QuickEntryBid)
            .where(
                QuickEntryBid.event_id == event_id,
                QuickEntryBid.item_id == item_id,
                QuickEntryBid.status.in_([QuickEntryBidStatus.ACTIVE, QuickEntryBidStatus.WINNING]),
            )
            .order_by(QuickEntryBid.amount.desc(), QuickEntryBid.accepted_at.asc())
        )
        result = await db.execute(stmt)
        bids = list(result.scalars().all())

        if not bids:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No valid bids available for winner assignment",
            )

        winner = bids[0]
        for bid in bids:
            if bid.id == winner.id:
                bid.status = QuickEntryBidStatus.WINNING
            elif bid.status == QuickEntryBidStatus.WINNING:
                bid.status = QuickEntryBidStatus.ACTIVE

        cls.log_quick_entry_action(
            db,
            actor_user_id=assigned_by_user_id,
            action="quick_entry_live_winner_assigned",
            resource_type="quick_entry_live_bid",
            resource_id=winner.id,
            event_id=event_id,
            metadata={"item_id": str(item_id), "bidder_number": winner.bidder_number},
        )
        await db.commit()
        await db.refresh(winner)
        return winner

    @staticmethod
    async def _get_live_item_or_404(
        db: AsyncSession, *, event_id: UUID, item_id: UUID
    ) -> AuctionItem:
        item_stmt = select(AuctionItem).where(
            and_(AuctionItem.id == item_id, AuctionItem.event_id == event_id)
        )
        item_result = await db.execute(item_stmt)
        item = item_result.scalar_one_or_none()
        if item is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Live auction item not found",
            )
        return item

    @staticmethod
    async def _get_bidder_context(
        db: AsyncSession,
        *,
        event_id: UUID,
        bidder_numbers: set[int],
    ) -> dict[int, tuple[str | None, int | None]]:
        if not bidder_numbers:
            return {}

        stmt = (
            select(
                RegistrationGuest.bidder_number,
                RegistrationGuest.name,
                RegistrationGuest.table_number,
            )
            .join(
                EventRegistration,
                EventRegistration.id == RegistrationGuest.registration_id,
            )
            .where(
                EventRegistration.event_id == event_id,
                RegistrationGuest.bidder_number.in_(bidder_numbers),
            )
        )
        result = await db.execute(stmt)
        return {
            bidder_number: (name, table_number)
            for bidder_number, name, table_number in result.all()
            if bidder_number is not None
        }
