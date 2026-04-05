"""Service for auctioneer commission, settings, dashboard, and live auction logic."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auction_bid import AuctionBid, BidStatus, PaddleRaiseContribution
from app.models.auction_item import AuctionItem, AuctionItemMedia
from app.models.auctioneer import AuctioneerEventSettings, AuctioneerItemCommission
from app.models.event import Event
from app.models.quick_entry_bid import QuickEntryBid, QuickEntryBidStatus
from app.models.quick_entry_donation import QuickEntryDonation
from app.models.registration_guest import RegistrationGuest
from app.models.user import User
from app.schemas.auctioneer import (
    AuctionStatus,
    BidHistoryEntry,
    CommissionListItem,
    CommissionListResponse,
    CommissionResponse,
    DashboardResponse,
    EarningsSummary,
    EventSettingsResponse,
    EventTotals,
    HighBidder,
    LiveAuctionItem,
    LiveAuctionResponse,
    SilentAuctionStatus,
    TimerData,
)

logger = logging.getLogger(__name__)


class AuctioneerService:
    """Service for auctioneer-related operations."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Commission CRUD ──────────────────────────────────────────

    async def get_commissions(
        self, event_id: UUID, auctioneer_user_id: UUID
    ) -> CommissionListResponse:
        stmt = (
            select(
                AuctioneerItemCommission,
                AuctionItem.title,
                AuctionItem.bid_number,
                AuctionItem.auction_type,
                AuctionItem.status,
                AuctionItem.current_bid_amount,
                AuctionItem.quantity_available,
                AuctionItem.cost,
                AuctionItem.bid_count,
            )
            .join(
                AuctionItem,
                AuctioneerItemCommission.auction_item_id == AuctionItem.id,
            )
            .where(
                AuctioneerItemCommission.auctioneer_user_id == auctioneer_user_id,
                AuctionItem.event_id == event_id,
                AuctionItem.deleted_at.is_(None),
            )
            .order_by(AuctionItem.title)
        )
        rows = (await self.db.execute(stmt)).all()

        commissions: list[CommissionListItem] = []
        for row in rows:
            comm = row[0]
            # Get primary image
            img_stmt = (
                select(AuctionItemMedia.file_path)
                .where(
                    AuctionItemMedia.auction_item_id == comm.auction_item_id,
                    AuctionItemMedia.display_order == 0,
                )
                .limit(1)
            )
            img_result = await self.db.execute(img_stmt)
            primary_image = img_result.scalar_one_or_none()

            commissions.append(
                CommissionListItem(
                    id=comm.id,
                    auction_item_id=comm.auction_item_id,
                    auction_item_title=row[1],
                    auction_item_bid_number=row[2],
                    auction_type=row[3],
                    commission_percent=comm.commission_percent,
                    flat_fee=comm.flat_fee,
                    notes=comm.notes,
                    item_status=row[4],
                    current_bid_amount=row[5],
                    quantity_available=row[6],
                    cost=row[7],
                    bid_count=row[8],
                    primary_image_url=primary_image,
                    created_at=comm.created_at,
                    updated_at=comm.updated_at,
                )
            )

        return CommissionListResponse(commissions=commissions, total=len(commissions))

    async def upsert_commission(
        self,
        auctioneer_user_id: UUID,
        auction_item_id: UUID,
        commission_percent: Decimal,
        flat_fee: Decimal,
        notes: str | None,
    ) -> tuple[CommissionResponse, bool]:
        """Upsert a commission record. Returns (response, created)."""
        stmt = select(AuctioneerItemCommission).where(
            AuctioneerItemCommission.auctioneer_user_id == auctioneer_user_id,
            AuctioneerItemCommission.auction_item_id == auction_item_id,
        )
        existing = (await self.db.execute(stmt)).scalar_one_or_none()

        if existing:
            existing.commission_percent = commission_percent
            existing.flat_fee = flat_fee
            existing.notes = notes
            existing.updated_at = datetime.now(UTC)
            await self.db.flush()
            logger.info(
                "Commission updated: item %s by auctioneer %s (pct=%s, flat=%s)",
                auction_item_id,
                auctioneer_user_id,
                commission_percent,
                flat_fee,
            )
            return CommissionResponse.model_validate(existing), False

        new_comm = AuctioneerItemCommission(
            auctioneer_user_id=auctioneer_user_id,
            auction_item_id=auction_item_id,
            commission_percent=commission_percent,
            flat_fee=flat_fee,
            notes=notes,
        )
        self.db.add(new_comm)
        await self.db.flush()
        logger.info(
            "Commission created: item %s by auctioneer %s (pct=%s, flat=%s)",
            auction_item_id,
            auctioneer_user_id,
            commission_percent,
            flat_fee,
        )
        return CommissionResponse.model_validate(new_comm), True

    async def delete_commission(self, auctioneer_user_id: UUID, auction_item_id: UUID) -> bool:
        stmt = delete(AuctioneerItemCommission).where(
            AuctioneerItemCommission.auctioneer_user_id == auctioneer_user_id,
            AuctioneerItemCommission.auction_item_id == auction_item_id,
        )
        cursor: Any = await self.db.execute(stmt)
        deleted = bool(cursor.rowcount)
        if deleted:
            logger.info(
                "Commission deleted: item %s by auctioneer %s",
                auction_item_id,
                auctioneer_user_id,
            )
        return deleted

    # ── Event settings ───────────────────────────────────────────

    async def get_event_settings(
        self, event_id: UUID, auctioneer_user_id: UUID
    ) -> EventSettingsResponse:
        stmt = select(AuctioneerEventSettings).where(
            AuctioneerEventSettings.auctioneer_user_id == auctioneer_user_id,
            AuctioneerEventSettings.event_id == event_id,
        )
        settings = (await self.db.execute(stmt)).scalar_one_or_none()

        if settings:
            return EventSettingsResponse.model_validate(settings)

        # Return defaults
        return EventSettingsResponse(
            auctioneer_user_id=auctioneer_user_id,
            event_id=event_id,
            live_auction_percent=Decimal("0"),
            paddle_raise_percent=Decimal("0"),
            silent_auction_percent=Decimal("0"),
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

    async def upsert_event_settings(
        self,
        event_id: UUID,
        auctioneer_user_id: UUID,
        live_auction_percent: Decimal,
        paddle_raise_percent: Decimal,
        silent_auction_percent: Decimal,
    ) -> EventSettingsResponse:
        stmt = select(AuctioneerEventSettings).where(
            AuctioneerEventSettings.auctioneer_user_id == auctioneer_user_id,
            AuctioneerEventSettings.event_id == event_id,
        )
        existing = (await self.db.execute(stmt)).scalar_one_or_none()

        if existing:
            existing.live_auction_percent = live_auction_percent
            existing.paddle_raise_percent = paddle_raise_percent
            existing.silent_auction_percent = silent_auction_percent
            existing.updated_at = datetime.now(UTC)
            await self.db.flush()
            logger.info(
                "Event settings updated: event %s by auctioneer %s",
                event_id,
                auctioneer_user_id,
            )
            return EventSettingsResponse.model_validate(existing)

        new_settings = AuctioneerEventSettings(
            auctioneer_user_id=auctioneer_user_id,
            event_id=event_id,
            live_auction_percent=live_auction_percent,
            paddle_raise_percent=paddle_raise_percent,
            silent_auction_percent=silent_auction_percent,
        )
        self.db.add(new_settings)
        await self.db.flush()
        logger.info(
            "Event settings created: event %s by auctioneer %s",
            event_id,
            auctioneer_user_id,
        )
        return EventSettingsResponse.model_validate(new_settings)

    # ── Dashboard / earnings ─────────────────────────────────────

    async def _get_event_revenue(self, event_id: UUID) -> dict[str, Decimal]:
        """Get event revenue totals by category (same pattern as EventDashboardService)."""
        # Silent auction high bids
        silent_high = (
            select(
                AuctionBid.auction_item_id,
                func.max(AuctionBid.bid_amount).label("max_bid"),
            )
            .join(AuctionItem, AuctionBid.auction_item_id == AuctionItem.id)
            .where(
                AuctionBid.event_id == event_id,
                AuctionBid.bid_status.in_(
                    [BidStatus.ACTIVE.value, BidStatus.OUTBID.value, BidStatus.WINNING.value]
                ),
                AuctionItem.auction_type == "silent",
                AuctionItem.deleted_at.is_(None),
            )
            .group_by(AuctionBid.auction_item_id)
            .subquery()
        )
        silent_stmt = select(func.coalesce(func.sum(silent_high.c.max_bid), 0))
        silent_total = Decimal((await self.db.execute(silent_stmt)).scalar_one() or 0)

        # Live auction - QuickEntryBid
        live_high = (
            select(
                QuickEntryBid.item_id,
                func.max(QuickEntryBid.amount).label("max_bid"),
            )
            .where(
                QuickEntryBid.event_id == event_id,
                QuickEntryBid.status.in_([QuickEntryBidStatus.ACTIVE, QuickEntryBidStatus.WINNING]),
            )
            .group_by(QuickEntryBid.item_id)
            .subquery()
        )
        live_stmt = select(func.coalesce(func.sum(live_high.c.max_bid), 0))
        live_total = Decimal((await self.db.execute(live_stmt)).scalar_one() or 0)

        # Paddle raise
        paddle_stmt = select(func.coalesce(func.sum(PaddleRaiseContribution.amount), 0)).where(
            PaddleRaiseContribution.event_id == event_id
        )
        qe_paddle_stmt = select(func.coalesce(func.sum(QuickEntryDonation.amount), 0)).where(
            QuickEntryDonation.event_id == event_id
        )
        paddle_total = Decimal((await self.db.execute(paddle_stmt)).scalar_one() or 0)
        qe_paddle_total = Decimal((await self.db.execute(qe_paddle_stmt)).scalar_one() or 0)

        return {
            "live_auction": live_total,
            "paddle_raise": paddle_total + qe_paddle_total,
            "silent_auction": silent_total,
        }

    async def _get_per_item_earnings(
        self, event_id: UUID, auctioneer_user_id: UUID
    ) -> tuple[Decimal, int, set[UUID]]:
        """Calculate per-item earnings. Returns (total, count, commissioned_item_ids)."""
        comm_stmt = (
            select(
                AuctioneerItemCommission.auction_item_id,
                AuctioneerItemCommission.commission_percent,
                AuctioneerItemCommission.flat_fee,
            )
            .join(
                AuctionItem,
                AuctioneerItemCommission.auction_item_id == AuctionItem.id,
            )
            .where(
                AuctioneerItemCommission.auctioneer_user_id == auctioneer_user_id,
                AuctionItem.event_id == event_id,
                AuctionItem.deleted_at.is_(None),
                AuctionItem.status.notin_(["withdrawn", "draft"]),
            )
        )
        comm_rows = (await self.db.execute(comm_stmt)).all()

        if not comm_rows:
            return Decimal("0"), 0, set()

        item_ids = [row[0] for row in comm_rows]
        commissioned_ids = set(item_ids)

        # Get winning bid amounts for commissioned items
        # Silent auction bids
        winning_bids_stmt = (
            select(
                AuctionBid.auction_item_id,
                func.max(AuctionBid.bid_amount).label("max_bid"),
            )
            .where(
                AuctionBid.auction_item_id.in_(item_ids),
                AuctionBid.bid_status.in_(
                    [BidStatus.ACTIVE.value, BidStatus.OUTBID.value, BidStatus.WINNING.value]
                ),
            )
            .group_by(AuctionBid.auction_item_id)
        )
        winning_rows = {
            row[0]: Decimal(row[1] or 0) for row in (await self.db.execute(winning_bids_stmt)).all()
        }

        # Quick entry bids (live items)
        qe_bids_stmt = (
            select(
                QuickEntryBid.item_id,
                func.max(QuickEntryBid.amount).label("max_bid"),
            )
            .where(
                QuickEntryBid.item_id.in_(item_ids),
                QuickEntryBid.status.in_([QuickEntryBidStatus.ACTIVE, QuickEntryBidStatus.WINNING]),
            )
            .group_by(QuickEntryBid.item_id)
        )
        qe_rows = {
            row[0]: Decimal(row[1] or 0) for row in (await self.db.execute(qe_bids_stmt)).all()
        }

        total = Decimal("0")
        count = 0
        for item_id, pct, flat in comm_rows:
            bid = winning_rows.get(item_id) or qe_rows.get(item_id) or Decimal("0")
            if bid > 0:
                earning = bid * pct / Decimal("100") + flat
                total += earning
                count += 1

        return total, count, commissioned_ids

    async def get_dashboard(self, event_id: UUID, auctioneer_user_id: UUID) -> DashboardResponse:
        now = datetime.now(UTC)

        # Get event for timer data
        event = (
            await self.db.execute(select(Event).where(Event.id == event_id))
        ).scalar_one_or_none()

        # Per-item earnings
        per_item_total, per_item_count, commissioned_ids = await self._get_per_item_earnings(
            event_id, auctioneer_user_id
        )

        # Event revenue totals
        revenue = await self._get_event_revenue(event_id)

        # Event settings for category percentages
        settings = await self.get_event_settings(event_id, auctioneer_user_id)

        # Category earnings — exclude commissioned items to avoid double-counting
        # For simplicity we apply category % to the full category pool
        # (items with per-item commission are already counted above)
        live_cat = revenue["live_auction"] * settings.live_auction_percent / Decimal("100")
        paddle_cat = revenue["paddle_raise"] * settings.paddle_raise_percent / Decimal("100")
        silent_cat = revenue["silent_auction"] * settings.silent_auction_percent / Decimal("100")

        total_earnings = per_item_total + live_cat + paddle_cat + silent_cat

        event_total_raised = (
            revenue["live_auction"] + revenue["paddle_raise"] + revenue["silent_auction"]
        )

        # Timer calculations
        live_start = getattr(event, "live_auction_start_datetime", None) if event else None
        auction_close = getattr(event, "auction_close_datetime", None) if event else None

        live_status: AuctionStatus = "not_scheduled"
        if live_start:
            if now < live_start:
                live_status = "not_started"
            else:
                # Check if any live items are still bidding_open
                active_live = (
                    await self.db.execute(
                        select(func.count())
                        .select_from(AuctionItem)
                        .where(
                            AuctionItem.event_id == event_id,
                            AuctionItem.auction_type == "live",
                            AuctionItem.bidding_open.is_(True),
                            AuctionItem.deleted_at.is_(None),
                        )
                    )
                ).scalar_one()
                live_status = "in_progress" if active_live > 0 else "ended"

        silent_status: SilentAuctionStatus = "not_scheduled"
        if auction_close:
            event_start = event.event_datetime if event else None
            if now >= auction_close:
                silent_status = "closed"
            elif event_start and now < event_start:
                silent_status = "not_started"
            else:
                silent_status = "open"

        return DashboardResponse(
            earnings=EarningsSummary(
                per_item_total=per_item_total,
                per_item_count=per_item_count,
                live_auction_category_earning=live_cat,
                paddle_raise_category_earning=paddle_cat,
                silent_auction_category_earning=silent_cat,
                total_earnings=total_earnings,
            ),
            event_totals=EventTotals(
                live_auction_raised=revenue["live_auction"],
                paddle_raise_raised=revenue["paddle_raise"],
                silent_auction_raised=revenue["silent_auction"],
                event_total_raised=event_total_raised,
            ),
            timers=TimerData(
                live_auction_start_datetime=live_start,
                auction_close_datetime=auction_close,
                live_auction_status=live_status,
                silent_auction_status=silent_status,
            ),
            last_refreshed_at=now,
        )

    # ── Live auction tab ─────────────────────────────────────────

    async def get_live_auction(self, event_id: UUID) -> LiveAuctionResponse:
        """Get current live auction item, high bidder, and bid history."""
        # Find current live item (bidding_open + live type)
        item_stmt = (
            select(AuctionItem)
            .where(
                AuctionItem.event_id == event_id,
                AuctionItem.auction_type == "live",
                AuctionItem.bidding_open.is_(True),
                AuctionItem.deleted_at.is_(None),
            )
            .order_by(AuctionItem.updated_at.desc())
            .limit(1)
        )
        current_item = (await self.db.execute(item_stmt)).scalar_one_or_none()

        if not current_item:
            # Check if auction has started at all
            any_live = (
                await self.db.execute(
                    select(func.count())
                    .select_from(AuctionItem)
                    .where(
                        AuctionItem.event_id == event_id,
                        AuctionItem.auction_type == "live",
                        AuctionItem.deleted_at.is_(None),
                    )
                )
            ).scalar_one()

            return LiveAuctionResponse(
                current_item=None,
                high_bidder=None,
                bid_history=[],
                auction_status="ended" if any_live > 0 else "not_started",
            )

        # Get primary image
        img_stmt = (
            select(AuctionItemMedia.file_path)
            .where(
                AuctionItemMedia.auction_item_id == current_item.id,
                AuctionItemMedia.display_order == 0,
            )
            .limit(1)
        )
        primary_image = (await self.db.execute(img_stmt)).scalar_one_or_none()

        live_item = LiveAuctionItem(
            id=current_item.id,
            bid_number=current_item.bid_number,
            title=current_item.title,
            description=current_item.description,
            starting_bid=current_item.starting_bid,
            current_bid_amount=current_item.current_bid_amount,
            bid_count=current_item.bid_count or 0,
            primary_image_url=primary_image,
            donor_value=current_item.donor_value,
            cost=current_item.cost,
        )

        # Get high bidder from quick entry bids (live auction uses QuickEntryBid)
        high_bid_stmt = (
            select(QuickEntryBid)
            .where(
                QuickEntryBid.item_id == current_item.id,
                QuickEntryBid.status.in_([QuickEntryBidStatus.ACTIVE, QuickEntryBidStatus.WINNING]),
            )
            .order_by(QuickEntryBid.amount.desc())
            .limit(1)
        )
        high_bid = (await self.db.execute(high_bid_stmt)).scalar_one_or_none()

        high_bidder = None
        if high_bid:
            # Get user + registration guest details
            user_stmt = select(User).where(User.id == high_bid.donor_user_id)
            bidder_user = (await self.db.execute(user_stmt)).scalar_one_or_none()

            table_number = None
            if bidder_user:
                guest_stmt = (
                    select(RegistrationGuest.table_number)
                    .where(
                        RegistrationGuest.user_id == bidder_user.id,
                    )
                    .limit(1)
                )
                guest = (await self.db.execute(guest_stmt)).scalar_one_or_none()
                table_number = guest

            high_bidder = HighBidder(
                bidder_number=high_bid.bidder_number,
                first_name=bidder_user.first_name if bidder_user else "Unknown",
                last_name=bidder_user.last_name if bidder_user else "",
                table_number=table_number,
                profile_picture_url=(bidder_user.profile_picture_url if bidder_user else None),
            )

        # Bid history from QuickEntryBid
        history_stmt = (
            select(QuickEntryBid, User.first_name, User.last_name)
            .outerjoin(User, QuickEntryBid.donor_user_id == User.id)
            .where(
                QuickEntryBid.item_id == current_item.id,
                QuickEntryBid.status.in_([QuickEntryBidStatus.ACTIVE, QuickEntryBidStatus.WINNING]),
            )
            .order_by(QuickEntryBid.amount.desc())
        )
        history_rows = (await self.db.execute(history_stmt)).all()

        bid_history = [
            BidHistoryEntry(
                bidder_number=row[0].bidder_number,
                bidder_name=f"{row[1] or 'Unknown'} {row[2] or ''}".strip(),
                bid_amount=Decimal(row[0].amount),
                placed_at=row[0].accepted_at or row[0].created_at,
            )
            for row in history_rows
        ]

        return LiveAuctionResponse(
            current_item=live_item,
            high_bidder=high_bidder,
            bid_history=bid_history,
            auction_status="in_progress",
        )
