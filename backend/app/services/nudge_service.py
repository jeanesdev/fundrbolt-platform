"""NudgeService: computes real-time revenue nudges for live events."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import and_, func, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.auction_bid import AuctionBid, BidStatus, PaddleRaiseContribution
from app.models.auction_item import AuctionItem
from app.models.event import Event
from app.models.event_nudge_dismissal import EventNudgeDismissal, NudgeDismissalAction
from app.models.event_registration import EventRegistration
from app.models.registration_guest import RegistrationGuest
from app.models.revenue_generator_entry import RevenueGeneratorEntry
from app.models.revenue_generator_item import RevenueGeneratorItem
from app.models.watch_list_entry import WatchListEntry
from app.schemas.nudge import (
    GOAL_MILESTONE_THRESHOLDS,
    NUDGE_BASE_RANKS,
    DismissNudgeResponse,
    NudgeItem,
    NudgesResponse,
    NudgeType,
)

logger = get_logger(__name__)

_RANK_MIN = 1
_RANK_MAX = 5


def _clamp(rank: int) -> int:
    return max(_RANK_MIN, min(_RANK_MAX, rank))


class NudgeService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def compute_all_nudges(self, event_id: uuid.UUID) -> list[NudgeItem]:
        """Compute all nudges without dismissal filtering."""
        event = await self._get_event(event_id)
        if not event:
            return []

        closing_soon_minutes = getattr(event, "nudge_closing_soon_minutes", 20)

        nudges: list[NudgeItem] = []

        async def extend_from(label: str, coro: Any) -> None:
            try:
                result = await coro
            except Exception:
                logger.exception("%s compute failed", label)
                return

            if isinstance(result, list):
                nudges.extend(result)
            elif result is not None:
                nudges.append(result)

        await extend_from("watchers_no_bid", self._compute_watchers_no_bid(event_id))
        await extend_from("items_no_bids", self._compute_items_no_bids(event_id, event))
        await extend_from("items_most_bids", self._compute_items_most_bids(event_id))
        await extend_from(
            "closing_soon_watchers",
            self._compute_closing_soon_watchers(event_id, closing_soon_minutes),
        )
        await extend_from("outbid_still_watching", self._compute_outbid_still_watching(event_id))
        await extend_from(
            "non_participating_attendees",
            self._compute_non_participating_attendees(event_id),
        )
        await extend_from(
            "revenue_generator_participation",
            self._compute_revenue_generator_participation(event_id),
        )
        await extend_from(
            "revenue_generators_not_started",
            self._compute_revenue_generators_not_started(event_id),
        )
        await extend_from("goal_progress", self._compute_goal_progress(event_id, event))
        await extend_from("pareto_donors", self._compute_pareto_donors(event_id))
        await extend_from("paddle_raise_momentum", self._compute_paddle_raise_momentum(event_id))
        return nudges

    async def get_nudges(
        self,
        event_id: uuid.UUID,
        user_id: uuid.UUID,
        include_dismissed: bool = False,
    ) -> NudgesResponse:
        all_nudges = await self.compute_all_nudges(event_id)
        dismissed_keys = await self._get_dismissed_keys(event_id, user_id)

        filtered: list[NudgeItem] = []
        for nudge in all_nudges:
            if nudge.nudge_key in dismissed_keys:
                if include_dismissed:
                    nudge = nudge.model_copy(update={"is_dismissed": True})
                    filtered.append(nudge)
            else:
                filtered.append(nudge)

        def sort_key(n: NudgeItem) -> tuple[int, int, int]:
            is_goal_progress = 1 if n.nudge_type == NudgeType.GOAL_PROGRESS else 0
            return (is_goal_progress, n.rank, -n.affected_count)

        filtered.sort(key=sort_key)
        active_count = sum(1 for n in filtered if not n.is_dismissed)

        return NudgesResponse(
            nudges=filtered,
            total_count=len(filtered),
            active_count=active_count,
            computed_at=datetime.now(UTC),
        )

    async def dismiss_nudge(
        self,
        event_id: uuid.UUID,
        user_id: uuid.UUID,
        nudge_key: str,
        action: str,
    ) -> DismissNudgeResponse:
        now = datetime.now(UTC)
        if action == NudgeDismissalAction.DISMISSED.value:
            expires_at: datetime | None = now + timedelta(minutes=30)
        else:
            expires_at = now + timedelta(hours=24)

        stmt = pg_insert(EventNudgeDismissal).values(
            id=uuid.uuid4(),
            event_id=event_id,
            user_id=user_id,
            nudge_key=nudge_key,
            action=action,
            expires_at=expires_at,
            created_at=now,
        )
        stmt = stmt.on_conflict_do_update(
            constraint="uq_event_nudge_dismissals",
            set_={"action": action, "expires_at": expires_at},
        )
        await self.db.execute(stmt)
        await self.db.commit()

        return DismissNudgeResponse(
            nudge_key=nudge_key,
            action=action,
            expires_at=expires_at,
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _get_event(self, event_id: uuid.UUID) -> Event | None:
        result = await self.db.execute(select(Event).where(Event.id == event_id))
        return result.scalar_one_or_none()

    async def _get_dismissed_keys(self, event_id: uuid.UUID, user_id: uuid.UUID) -> set[str]:
        now = datetime.now(UTC)
        result = await self.db.execute(
            select(EventNudgeDismissal.nudge_key).where(
                EventNudgeDismissal.event_id == event_id,
                EventNudgeDismissal.user_id == user_id,
                or_(
                    EventNudgeDismissal.expires_at.is_(None),
                    EventNudgeDismissal.expires_at > now,
                ),
            )
        )
        return {row[0] for row in result.fetchall()}

    # ------------------------------------------------------------------
    # Compute methods
    # ------------------------------------------------------------------

    async def _compute_watchers_no_bid(self, event_id: uuid.UUID) -> list[NudgeItem]:
        """Summary nudge: auction items with watchers who haven't bid."""
        watcher_sq = (
            select(
                WatchListEntry.item_id,
                func.count(WatchListEntry.user_id).label("watcher_count"),
            )
            .where(WatchListEntry.event_id == event_id)
            .group_by(WatchListEntry.item_id)
            .subquery()
        )

        watchers_no_bid_sq = (
            select(
                WatchListEntry.item_id,
                func.count(WatchListEntry.user_id).label("unwatched_bidder_count"),
            )
            .outerjoin(
                AuctionBid,
                and_(
                    AuctionBid.auction_item_id == WatchListEntry.item_id,
                    AuctionBid.user_id == WatchListEntry.user_id,
                    AuctionBid.event_id == event_id,
                    AuctionBid.bid_status.in_(
                        [BidStatus.ACTIVE, BidStatus.WINNING, BidStatus.OUTBID]
                    ),
                ),
            )
            .where(
                WatchListEntry.event_id == event_id,
                AuctionBid.id.is_(None),
            )
            .group_by(WatchListEntry.item_id)
            .subquery()
        )

        count_result = await self.db.execute(select(func.count()).select_from(watchers_no_bid_sq))
        item_count = count_result.scalar() or 0

        if item_count == 0:
            return []

        top_items_result = await self.db.execute(
            select(
                AuctionItem.id,
                AuctionItem.title,
                watcher_sq.c.watcher_count,
            )
            .join(watcher_sq, AuctionItem.id == watcher_sq.c.item_id)
            .join(watchers_no_bid_sq, AuctionItem.id == watchers_no_bid_sq.c.item_id)
            .where(AuctionItem.event_id == event_id)
            .order_by(watcher_sq.c.watcher_count.desc())
            .limit(3)
        )
        top_items = [
            {
                "item_id": str(row.id),
                "item_name": row.title,
                "watcher_count": row.watcher_count,
            }
            for row in top_items_result.fetchall()
        ]

        return [
            NudgeItem(
                nudge_key="watchers_no_bid",
                nudge_type=NudgeType.WATCHERS_NO_BID,
                rank=NUDGE_BASE_RANKS[NudgeType.WATCHERS_NO_BID],
                title="Watchers Without Bids",
                description=(
                    f"{item_count} auction item{'s' if item_count != 1 else ''} "
                    f"have watchers who haven't placed a bid yet."
                ),
                action_url=f"/events/{event_id}/auction-dashboard",
                action_label="View Auction",
                affected_count=item_count,
                metadata={"item_count": item_count, "top_items": top_items},
                is_dismissible=True,
                notifies_on_appear=True,
            )
        ]

    async def _compute_items_no_bids(self, event_id: uuid.UUID, event: Event) -> list[NudgeItem]:
        """Items with no bids at all."""
        bid_sq = (
            select(AuctionBid.auction_item_id)
            .where(
                AuctionBid.event_id == event_id,
                AuctionBid.bid_status.in_([BidStatus.ACTIVE, BidStatus.WINNING, BidStatus.OUTBID]),
            )
            .distinct()
            .subquery()
        )
        result = await self.db.execute(
            select(AuctionItem.id, AuctionItem.title)
            .outerjoin(bid_sq, AuctionItem.id == bid_sq.c.auction_item_id)
            .where(AuctionItem.event_id == event_id, bid_sq.c.auction_item_id.is_(None))
        )
        rows = result.fetchall()
        count = len(rows)
        if count == 0:
            return []

        item_names = [row.title for row in rows[:5]]

        base_rank = NUDGE_BASE_RANKS[NudgeType.ITEMS_NO_BIDS]
        rank = base_rank
        now = datetime.now(UTC)
        auction_close = getattr(event, "auction_close_datetime", None)
        closing_soon = (
            auction_close is not None
            and (
                (
                    auction_close.replace(tzinfo=UTC)
                    if auction_close.tzinfo is None
                    else auction_close
                )
                - now
            ).total_seconds()
            < 3600
        )
        if count > 5 or closing_soon:
            rank = 2
        rank = _clamp(rank)

        return [
            NudgeItem(
                nudge_key="items_no_bids",
                nudge_type=NudgeType.ITEMS_NO_BIDS,
                rank=rank,
                title="Items With No Bids",
                description=(
                    f"{count} auction item{'s have' if count != 1 else ' has'} "
                    f"no bids yet. Draw attention to them!"
                ),
                action_url=f"/events/{event_id}/auction-items?filter=no_bids",
                action_label="View Items",
                affected_count=count,
                metadata={"item_names": item_names},
                is_dismissible=True,
                notifies_on_appear=rank <= 2,
            )
        ]

    async def _compute_items_most_bids(self, event_id: uuid.UUID) -> list[NudgeItem]:
        """Top 3 items by bid count — informational only."""
        result = await self.db.execute(
            select(
                AuctionItem.id,
                AuctionItem.title,
                func.count(AuctionBid.id).label("bid_count"),
            )
            .join(AuctionBid, AuctionItem.id == AuctionBid.auction_item_id)
            .where(
                AuctionItem.event_id == event_id,
                AuctionBid.bid_status.in_([BidStatus.ACTIVE, BidStatus.WINNING, BidStatus.OUTBID]),
            )
            .group_by(AuctionItem.id, AuctionItem.title)
            .order_by(func.count(AuctionBid.id).desc())
            .limit(3)
        )
        rows = result.fetchall()
        if not rows:
            return []

        top_items = [
            {"item_id": str(row.id), "item_name": row.title, "bid_count": row.bid_count}
            for row in rows
        ]
        top_bid_count = rows[0].bid_count

        return [
            NudgeItem(
                nudge_key="items_most_bids",
                nudge_type=NudgeType.ITEMS_MOST_BIDS,
                rank=NUDGE_BASE_RANKS[NudgeType.ITEMS_MOST_BIDS],
                title="Hottest Auction Items",
                description=(
                    f"Top item has {top_bid_count} bid{'s' if top_bid_count != 1 else ''}. "
                    f"Highlight these to drive excitement!"
                ),
                action_url=f"/events/{event_id}/auction-dashboard",
                action_label="View Dashboard",
                affected_count=top_bid_count,
                metadata={"top_items": top_items},
                is_dismissible=True,
                notifies_on_appear=False,
            )
        ]

    async def _compute_closing_soon_watchers(
        self, event_id: uuid.UUID, closing_soon_minutes: int
    ) -> list[NudgeItem]:
        """Nudge: auction is closing soon and there are items with watchers but no bids."""
        event = await self._get_event(event_id)
        if event is None:
            return []

        auction_close = getattr(event, "auction_close_datetime", None)
        if auction_close is None:
            return []

        now = datetime.now(UTC)
        if auction_close.tzinfo is None:
            auction_close = auction_close.replace(tzinfo=UTC)

        seconds_remaining = (auction_close - now).total_seconds()
        if seconds_remaining <= 0 or seconds_remaining > closing_soon_minutes * 60:
            return []

        minutes_remaining = int(seconds_remaining / 60)

        # Find items with watchers but no bids
        watcher_sq = (
            select(
                WatchListEntry.item_id,
                func.count(WatchListEntry.user_id).label("watcher_count"),
            )
            .where(WatchListEntry.event_id == event_id)
            .group_by(WatchListEntry.item_id)
            .subquery()
        )
        bid_sq = (
            select(AuctionBid.auction_item_id)
            .where(
                AuctionBid.event_id == event_id,
                AuctionBid.bid_status.in_([BidStatus.ACTIVE, BidStatus.WINNING, BidStatus.OUTBID]),
            )
            .distinct()
            .subquery()
        )

        result = await self.db.execute(
            select(
                AuctionItem.id,
                AuctionItem.title,
                watcher_sq.c.watcher_count,
            )
            .join(watcher_sq, AuctionItem.id == watcher_sq.c.item_id)
            .outerjoin(bid_sq, AuctionItem.id == bid_sq.c.auction_item_id)
            .where(
                AuctionItem.event_id == event_id,
                bid_sq.c.auction_item_id.is_(None),
            )
            .order_by(watcher_sq.c.watcher_count.desc())
        )
        unwatched_items = result.fetchall()
        if not unwatched_items:
            return []

        total_watchers = sum(row.watcher_count for row in unwatched_items)
        item_count = len(unwatched_items)

        return [
            NudgeItem(
                nudge_key="closing_soon_watchers",
                nudge_type=NudgeType.CLOSING_SOON_WATCHERS,
                rank=NUDGE_BASE_RANKS[NudgeType.CLOSING_SOON_WATCHERS],
                title="Auction Closing Soon — Watchers Without Bids!",
                description=(
                    f"Auction closes in {minutes_remaining} min. "
                    f"{item_count} item{'s have' if item_count != 1 else ' has'} "
                    f"{total_watchers} watcher{'s' if total_watchers != 1 else ''} but no bids."
                ),
                action_url=f"/events/{event_id}/auction-dashboard",
                action_label="View Auction",
                affected_count=total_watchers,
                metadata={
                    "minutes_remaining": minutes_remaining,
                    "item_count": item_count,
                    "total_watchers": total_watchers,
                    "top_items": [
                        {
                            "item_id": str(r.id),
                            "item_name": r.title,
                            "watcher_count": r.watcher_count,
                        }
                        for r in unwatched_items[:3]
                    ],
                },
                is_dismissible=True,
                notifies_on_appear=True,
            )
        ]

    async def _compute_outbid_still_watching(self, event_id: uuid.UUID) -> list[NudgeItem]:
        """Per-item nudge: users who are outbid but still watching."""
        outbid_sq = (
            select(AuctionBid.auction_item_id, AuctionBid.user_id)
            .where(
                AuctionBid.event_id == event_id,
                AuctionBid.bid_status == BidStatus.OUTBID,
            )
            .subquery()
        )
        result = await self.db.execute(
            select(
                WatchListEntry.item_id,
                AuctionItem.title,
                func.count(WatchListEntry.user_id).label("outbid_watcher_count"),
            )
            .join(AuctionItem, AuctionItem.id == WatchListEntry.item_id)
            .join(
                outbid_sq,
                and_(
                    WatchListEntry.item_id == outbid_sq.c.auction_item_id,
                    WatchListEntry.user_id == outbid_sq.c.user_id,
                ),
            )
            .where(WatchListEntry.event_id == event_id)
            .group_by(WatchListEntry.item_id, AuctionItem.title)
            .having(func.count(WatchListEntry.user_id) >= 2)
        )
        rows = result.fetchall()
        if not rows:
            return []

        nudges: list[NudgeItem] = []
        for row in rows:
            nudges.append(
                NudgeItem(
                    nudge_key=f"outbid_watching:{row.item_id}",
                    nudge_type=NudgeType.OUTBID_STILL_WATCHING,
                    rank=NUDGE_BASE_RANKS[NudgeType.OUTBID_STILL_WATCHING],
                    title="Outbid Watchers",
                    description=(
                        f"{row.outbid_watcher_count} outbid bidder"
                        f"{'s are' if row.outbid_watcher_count != 1 else ' is'} "
                        f"still watching '{row.title}' — nudge them back in!"
                    ),
                    action_url=(
                        f"/events/{event_id}/notifications"
                        f"?audience=outbid_watchers&item_id={row.item_id}"
                    ),
                    action_label="Notify Them",
                    affected_count=row.outbid_watcher_count,
                    metadata={
                        "item_name": row.title,
                        "outbid_watcher_count": row.outbid_watcher_count,
                    },
                    is_dismissible=True,
                    notifies_on_appear=False,
                )
            )
        return nudges

    async def _compute_non_participating_attendees(self, event_id: uuid.UUID) -> list[NudgeItem]:
        """Checked-in guests with no bids or donations."""
        from app.models.donation import Donation

        # Checked-in guest user_ids for this event (via EventRegistration)
        checkin_sq = (
            select(RegistrationGuest.user_id)
            .join(
                EventRegistration,
                RegistrationGuest.registration_id == EventRegistration.id,
            )
            .where(
                EventRegistration.event_id == event_id,
                RegistrationGuest.checked_in.is_(True),
                RegistrationGuest.user_id.is_not(None),
            )
            .distinct()
            .subquery()
        )
        # Users who have bid
        bid_sq = (
            select(AuctionBid.user_id).where(AuctionBid.event_id == event_id).distinct().subquery()
        )
        paddle_sq = (
            select(PaddleRaiseContribution.user_id)
            .where(PaddleRaiseContribution.event_id == event_id)
            .distinct()
            .subquery()
        )
        # Users who have donated
        donation_sq = (
            select(Donation.donor_user_id)
            .where(Donation.event_id == event_id)
            .distinct()
            .subquery()
        )

        result = await self.db.execute(
            select(func.count())
            .select_from(checkin_sq)
            .outerjoin(bid_sq, checkin_sq.c.user_id == bid_sq.c.user_id)
            .outerjoin(paddle_sq, checkin_sq.c.user_id == paddle_sq.c.user_id)
            .outerjoin(donation_sq, checkin_sq.c.user_id == donation_sq.c.donor_user_id)
            .where(
                bid_sq.c.user_id.is_(None),
                paddle_sq.c.user_id.is_(None),
                donation_sq.c.donor_user_id.is_(None),
            )
        )
        count = result.scalar() or 0
        if count == 0:
            return []

        base_rank = NUDGE_BASE_RANKS[NudgeType.NON_PARTICIPATING_ATTENDEES]
        rank = base_rank if count >= 5 else 3
        rank = _clamp(rank)

        return [
            NudgeItem(
                nudge_key="non_participating",
                nudge_type=NudgeType.NON_PARTICIPATING_ATTENDEES,
                rank=rank,
                title="Non-Participating Attendees",
                description=(
                    f"{count} checked-in attendee{'s have' if count != 1 else ' has'} "
                    f"not bid or donated. Nudge them to engage!"
                ),
                action_url=f"/events/{event_id}/donor-dashboard?filter=non_participating",
                action_label="View Attendees",
                affected_count=count,
                metadata={"non_participating_count": count},
                is_dismissible=True,
                notifies_on_appear=rank <= 2,
            )
        ]

    async def _compute_revenue_generator_participation(
        self, event_id: uuid.UUID
    ) -> list[NudgeItem]:
        """Per-RG nudge: revenue generators with low participation (<20%)."""
        attendee_count_result = await self.db.execute(
            select(func.count()).where(
                EventRegistration.event_id == event_id,
            )
        )
        attendee_count = attendee_count_result.scalar() or 0
        if attendee_count == 0:
            return []

        result = await self.db.execute(
            select(
                RevenueGeneratorItem.id,
                RevenueGeneratorItem.name,
                func.count(RevenueGeneratorEntry.id).label("entry_count"),
            )
            .outerjoin(
                RevenueGeneratorEntry,
                RevenueGeneratorEntry.revenue_generator_item_id == RevenueGeneratorItem.id,
            )
            .where(
                RevenueGeneratorItem.event_id == event_id,
                RevenueGeneratorItem.is_open_for_entries.is_(True),
            )
            .group_by(RevenueGeneratorItem.id, RevenueGeneratorItem.name)
        )
        rows = result.fetchall()

        nudges: list[NudgeItem] = []
        for row in rows:
            if row.entry_count == 0:
                continue
            pct = (row.entry_count / attendee_count) * 100
            if pct < 20:
                nudges.append(
                    NudgeItem(
                        nudge_key=f"rg_participation:{row.id}",
                        nudge_type=NudgeType.REVENUE_GENERATOR_LOW_PARTICIPATION,
                        rank=NUDGE_BASE_RANKS[NudgeType.REVENUE_GENERATOR_LOW_PARTICIPATION],
                        title="Low Revenue Generator Participation",
                        description=(
                            f'"{row.name}" only has {pct:.0f}% participation '
                            f"({row.entry_count}/{attendee_count} attendees)."
                        ),
                        action_url=(
                            f"/events/{event_id}/notifications"
                            f"?audience=non_purchasers&rg_item_id={row.id}"
                        ),
                        action_label="Boost Participation",
                        affected_count=row.entry_count,
                        metadata={
                            "rg_item_id": str(row.id),
                            "rg_name": row.name,
                            "participation_pct": round(pct, 1),
                            "entry_count": row.entry_count,
                            "attendee_count": attendee_count,
                        },
                        is_dismissible=True,
                        notifies_on_appear=False,
                    )
                )
        return nudges

    async def _compute_revenue_generators_not_started(self, event_id: uuid.UUID) -> list[NudgeItem]:
        """Single nudge: active RGs with zero entries."""
        result = await self.db.execute(
            select(RevenueGeneratorItem.id, RevenueGeneratorItem.name)
            .outerjoin(
                RevenueGeneratorEntry,
                RevenueGeneratorEntry.revenue_generator_item_id == RevenueGeneratorItem.id,
            )
            .where(
                RevenueGeneratorItem.event_id == event_id,
                RevenueGeneratorItem.is_open_for_entries.is_(True),
            )
            .group_by(RevenueGeneratorItem.id, RevenueGeneratorItem.name)
            .having(func.count(RevenueGeneratorEntry.id) == 0)
        )
        rows = result.fetchall()
        count = len(rows)
        if count == 0:
            return []

        names = [row.name for row in rows]
        return [
            NudgeItem(
                nudge_key="rg_not_started",
                nudge_type=NudgeType.REVENUE_GENERATORS_NOT_STARTED,
                rank=NUDGE_BASE_RANKS[NudgeType.REVENUE_GENERATORS_NOT_STARTED],
                title="Revenue Generators Not Started",
                description=(
                    f"{count} revenue generator{'s have' if count != 1 else ' has'} no entries yet."
                ),
                action_url=f"/events/{event_id}/revenue-generators",
                action_label="Promote Now",
                affected_count=count,
                metadata={"rg_names": names, "count": count},
                is_dismissible=True,
                notifies_on_appear=True,
            )
        ]

    async def _compute_goal_progress(self, event_id: uuid.UUID, event: Event) -> list[NudgeItem]:
        """Goal progress nudge (always) + milestone nudges (at 75/85/90/95/100%)."""
        goal = getattr(event, "fundraising_goal", None)
        if goal is None:
            return []

        goal_decimal = Decimal(str(goal))
        if goal_decimal <= 0:
            return []

        raised = await self._sum_total_revenue(event_id)
        pct = float(raised / goal_decimal * 100)

        nudges: list[NudgeItem] = [
            NudgeItem(
                nudge_key="goal_progress",
                nudge_type=NudgeType.GOAL_PROGRESS,
                rank=NUDGE_BASE_RANKS[NudgeType.GOAL_PROGRESS],
                title="Fundraising Goal Progress",
                description=(
                    f"You've raised ${raised:,.0f} of your ${goal_decimal:,.0f} goal "
                    f"({pct:.0f}% complete)."
                ),
                action_url=f"/events/{event_id}/dashboard",
                action_label="View Dashboard",
                affected_count=int(pct),
                metadata={
                    "raised_cents": int(raised * 100),
                    "goal_cents": int(goal_decimal * 100),
                    "pct": round(pct, 1),
                },
                is_dismissible=False,
                notifies_on_appear=False,
            )
        ]

        for threshold in GOAL_MILESTONE_THRESHOLDS:
            if pct >= threshold:
                nudges.append(
                    NudgeItem(
                        nudge_key=f"goal_milestone_{threshold}",
                        nudge_type=NudgeType.GOAL_MILESTONE_APPROACHING,
                        rank=NUDGE_BASE_RANKS[NudgeType.GOAL_MILESTONE_APPROACHING],
                        title=f"\U0001f3af {threshold}% of Goal Reached!",
                        description=(
                            f"You've reached {threshold}% of your ${goal_decimal:,.0f} goal! "
                            f"Keep pushing!"
                        ),
                        action_url=f"/events/{event_id}/dashboard",
                        action_label="View Progress",
                        affected_count=threshold,
                        metadata={"threshold": threshold, "pct": round(pct, 1)},
                        is_dismissible=True,
                        notifies_on_appear=True,
                    )
                )
        return nudges

    async def _compute_pareto_donors(self, event_id: uuid.UUID) -> list[NudgeItem]:
        """Top donors who account for 75%+ of total revenue."""
        try:
            total = await self._sum_total_revenue(event_id)
            if total <= 0:
                return []

            result = await self.db.execute(
                select(
                    AuctionBid.user_id,
                    func.sum(AuctionBid.bid_amount).label("total"),
                )
                .where(
                    AuctionBid.event_id == event_id,
                    AuctionBid.bid_status.in_(
                        [BidStatus.ACTIVE, BidStatus.WINNING, BidStatus.OUTBID]
                    ),
                )
                .group_by(AuctionBid.user_id)
                .order_by(func.sum(AuctionBid.bid_amount).desc())
            )
            rows = result.fetchall()
            if not rows:
                return []

            total_donors = len(rows)
            running_total = Decimal(0)
            top_donors = 0
            for row in rows:
                running_total += Decimal(str(row.total))
                top_donors += 1
                if running_total >= total * Decimal("0.75"):
                    break

            if total_donors == 0 or top_donors / total_donors >= 0.30:
                return []

            revenue_pct = round(float(running_total / total * 100), 1)
            return [
                NudgeItem(
                    nudge_key="pareto_donors",
                    nudge_type=NudgeType.PARETO_DONORS,
                    rank=NUDGE_BASE_RANKS[NudgeType.PARETO_DONORS],
                    title="Top Donor Concentration",
                    description=(
                        f"{top_donors} donor{'s account' if top_donors != 1 else ' accounts'} "
                        f"for {revenue_pct}% of your revenue. Keep them engaged!"
                    ),
                    action_url=f"/events/{event_id}/donor-dashboard?sort=total_desc",
                    action_label="View Top Donors",
                    affected_count=top_donors,
                    metadata={
                        "top_donor_count": top_donors,
                        "revenue_pct": revenue_pct,
                        "total_donors": total_donors,
                    },
                    is_dismissible=True,
                    notifies_on_appear=False,
                )
            ]
        except Exception:
            logger.warning("pareto_donors compute failed", exc_info=True)
            return []

    async def _compute_paddle_raise_momentum(self, event_id: uuid.UUID) -> list[NudgeItem]:
        """Active paddle raise with recent contributions."""
        try:
            now = datetime.now(UTC)
            ten_min_ago = now - timedelta(minutes=10)

            result = await self.db.execute(
                select(
                    func.count(PaddleRaiseContribution.id).label("contributor_count"),
                ).where(
                    PaddleRaiseContribution.event_id == event_id,
                    PaddleRaiseContribution.created_at >= ten_min_ago,
                )
            )
            row = result.fetchone()
            if not row or not row.contributor_count:
                return []

            return [
                NudgeItem(
                    nudge_key="paddle_raise_momentum",
                    nudge_type=NudgeType.PADDLE_RAISE_MOMENTUM,
                    rank=NUDGE_BASE_RANKS[NudgeType.PADDLE_RAISE_MOMENTUM],
                    title="Paddle Raise Momentum!",
                    description=(
                        f"\U0001f389 {row.contributor_count} donor"
                        f"{'s have' if row.contributor_count != 1 else ' has'} "
                        f"contributed in the last 10 minutes!"
                    ),
                    action_url=f"/events/{event_id}/auctioneer",
                    action_label="View Paddle Raise",
                    affected_count=row.contributor_count,
                    metadata={
                        "contributor_count": row.contributor_count,
                    },
                    is_dismissible=True,
                    notifies_on_appear=True,
                )
            ]
        except Exception:
            logger.warning("paddle_raise_momentum compute failed", exc_info=True)
            return []

    async def _sum_total_revenue(self, event_id: uuid.UUID) -> Decimal:
        """Sum all revenue sources for the event."""
        from app.models.quick_entry_donation import QuickEntryDonation
        from app.models.ticket_management import PaymentStatus, TicketPurchase

        auction_result = await self.db.execute(
            select(func.coalesce(func.sum(AuctionBid.bid_amount), 0)).where(
                AuctionBid.event_id == event_id,
                AuctionBid.bid_status.in_([BidStatus.ACTIVE, BidStatus.WINNING]),
            )
        )
        paddle_result = await self.db.execute(
            select(func.coalesce(func.sum(PaddleRaiseContribution.amount), 0)).where(
                PaddleRaiseContribution.event_id == event_id
            )
        )
        # QuickEntryDonation.amount is stored in cents (Integer)
        quick_result = await self.db.execute(
            select(func.coalesce(func.sum(QuickEntryDonation.amount), 0)).where(
                QuickEntryDonation.event_id == event_id
            )
        )
        ticket_result = await self.db.execute(
            select(func.coalesce(func.sum(TicketPurchase.total_price), 0)).where(
                TicketPurchase.event_id == event_id,
                TicketPurchase.payment_status == PaymentStatus.COMPLETED,
            )
        )

        auction_total = auction_result.scalar() or 0
        paddle_total = paddle_result.scalar() or 0
        quick_total = quick_result.scalar() or 0
        ticket_total = ticket_result.scalar() or 0

        return (
            Decimal(str(auction_total))
            + Decimal(str(paddle_total))
            + Decimal(str(quick_total)) / 100
            + Decimal(str(ticket_total))
        )
