"""Service for auction bid operations."""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import func, not_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.selectable import Subquery

from app.models.auction_bid import (
    AuctionBid,
    BidActionAudit,
    BidActionType,
    BidStatus,
    BidType,
    PaddleRaiseContribution,
    TransactionStatus,
)
from app.models.auction_item import AuctionItem, AuctionType
from app.models.event_registration import EventRegistration
from app.models.registration_guest import RegistrationGuest

logger = logging.getLogger(__name__)


class AuctionBidService:
    """Service for auction bid operations."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _publish_bid_update(self, bid: AuctionBid) -> None:
        """Publish bid update for real-time clients (placeholder hook)."""
        logger.info(
            "Bid update published",
            extra={
                "event_id": str(bid.event_id),
                "auction_item_id": str(bid.auction_item_id),
                "bid_id": str(bid.id),
                "bid_status": bid.bid_status,
            },
        )

    async def _get_auction_item(self, item_id: UUID) -> AuctionItem:
        stmt = select(AuctionItem).where(AuctionItem.id == item_id)
        result = await self.db.execute(stmt)
        item = result.scalar_one_or_none()
        if not item:
            raise ValueError("Auction item not found")
        return item

    async def _get_bidder_number(self, event_id: UUID, user_id: UUID) -> int:
        stmt = (
            select(RegistrationGuest.bidder_number)
            .join(EventRegistration, RegistrationGuest.registration_id == EventRegistration.id)
            .where(
                EventRegistration.event_id == event_id,
                RegistrationGuest.user_id == user_id,
            )
        )
        result = await self.db.execute(stmt)
        bidder_number = result.scalar_one_or_none()
        if bidder_number is None:
            raise ValueError("Bidder number not found for user in this event")
        return bidder_number

    async def _latest_bid_records_for_item(self, item_id: UUID) -> list[AuctionBid]:
        subq = (
            select(AuctionBid.source_bid_id).where(AuctionBid.source_bid_id.isnot(None)).subquery()
        )
        stmt = select(AuctionBid).where(
            AuctionBid.auction_item_id == item_id,
            not_(AuctionBid.id.in_(select(subq.c.source_bid_id))),
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def _current_high_bid(self, item_id: UUID) -> AuctionBid | None:
        latest = await self._latest_bid_records_for_item(item_id)
        active = [
            bid
            for bid in latest
            if bid.bid_status in {BidStatus.ACTIVE.value, BidStatus.WINNING.value}
        ]
        if not active:
            return None
        return sorted(active, key=lambda bid: (bid.bid_amount, bid.placed_at), reverse=True)[0]

    async def _create_status_copy(
        self,
        bid: AuctionBid,
        new_status: BidStatus | None = None,
        new_transaction_status: TransactionStatus | None = None,
        actor_user_id: UUID | None = None,
    ) -> AuctionBid:
        status = new_status.value if new_status else bid.bid_status
        transaction_status = (
            new_transaction_status.value if new_transaction_status else bid.transaction_status
        )
        copy_bid = AuctionBid(
            event_id=bid.event_id,
            auction_item_id=bid.auction_item_id,
            user_id=bid.user_id,
            bidder_number=bid.bidder_number,
            bid_amount=bid.bid_amount,
            max_bid=bid.max_bid,
            bid_type=bid.bid_type,
            bid_status=status,
            transaction_status=transaction_status,
            placed_at=datetime.now(UTC),
            source_bid_id=bid.id,
            created_by=actor_user_id or bid.user_id,
        )
        self.db.add(copy_bid)
        await self.db.flush()
        return copy_bid

    async def _log_admin_action(
        self,
        bid_id: UUID,
        actor_user_id: UUID,
        action_type: BidActionType,
        reason: str,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        audit = BidActionAudit(
            bid_id=bid_id,
            actor_user_id=actor_user_id,
            action_type=action_type.value,
            reason=reason,
            action_metadata=metadata or {},
        )
        self.db.add(audit)

    async def _outbid_previous(self, previous_bid: AuctionBid, actor_user_id: UUID) -> None:
        await self._create_status_copy(
            previous_bid, new_status=BidStatus.OUTBID, actor_user_id=actor_user_id
        )

    async def place_bid(
        self,
        user_id: UUID,
        event_id: UUID,
        auction_item_id: UUID,
        bid_amount: Decimal,
        bid_type: BidType,
        max_bid: Decimal | None = None,
    ) -> AuctionBid:
        item = await self._get_auction_item(auction_item_id)
        if item.event_id != event_id:
            raise ValueError("Auction item does not belong to the event")

        bidder_number = await self._get_bidder_number(event_id, user_id)

        if item.auction_type == AuctionType.LIVE.value and max_bid is not None:
            raise ValueError("Max bid is only allowed for silent auction items")

        current_high = await self._current_high_bid(auction_item_id)
        min_bid = (
            item.starting_bid
            if current_high is None
            else current_high.bid_amount + item.bid_increment
        )

        if bid_type == BidType.BUY_NOW:
            if not item.buy_now_enabled or item.buy_now_price is None:
                raise ValueError("Buy now is not enabled for this item")
            if bid_amount != item.buy_now_price:
                raise ValueError("Buy now bids must equal the buy now price")

            winning_count_stmt = select(func.count()).where(
                AuctionBid.auction_item_id == auction_item_id,
                AuctionBid.bid_status == BidStatus.WINNING.value,
            )
            winning_count = (await self.db.execute(winning_count_stmt)).scalar_one()
            if winning_count >= item.quantity_available:
                raise ValueError("No buy-now quantity remaining")

            new_bid = AuctionBid(
                event_id=event_id,
                auction_item_id=auction_item_id,
                user_id=user_id,
                bidder_number=bidder_number,
                bid_amount=bid_amount,
                max_bid=None,
                bid_type=BidType.BUY_NOW.value,
                bid_status=BidStatus.WINNING.value,
                transaction_status=TransactionStatus.PENDING.value,
                placed_at=datetime.now(UTC),
                source_bid_id=None,
                created_by=user_id,
            )
            self.db.add(new_bid)
            await self.db.flush()

            if current_high and current_high.user_id != user_id:
                await self._outbid_previous(current_high, actor_user_id=user_id)

            await self.db.commit()
            await self._publish_bid_update(new_bid)
            return new_bid

        if bid_type == BidType.PROXY_AUTO and item.auction_type != AuctionType.SILENT.value:
            raise ValueError("Proxy auto bids are only for silent auctions")

        if max_bid is not None:
            if max_bid < min_bid:
                raise ValueError("Max bid must be at least the minimum required bid")
            bid_amount = min_bid

        if bid_amount < min_bid:
            raise ValueError("Bid amount is below the minimum required bid")

        new_bid = AuctionBid(
            event_id=event_id,
            auction_item_id=auction_item_id,
            user_id=user_id,
            bidder_number=bidder_number,
            bid_amount=bid_amount,
            max_bid=max_bid,
            bid_type=bid_type.value,
            bid_status=BidStatus.ACTIVE.value,
            transaction_status=TransactionStatus.PENDING.value,
            placed_at=datetime.now(UTC),
            source_bid_id=None,
            created_by=user_id,
        )
        self.db.add(new_bid)
        await self.db.flush()

        if (
            current_high
            and current_high.user_id != user_id
            and bid_amount > current_high.bid_amount
        ):
            await self._outbid_previous(current_high, actor_user_id=user_id)

        await self._apply_proxy_bidding(item, starting_high_bid=new_bid)

        await self.db.commit()
        await self._publish_bid_update(new_bid)
        return new_bid

    async def _apply_proxy_bidding(self, item: AuctionItem, starting_high_bid: AuctionBid) -> None:
        if item.auction_type != AuctionType.SILENT.value:
            return

        current_high = starting_high_bid
        iterations = 0
        while iterations < 20:
            iterations += 1
            latest = await self._latest_bid_records_for_item(item.id)
            active_latest = [
                bid
                for bid in latest
                if bid.bid_status == BidStatus.ACTIVE.value and bid.max_bid is not None
            ]
            candidates = [bid for bid in active_latest if bid.user_id != current_high.user_id]
            if not candidates:
                break

            candidates.sort(key=lambda bid: (-Decimal(bid.max_bid or 0), bid.placed_at))
            best = candidates[0]
            next_amount = current_high.bid_amount + item.bid_increment
            if best.max_bid is None or best.max_bid < next_amount:
                break

            auto_bid = AuctionBid(
                event_id=item.event_id,
                auction_item_id=item.id,
                user_id=best.user_id,
                bidder_number=best.bidder_number,
                bid_amount=next_amount,
                max_bid=best.max_bid,
                bid_type=BidType.PROXY_AUTO.value,
                bid_status=BidStatus.ACTIVE.value,
                transaction_status=TransactionStatus.PENDING.value,
                placed_at=datetime.now(UTC),
                source_bid_id=None,
                created_by=best.user_id,
            )
            self.db.add(auto_bid)
            await self.db.flush()

            await self._outbid_previous(current_high, actor_user_id=best.user_id)
            current_high = auto_bid

    async def list_item_bids(
        self, auction_item_id: UUID, page: int, per_page: int
    ) -> tuple[list[AuctionBid], int]:
        stmt = select(AuctionBid).where(AuctionBid.auction_item_id == auction_item_id)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()
        stmt = (
            stmt.order_by(AuctionBid.placed_at.asc()).offset((page - 1) * per_page).limit(per_page)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total

    async def _latest_bid_records_for_item_subquery(self) -> Subquery:
        subq = (
            select(AuctionBid.source_bid_id).where(AuctionBid.source_bid_id.isnot(None)).subquery()
        )
        return (
            select(AuctionBid.id)
            .where(not_(AuctionBid.id.in_(select(subq.c.source_bid_id))))
            .subquery()
        )

    async def list_bidder_bids(
        self, bidder_number: int, page: int, per_page: int
    ) -> tuple[list[AuctionBid], int]:
        stmt = select(AuctionBid).where(AuctionBid.bidder_number == bidder_number)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()
        stmt = (
            stmt.order_by(AuctionBid.placed_at.desc()).offset((page - 1) * per_page).limit(per_page)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total

    async def mark_winning(self, bid_id: UUID, actor_user_id: UUID, reason: str) -> AuctionBid:
        bid = await self._get_bid_by_id(bid_id)
        winning_bid = await self._create_status_copy(
            bid, new_status=BidStatus.WINNING, actor_user_id=actor_user_id
        )
        await self._log_admin_action(
            bid_id=winning_bid.id,
            actor_user_id=actor_user_id,
            action_type=BidActionType.MARK_WINNING,
            reason=reason,
            metadata={"previous_bid_id": str(bid.id)},
        )

        current_high = await self._current_high_bid(bid.auction_item_id)
        if current_high and current_high.id != winning_bid.id:
            await self._outbid_previous(current_high, actor_user_id=actor_user_id)

        await self.db.commit()
        await self._publish_bid_update(winning_bid)
        return winning_bid

    async def adjust_bid_amount(
        self,
        bid_id: UUID,
        actor_user_id: UUID,
        new_amount: Decimal,
        reason: str,
    ) -> AuctionBid:
        bid = await self._get_bid_by_id(bid_id)
        adjusted_bid = AuctionBid(
            event_id=bid.event_id,
            auction_item_id=bid.auction_item_id,
            user_id=bid.user_id,
            bidder_number=bid.bidder_number,
            bid_amount=new_amount,
            max_bid=bid.max_bid,
            bid_type=bid.bid_type,
            bid_status=bid.bid_status,
            transaction_status=bid.transaction_status,
            placed_at=datetime.now(UTC),
            source_bid_id=bid.id,
            created_by=actor_user_id,
        )
        self.db.add(adjusted_bid)
        await self.db.flush()
        await self._log_admin_action(
            bid_id=adjusted_bid.id,
            actor_user_id=actor_user_id,
            action_type=BidActionType.ADJUST_AMOUNT,
            reason=reason,
            metadata={"previous_bid_id": str(bid.id), "new_amount": str(new_amount)},
        )
        await self.db.commit()
        await self._publish_bid_update(adjusted_bid)
        return adjusted_bid

    async def cancel_bid(self, bid_id: UUID, actor_user_id: UUID, reason: str) -> AuctionBid:
        bid = await self._get_bid_by_id(bid_id)
        cancelled_bid = await self._create_status_copy(
            bid, new_status=BidStatus.CANCELLED, actor_user_id=actor_user_id
        )
        await self._log_admin_action(
            bid_id=cancelled_bid.id,
            actor_user_id=actor_user_id,
            action_type=BidActionType.CANCEL,
            reason=reason,
            metadata={"previous_bid_id": str(bid.id)},
        )
        await self.db.commit()
        await self._publish_bid_update(cancelled_bid)
        return cancelled_bid

    async def override_transaction_status(
        self,
        bid_id: UUID,
        actor_user_id: UUID,
        new_status: TransactionStatus,
        reason: str,
    ) -> AuctionBid:
        bid = await self._get_bid_by_id(bid_id)
        updated_bid = await self._create_status_copy(
            bid,
            new_transaction_status=new_status,
            actor_user_id=actor_user_id,
        )
        await self._log_admin_action(
            bid_id=updated_bid.id,
            actor_user_id=actor_user_id,
            action_type=BidActionType.OVERRIDE_PAYMENT,
            reason=reason,
            metadata={"previous_bid_id": str(bid.id), "transaction_status": new_status.value},
        )
        await self.db.commit()
        await self._publish_bid_update(updated_bid)
        return updated_bid

    async def record_paddle_raise(
        self,
        user_id: UUID,
        event_id: UUID,
        amount: Decimal,
        tier_name: str,
    ) -> PaddleRaiseContribution:
        bidder_number = await self._get_bidder_number(event_id, user_id)
        contribution = PaddleRaiseContribution(
            event_id=event_id,
            user_id=user_id,
            bidder_number=bidder_number,
            amount=amount,
            tier_name=tier_name,
            placed_at=datetime.now(UTC),
        )
        self.db.add(contribution)
        await self.db.commit()
        await self.db.refresh(contribution)
        return contribution

    async def _get_bid_by_id(self, bid_id: UUID) -> AuctionBid:
        stmt = select(AuctionBid).where(AuctionBid.id == bid_id)
        result = await self.db.execute(stmt)
        bid = result.scalar_one_or_none()
        if not bid:
            raise ValueError("Bid not found")
        return bid

    async def report_winning_bids(
        self,
        transaction_status: TransactionStatus | None = None,
        auction_type: AuctionType | None = None,
    ) -> list[dict[str, Any]]:
        latest = await self._latest_bid_records_for_item_subquery()
        stmt = (
            select(AuctionBid, AuctionItem)
            .join(AuctionItem)
            .where(
                AuctionBid.id.in_(select(latest.c.id)),
                AuctionBid.bid_status == BidStatus.WINNING.value,
            )
        )
        if transaction_status:
            stmt = stmt.where(AuctionBid.transaction_status == transaction_status.value)
        if auction_type:
            stmt = stmt.where(AuctionItem.auction_type == auction_type.value)
        result = await self.db.execute(stmt)
        rows = result.all()
        return [
            {
                "bid_id": bid.id,
                "auction_item_id": bid.auction_item_id,
                "bidder_number": bid.bidder_number,
                "bid_amount": bid.bid_amount,
                "bid_status": bid.bid_status,
                "transaction_status": bid.transaction_status,
                "auction_type": item.auction_type,
                "placed_at": bid.placed_at,
            }
            for bid, item in rows
        ]

    async def report_unprocessed_transactions(self) -> list[dict[str, Any]]:
        latest = await self._latest_bid_records_for_item_subquery()
        stmt = select(AuctionBid).where(
            AuctionBid.id.in_(select(latest.c.id)),
            AuctionBid.bid_status == BidStatus.WINNING.value,
            AuctionBid.transaction_status.in_(
                [TransactionStatus.PENDING.value, TransactionStatus.PROCESSING.value]
            ),
        )
        result = await self.db.execute(stmt)
        bids = result.scalars().all()
        return [
            {
                "bid_id": bid.id,
                "auction_item_id": bid.auction_item_id,
                "bidder_number": bid.bidder_number,
                "bid_amount": bid.bid_amount,
                "transaction_status": bid.transaction_status,
                "placed_at": bid.placed_at,
            }
            for bid in bids
        ]

    async def report_bidder_analytics(
        self,
        bidder_number: int | None = None,
        auction_type: AuctionType | None = None,
    ) -> list[dict[str, Any]]:
        latest = await self._latest_bid_records_for_item_subquery()
        stmt = (
            select(AuctionBid, AuctionItem)
            .join(AuctionItem)
            .where(AuctionBid.id.in_(select(latest.c.id)))
        )
        if bidder_number:
            stmt = stmt.where(AuctionBid.bidder_number == bidder_number)
        if auction_type:
            stmt = stmt.where(AuctionItem.auction_type == auction_type.value)
        result = await self.db.execute(stmt)
        rows = result.all()

        by_bidder: dict[int, dict[str, Any]] = defaultdict(
            lambda: {
                "bidder_number": 0,
                "total_won": Decimal("0.00"),
                "total_lost": Decimal("0.00"),
                "total_unprocessed": Decimal("0.00"),
                "total_max_potential": Decimal("0.00"),
                "live_total": Decimal("0.00"),
                "silent_total": Decimal("0.00"),
                "paddle_raise_total": Decimal("0.00"),
                "bidding_war_count": 0,
                "proxy_usage_rate": Decimal("0.00"),
                "_total_bids": 0,
                "_proxy_bids": 0,
            }
        )

        for bid, item in rows:
            entry = by_bidder[bid.bidder_number]
            entry["bidder_number"] = bid.bidder_number
            entry["_total_bids"] += 1
            if bid.bid_type == BidType.PROXY_AUTO.value or bid.max_bid is not None:
                entry["_proxy_bids"] += 1

            if bid.bid_status == BidStatus.WINNING.value:
                entry["total_won"] += bid.bid_amount
                if bid.transaction_status in {
                    TransactionStatus.PENDING.value,
                    TransactionStatus.PROCESSING.value,
                }:
                    entry["total_unprocessed"] += bid.bid_amount
            elif bid.bid_status == BidStatus.OUTBID.value:
                entry["total_lost"] += bid.bid_amount

            if bid.max_bid is not None:
                entry["total_max_potential"] += bid.max_bid

            if item.auction_type == AuctionType.LIVE.value:
                entry["live_total"] += bid.bid_amount
            else:
                entry["silent_total"] += bid.bid_amount

        paddle_stmt = select(
            PaddleRaiseContribution.bidder_number,
            func.sum(PaddleRaiseContribution.amount),
        ).group_by(PaddleRaiseContribution.bidder_number)
        if bidder_number:
            paddle_stmt = paddle_stmt.where(PaddleRaiseContribution.bidder_number == bidder_number)
        paddle_results = await self.db.execute(paddle_stmt)
        for bidder_num, total in paddle_results.all():
            by_bidder[bidder_num]["paddle_raise_total"] = total or Decimal("0.00")

        for entry in by_bidder.values():
            if entry["_total_bids"] > 0:
                entry["proxy_usage_rate"] = Decimal(entry["_proxy_bids"]) / Decimal(
                    entry["_total_bids"]
                )
            entry.pop("_total_bids")
            entry.pop("_proxy_bids")

        return list(by_bidder.values())

    async def report_item_performance(self) -> list[dict[str, Any]]:
        stmt = select(AuctionItem, AuctionBid).join(
            AuctionBid, AuctionBid.auction_item_id == AuctionItem.id, isouter=True
        )
        result = await self.db.execute(stmt)
        rows = result.all()

        by_item: dict[UUID, dict[str, Any]] = {}
        for item, bid in rows:
            entry = by_item.setdefault(
                item.id,
                {
                    "auction_item_id": item.id,
                    "total_bids": 0,
                    "unique_bidders": set(),
                    "starting_bid": item.starting_bid,
                    "final_price": Decimal("0.00"),
                    "revenue_total": Decimal("0.00"),
                    "proxy_used": False,
                },
            )
            if bid:
                entry["total_bids"] += 1
                entry["unique_bidders"].add(bid.bidder_number)
                entry["final_price"] = max(entry["final_price"], bid.bid_amount)
                entry["revenue_total"] = max(entry["revenue_total"], bid.bid_amount)
                if bid.max_bid is not None or bid.bid_type == BidType.PROXY_AUTO.value:
                    entry["proxy_used"] = True

        return [
            {
                "auction_item_id": entry["auction_item_id"],
                "total_bids": entry["total_bids"],
                "unique_bidders": len(entry["unique_bidders"]),
                "starting_bid": entry["starting_bid"],
                "final_price": entry["final_price"],
                "revenue_total": entry["revenue_total"],
                "proxy_used": entry["proxy_used"],
            }
            for entry in by_item.values()
        ]

    async def report_bidding_wars(self) -> list[dict[str, Any]]:
        stmt = select(AuctionBid).order_by(AuctionBid.placed_at.asc())
        result = await self.db.execute(stmt)
        bids = result.scalars().all()

        by_item: dict[UUID, list[AuctionBid]] = defaultdict(list)
        for bid in bids:
            by_item[bid.auction_item_id].append(bid)

        reports: list[dict[str, Any]] = []
        for item_id, item_bids in by_item.items():
            if len(item_bids) < 2:
                continue
            participant_count = len({bid.bidder_number for bid in item_bids})
            duration_minutes = max(
                Decimal("1"),
                Decimal((item_bids[-1].placed_at - item_bids[0].placed_at).total_seconds())
                / Decimal(60),
            )
            bid_frequency = Decimal(len(item_bids)) / duration_minutes
            escalation_amount = max(bid.bid_amount for bid in item_bids) - min(
                bid.bid_amount for bid in item_bids
            )
            intensity_score = (
                Decimal("0.5") * bid_frequency
                + Decimal("0.3") * Decimal(participant_count)
                + Decimal("0.2") * escalation_amount
            )
            intensity_score = min(Decimal("100"), intensity_score)

            manual_count = len(
                [bid for bid in item_bids if bid.bid_type != BidType.PROXY_AUTO.value]
            )
            proxy_count = len(
                [bid for bid in item_bids if bid.bid_type == BidType.PROXY_AUTO.value]
            )
            manual_vs_proxy_ratio = (
                Decimal(manual_count) / Decimal(proxy_count)
                if proxy_count > 0
                else Decimal(manual_count)
            )

            reports.append(
                {
                    "auction_item_id": item_id,
                    "participant_count": participant_count,
                    "bid_frequency": bid_frequency,
                    "escalation_amount": escalation_amount,
                    "intensity_score": intensity_score,
                    "manual_vs_proxy_ratio": manual_vs_proxy_ratio,
                }
            )

        return reports

    async def report_high_value_donors(self) -> list[dict[str, Any]]:
        analytics = await self.report_bidder_analytics()
        reports: list[dict[str, Any]] = []
        for entry in analytics:
            winning_total = entry["total_won"]
            paddle_total = entry["paddle_raise_total"]
            reports.append(
                {
                    "bidder_number": entry["bidder_number"],
                    "total_giving_potential": winning_total + paddle_total,
                    "winning_total": winning_total,
                    "paddle_raise_total": paddle_total,
                }
            )
        reports.sort(key=lambda row: row["total_giving_potential"], reverse=True)
        return reports
