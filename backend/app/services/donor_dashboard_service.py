"""Service for admin donor dashboard aggregations."""

from __future__ import annotations

import csv
import io
import math
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import String, and_, case, cast, distinct, func, literal, select, union_all
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auction_bid import AuctionBid, BidStatus, PaddleRaiseContribution
from app.models.auction_item import AuctionItem
from app.models.donation import Donation, DonationStatus
from app.models.event import Event, EventStatus
from app.models.event_registration import EventRegistration
from app.models.npo import NPO
from app.models.quick_entry_bid import QuickEntryBid, QuickEntryBidStatus
from app.models.quick_entry_buy_now_bid import QuickEntryBuyNowBid
from app.models.quick_entry_donation import QuickEntryDonation
from app.models.registration_guest import RegistrationGuest
from app.models.ticket_management import PaymentStatus, TicketPackage, TicketPurchase
from app.models.user import User
from app.schemas.donor_dashboard import (
    AuctionCategoryEntry,
    BidRecord,
    BidWarEntry,
    BidWarItem,
    BidWarsResponse,
    CategoryBreakdownResponse,
    CategoryInterest,
    DonationRecord,
    DonorLeaderboardEntry,
    DonorLeaderboardResponse,
    DonorProfileResponse,
    EventAttendance,
    GivingTypeEntry,
    OutbidLeaderEntry,
    OutbidLeadersResponse,
    OutbidSummary,
    TicketRecord,
)

# Valid sort columns for the leaderboard
_LEADERBOARD_SORT_COLUMNS = {
    "total_given",
    "events_attended",
    "ticket_total",
    "donation_total",
    "silent_auction_total",
    "live_auction_total",
    "buy_now_total",
}


class DonorDashboardService:
    """Compute donor analytics from existing event data."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Leaderboard
    # ------------------------------------------------------------------

    async def get_leaderboard(
        self,
        accessible_npo_ids: list[UUID],
        *,
        event_id: UUID | None = None,
        sort_by: str = "total_given",
        sort_order: str = "desc",
        search: str | None = None,
        page: int = 1,
        per_page: int = 25,
        _known_total: int | None = None,
    ) -> DonorLeaderboardResponse:
        if sort_by not in _LEADERBOARD_SORT_COLUMNS:
            sort_by = "total_given"

        # ----- sub-queries per revenue source -----
        event_filter = and_(
            Event.npo_id.in_(accessible_npo_ids),
            Event.status.in_([EventStatus.ACTIVE.value, EventStatus.CLOSED.value]),
            *([Event.id == event_id] if event_id else []),
        )

        # Tickets
        ticket_sq = (
            select(
                TicketPurchase.user_id.label("user_id"),
                func.coalesce(func.sum(TicketPurchase.total_price), 0).label("ticket_total"),
            )
            .join(Event, TicketPurchase.event_id == Event.id)
            .where(
                TicketPurchase.payment_status == PaymentStatus.COMPLETED,
                event_filter,
            )
            .group_by(TicketPurchase.user_id)
            .subquery("ticket_sq")
        )

        # Donations (direct + paddle raise model)
        donation_sq = (
            select(
                Donation.donor_user_id.label("user_id"),
                func.coalesce(func.sum(Donation.amount), 0).label("donation_total"),
            )
            .join(Event, Donation.event_id == Event.id)
            .where(Donation.status == DonationStatus.ACTIVE, event_filter)
            .group_by(Donation.donor_user_id)
            .subquery("donation_sq")
        )

        # QuickEntryDonation
        qe_donation_sq = (
            select(
                QuickEntryDonation.donor_user_id.label("user_id"),
                func.coalesce(func.sum(QuickEntryDonation.amount), 0).label("qe_donation_total"),
            )
            .join(Event, QuickEntryDonation.event_id == Event.id)
            .where(
                QuickEntryDonation.donor_user_id.isnot(None),
                event_filter,
            )
            .group_by(QuickEntryDonation.donor_user_id)
            .subquery("qe_donation_sq")
        )

        # PaddleRaiseContribution
        pr_sq = (
            select(
                PaddleRaiseContribution.user_id.label("user_id"),
                func.coalesce(func.sum(PaddleRaiseContribution.amount), 0).label("pr_total"),
            )
            .join(Event, PaddleRaiseContribution.event_id == Event.id)
            .where(event_filter)
            .group_by(PaddleRaiseContribution.user_id)
            .subquery("pr_sq")
        )

        # Silent auction winning bids
        silent_sq = (
            select(
                AuctionBid.user_id.label("user_id"),
                func.coalesce(func.sum(AuctionBid.bid_amount), 0).label("silent_total"),
            )
            .join(Event, AuctionBid.event_id == Event.id)
            .join(AuctionItem, AuctionBid.auction_item_id == AuctionItem.id)
            .where(
                AuctionBid.bid_status == BidStatus.WINNING.value,
                AuctionBid.bid_status.notin_(
                    [BidStatus.CANCELLED.value, BidStatus.WITHDRAWN.value]
                ),
                AuctionItem.auction_type == "silent",
                event_filter,
            )
            .group_by(AuctionBid.user_id)
            .subquery("silent_sq")
        )

        # Live auction winning bids (QuickEntryBid)
        live_sq = (
            select(
                QuickEntryBid.donor_user_id.label("user_id"),
                func.coalesce(func.sum(QuickEntryBid.amount), 0).label("live_total"),
            )
            .join(Event, QuickEntryBid.event_id == Event.id)
            .where(
                QuickEntryBid.donor_user_id.isnot(None),
                QuickEntryBid.status == QuickEntryBidStatus.WINNING,
                event_filter,
            )
            .group_by(QuickEntryBid.donor_user_id)
            .subquery("live_sq")
        )

        # Buy-now bids
        buynow_sq = (
            select(
                QuickEntryBuyNowBid.donor_user_id.label("user_id"),
                func.coalesce(func.sum(QuickEntryBuyNowBid.amount), 0).label("buynow_total"),
            )
            .join(Event, QuickEntryBuyNowBid.event_id == Event.id)
            .where(
                QuickEntryBuyNowBid.donor_user_id.isnot(None),
                event_filter,
            )
            .group_by(QuickEntryBuyNowBid.donor_user_id)
            .subquery("buynow_sq")
        )

        # Events attended (check-in)
        attended_sq = (
            select(
                RegistrationGuest.user_id.label("user_id"),
                func.count(distinct(EventRegistration.event_id)).label("events_attended"),
            )
            .join(EventRegistration, RegistrationGuest.registration_id == EventRegistration.id)
            .join(Event, EventRegistration.event_id == Event.id)
            .where(
                RegistrationGuest.checked_in.is_(True),
                RegistrationGuest.user_id.isnot(None),
                event_filter,
            )
            .group_by(RegistrationGuest.user_id)
            .subquery("attended_sq")
        )

        # ----- Collect all donor user_ids -----
        all_donor_ids = union_all(
            select(ticket_sq.c.user_id),
            select(donation_sq.c.user_id),
            select(qe_donation_sq.c.user_id),
            select(pr_sq.c.user_id),
            select(silent_sq.c.user_id),
            select(live_sq.c.user_id),
            select(buynow_sq.c.user_id),
            select(attended_sq.c.user_id),
        ).subquery("all_donor_ids")

        distinct_donors = select(distinct(all_donor_ids.c.user_id).label("user_id")).subquery(
            "distinct_donors"
        )

        # ----- Main query -----
        ticket_val = func.coalesce(ticket_sq.c.ticket_total, 0)
        donation_val = (
            func.coalesce(donation_sq.c.donation_total, 0)
            + func.coalesce(qe_donation_sq.c.qe_donation_total, 0)
            + func.coalesce(pr_sq.c.pr_total, 0)
        )
        silent_val = func.coalesce(silent_sq.c.silent_total, 0)
        live_val = func.coalesce(live_sq.c.live_total, 0)
        buynow_val = func.coalesce(buynow_sq.c.buynow_total, 0)
        total_val = ticket_val + donation_val + silent_val + live_val + buynow_val
        attended_val = func.coalesce(attended_sq.c.events_attended, 0)

        base_query = (
            select(
                User.id.label("user_id"),
                User.first_name,
                User.last_name,
                User.email,
                User.is_active,
                total_val.label("total_given"),
                attended_val.label("events_attended"),
                ticket_val.label("ticket_total"),
                donation_val.label("donation_total"),
                silent_val.label("silent_auction_total"),
                live_val.label("live_auction_total"),
                buynow_val.label("buy_now_total"),
            )
            .join(distinct_donors, User.id == distinct_donors.c.user_id)
            .outerjoin(ticket_sq, User.id == ticket_sq.c.user_id)
            .outerjoin(donation_sq, User.id == donation_sq.c.user_id)
            .outerjoin(qe_donation_sq, User.id == qe_donation_sq.c.user_id)
            .outerjoin(pr_sq, User.id == pr_sq.c.user_id)
            .outerjoin(silent_sq, User.id == silent_sq.c.user_id)
            .outerjoin(live_sq, User.id == live_sq.c.user_id)
            .outerjoin(buynow_sq, User.id == buynow_sq.c.user_id)
            .outerjoin(attended_sq, User.id == attended_sq.c.user_id)
        )

        if search:
            like = f"%{search}%"
            base_query = base_query.where(
                (User.first_name.ilike(like))
                | (User.last_name.ilike(like))
                | (User.email.ilike(like))
            )

        # Sort column mapping
        sort_map: dict[str, Any] = {
            "total_given": total_val,
            "events_attended": attended_val,
            "ticket_total": ticket_val,
            "donation_total": donation_val,
            "silent_auction_total": silent_val,
            "live_auction_total": live_val,
            "buy_now_total": buynow_val,
        }
        sort_col = sort_map.get(sort_by, total_val)
        order = sort_col.desc() if sort_order == "desc" else sort_col.asc()

        # Count (skip when caller already knows the total, e.g. CSV export)
        if _known_total is not None:
            total = _known_total
        else:
            count_query = select(func.count()).select_from(base_query.subquery())
            total = (await self.db.execute(count_query)).scalar_one()

        # Paginated result
        rows = (
            await self.db.execute(
                base_query.order_by(order, User.last_name.asc())
                .offset((page - 1) * per_page)
                .limit(per_page)
            )
        ).all()

        items = [
            DonorLeaderboardEntry(
                user_id=r.user_id,
                first_name=r.first_name,
                last_name=r.last_name,
                email=r.email,
                is_active=r.is_active,
                total_given=float(r.total_given),
                events_attended=r.events_attended,
                ticket_total=float(r.ticket_total),
                donation_total=float(r.donation_total),
                silent_auction_total=float(r.silent_auction_total),
                live_auction_total=float(r.live_auction_total),
                buy_now_total=float(r.buy_now_total),
            )
            for r in rows
        ]

        return DonorLeaderboardResponse(
            items=items,
            total=total,
            page=page,
            per_page=per_page,
            pages=max(1, math.ceil(total / per_page)),
        )

    # ------------------------------------------------------------------
    # Donor Profile
    # ------------------------------------------------------------------

    async def get_donor_profile(
        self,
        user_id: UUID,
        accessible_npo_ids: list[UUID],
        *,
        event_id: UUID | None = None,
    ) -> DonorProfileResponse | None:
        # Fetch user
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user is None:
            return None

        event_filter = and_(
            Event.npo_id.in_(accessible_npo_ids),
            Event.status.in_([EventStatus.ACTIVE.value, EventStatus.CLOSED.value]),
            *([Event.id == event_id] if event_id else []),
        )

        # Access check: verify donor has any activity within the caller's scope.
        # Must be broader than RegistrationGuest alone because donors can appear
        # in the leaderboard through tickets, donations, or auction activity.
        activity_sources = union_all(
            select(literal(1).label("x"))
            .select_from(RegistrationGuest)
            .join(EventRegistration, RegistrationGuest.registration_id == EventRegistration.id)
            .join(Event, EventRegistration.event_id == Event.id)
            .where(RegistrationGuest.user_id == user_id, event_filter),
            select(literal(1).label("x"))
            .select_from(TicketPurchase)
            .join(Event, TicketPurchase.event_id == Event.id)
            .where(
                TicketPurchase.user_id == user_id,
                TicketPurchase.payment_status == PaymentStatus.COMPLETED,
                event_filter,
            ),
            select(literal(1).label("x"))
            .select_from(Donation)
            .join(Event, Donation.event_id == Event.id)
            .where(
                Donation.donor_user_id == user_id,
                Donation.status == DonationStatus.ACTIVE,
                event_filter,
            ),
            select(literal(1).label("x"))
            .select_from(QuickEntryDonation)
            .join(Event, QuickEntryDonation.event_id == Event.id)
            .where(QuickEntryDonation.donor_user_id == user_id, event_filter),
            select(literal(1).label("x"))
            .select_from(PaddleRaiseContribution)
            .join(Event, PaddleRaiseContribution.event_id == Event.id)
            .where(PaddleRaiseContribution.user_id == user_id, event_filter),
            select(literal(1).label("x"))
            .select_from(AuctionBid)
            .join(Event, AuctionBid.event_id == Event.id)
            .where(
                AuctionBid.user_id == user_id,
                AuctionBid.bid_status.notin_(
                    [BidStatus.CANCELLED.value, BidStatus.WITHDRAWN.value]
                ),
                event_filter,
            ),
            select(literal(1).label("x"))
            .select_from(QuickEntryBid)
            .join(Event, QuickEntryBid.event_id == Event.id)
            .where(QuickEntryBid.donor_user_id == user_id, event_filter),
            select(literal(1).label("x"))
            .select_from(QuickEntryBuyNowBid)
            .join(Event, QuickEntryBuyNowBid.event_id == Event.id)
            .where(QuickEntryBuyNowBid.donor_user_id == user_id, event_filter),
        ).subquery("activity")
        access_check = select(literal(1)).select_from(activity_sources).limit(1)
        has_access = (await self.db.execute(access_check)).scalar_one_or_none()
        if has_access is None:
            return None

        # Event history
        event_history = await self._get_event_history(user_id, event_filter)
        # Bid history
        bid_history = await self._get_bid_history(user_id, event_filter)
        # Donation history
        donation_history = await self._get_donation_history(user_id, event_filter)
        # Ticket history
        ticket_history = await self._get_ticket_history(user_id, event_filter)
        # Category interests
        category_interests = await self._get_category_interests(user_id, event_filter)
        # Outbid summary
        outbid_summary = await self._get_outbid_summary(user_id, event_filter)

        total_given = sum(e.total_given_at_event for e in event_history) if event_history else 0
        events_attended = sum(1 for e in event_history if e.checked_in)

        return DonorProfileResponse(
            user_id=user.id,
            first_name=user.first_name,
            last_name=user.last_name,
            email=user.email,
            phone=user.phone,
            is_active=user.is_active,
            total_given=total_given,
            events_attended=events_attended,
            event_history=event_history,
            bid_history=bid_history,
            donation_history=donation_history,
            ticket_history=ticket_history,
            category_interests=category_interests,
            outbid_summary=outbid_summary,
        )

    async def _get_event_history(self, user_id: UUID, event_filter: Any) -> list[EventAttendance]:
        """Get events this donor attended / was registered for."""
        # Find events where the user has a registration guest record
        stmt = (
            select(
                Event.id.label("event_id"),
                Event.name.label("event_name"),
                Event.event_datetime.label("event_date"),
                Event.npo_id,
                NPO.name.label("npo_name"),
                func.bool_or(RegistrationGuest.checked_in).label("checked_in"),
            )
            .join(EventRegistration, EventRegistration.event_id == Event.id)
            .join(RegistrationGuest, RegistrationGuest.registration_id == EventRegistration.id)
            .join(NPO, Event.npo_id == NPO.id)
            .where(
                RegistrationGuest.user_id == user_id,
                event_filter,
            )
            .group_by(Event.id, Event.name, Event.event_datetime, Event.npo_id, NPO.name)
            .order_by(Event.event_datetime.desc())
        )
        rows = (await self.db.execute(stmt)).all()

        # Compute giving totals in bulk to avoid N+1 queries
        event_ids = [r.event_id for r in rows]
        giving_map: dict[UUID, float] = {}
        if event_ids:
            giving_map = await self._get_user_events_giving_bulk(user_id, event_ids)

        results: list[EventAttendance] = []
        for r in rows:
            results.append(
                EventAttendance(
                    event_id=r.event_id,
                    event_name=r.event_name,
                    event_date=r.event_date,
                    npo_id=r.npo_id,
                    npo_name=r.npo_name,
                    checked_in=r.checked_in,
                    total_given_at_event=giving_map.get(r.event_id, 0.0),
                )
            )
        return results

    async def _get_user_event_giving(self, user_id: UUID, event_id: UUID) -> float:
        """Sum all giving for a user at a specific event."""
        total = Decimal(0)

        # Tickets
        r = await self.db.execute(
            select(func.coalesce(func.sum(TicketPurchase.total_price), 0)).where(
                TicketPurchase.user_id == user_id,
                TicketPurchase.event_id == event_id,
                TicketPurchase.payment_status == PaymentStatus.COMPLETED,
            )
        )
        total += r.scalar_one()

        # Donations
        r = await self.db.execute(
            select(func.coalesce(func.sum(Donation.amount), 0)).where(
                Donation.donor_user_id == user_id,
                Donation.event_id == event_id,
                Donation.status == DonationStatus.ACTIVE,
            )
        )
        total += r.scalar_one()

        # QE Donations
        r = await self.db.execute(
            select(func.coalesce(func.sum(QuickEntryDonation.amount), 0)).where(
                QuickEntryDonation.donor_user_id == user_id,
                QuickEntryDonation.event_id == event_id,
            )
        )
        total += r.scalar_one()

        # Paddle raise
        r = await self.db.execute(
            select(func.coalesce(func.sum(PaddleRaiseContribution.amount), 0)).where(
                PaddleRaiseContribution.user_id == user_id,
                PaddleRaiseContribution.event_id == event_id,
            )
        )
        total += r.scalar_one()

        # Winning silent auction bids
        r = await self.db.execute(
            select(func.coalesce(func.sum(AuctionBid.bid_amount), 0))
            .join(AuctionItem, AuctionBid.auction_item_id == AuctionItem.id)
            .where(
                AuctionBid.user_id == user_id,
                AuctionBid.event_id == event_id,
                AuctionBid.bid_status == BidStatus.WINNING.value,
            )
        )
        total += r.scalar_one()

        # Winning live auction bids
        r = await self.db.execute(
            select(func.coalesce(func.sum(QuickEntryBid.amount), 0)).where(
                QuickEntryBid.donor_user_id == user_id,
                QuickEntryBid.event_id == event_id,
                QuickEntryBid.status == QuickEntryBidStatus.WINNING,
            )
        )
        total += r.scalar_one()

        # Buy-now
        r = await self.db.execute(
            select(func.coalesce(func.sum(QuickEntryBuyNowBid.amount), 0)).where(
                QuickEntryBuyNowBid.donor_user_id == user_id,
                QuickEntryBuyNowBid.event_id == event_id,
            )
        )
        total += r.scalar_one()

        return float(total)

    async def _get_user_events_giving_bulk(
        self, user_id: UUID, event_ids: list[UUID]
    ) -> dict[UUID, float]:
        """Sum all giving for a user across multiple events in bulk (avoids N+1)."""
        ticket_sq = (
            select(
                TicketPurchase.event_id.label("event_id"),
                func.coalesce(func.sum(TicketPurchase.total_price), 0).label("amount"),
            )
            .where(
                TicketPurchase.user_id == user_id,
                TicketPurchase.event_id.in_(event_ids),
                TicketPurchase.payment_status == PaymentStatus.COMPLETED,
            )
            .group_by(TicketPurchase.event_id)
        )
        donation_sq = (
            select(
                Donation.event_id.label("event_id"),
                func.coalesce(func.sum(Donation.amount), 0).label("amount"),
            )
            .where(
                Donation.donor_user_id == user_id,
                Donation.event_id.in_(event_ids),
                Donation.status == DonationStatus.ACTIVE,
            )
            .group_by(Donation.event_id)
        )
        qe_donation_sq = (
            select(
                QuickEntryDonation.event_id.label("event_id"),
                func.coalesce(func.sum(QuickEntryDonation.amount), 0).label("amount"),
            )
            .where(
                QuickEntryDonation.donor_user_id == user_id,
                QuickEntryDonation.event_id.in_(event_ids),
            )
            .group_by(QuickEntryDonation.event_id)
        )
        paddle_sq = (
            select(
                PaddleRaiseContribution.event_id.label("event_id"),
                func.coalesce(func.sum(PaddleRaiseContribution.amount), 0).label("amount"),
            )
            .where(
                PaddleRaiseContribution.user_id == user_id,
                PaddleRaiseContribution.event_id.in_(event_ids),
            )
            .group_by(PaddleRaiseContribution.event_id)
        )
        silent_bid_sq = (
            select(
                AuctionBid.event_id.label("event_id"),
                func.coalesce(func.sum(AuctionBid.bid_amount), 0).label("amount"),
            )
            .where(
                AuctionBid.user_id == user_id,
                AuctionBid.event_id.in_(event_ids),
                AuctionBid.bid_status == BidStatus.WINNING.value,
            )
            .group_by(AuctionBid.event_id)
        )
        live_bid_sq = (
            select(
                QuickEntryBid.event_id.label("event_id"),
                func.coalesce(func.sum(QuickEntryBid.amount), 0).label("amount"),
            )
            .where(
                QuickEntryBid.donor_user_id == user_id,
                QuickEntryBid.event_id.in_(event_ids),
                QuickEntryBid.status == QuickEntryBidStatus.WINNING,
            )
            .group_by(QuickEntryBid.event_id)
        )
        buynow_sq = (
            select(
                QuickEntryBuyNowBid.event_id.label("event_id"),
                func.coalesce(func.sum(QuickEntryBuyNowBid.amount), 0).label("amount"),
            )
            .where(
                QuickEntryBuyNowBid.donor_user_id == user_id,
                QuickEntryBuyNowBid.event_id.in_(event_ids),
            )
            .group_by(QuickEntryBuyNowBid.event_id)
        )
        combined = union_all(
            ticket_sq,
            donation_sq,
            qe_donation_sq,
            paddle_sq,
            silent_bid_sq,
            live_bid_sq,
            buynow_sq,
        ).subquery("all_giving")
        stmt = select(
            combined.c.event_id,
            func.sum(combined.c.amount).label("total"),
        ).group_by(combined.c.event_id)
        rows = (await self.db.execute(stmt)).all()
        return {r.event_id: float(r.total) for r in rows}

    async def _get_bid_history(self, user_id: UUID, event_filter: Any) -> list[BidRecord]:
        """Get all bids placed by this donor."""
        # Silent auction bids
        silent_stmt = (
            select(
                AuctionBid.id.label("bid_id"),
                AuctionBid.event_id,
                Event.name.label("event_name"),
                Event.npo_id,
                NPO.name.label("npo_name"),
                AuctionBid.auction_item_id.label("item_id"),
                AuctionItem.title.label("item_title"),
                AuctionItem.category.label("item_category"),
                AuctionBid.bid_amount,
                AuctionBid.bid_status,
                literal("SILENT").label("bid_type"),
                AuctionBid.placed_at.label("created_at"),
            )
            .join(Event, AuctionBid.event_id == Event.id)
            .join(NPO, Event.npo_id == NPO.id)
            .join(AuctionItem, AuctionBid.auction_item_id == AuctionItem.id)
            .where(AuctionBid.user_id == user_id, event_filter)
        )

        # Live auction bids
        live_stmt = (
            select(
                QuickEntryBid.id.label("bid_id"),
                QuickEntryBid.event_id,
                Event.name.label("event_name"),
                Event.npo_id,
                NPO.name.label("npo_name"),
                QuickEntryBid.item_id.label("item_id"),
                AuctionItem.title.label("item_title"),
                AuctionItem.category.label("item_category"),
                QuickEntryBid.amount.label("bid_amount"),
                cast(QuickEntryBid.status, String).label("bid_status"),
                literal("LIVE").label("bid_type"),
                QuickEntryBid.accepted_at.label("created_at"),
            )
            .join(Event, QuickEntryBid.event_id == Event.id)
            .join(NPO, Event.npo_id == NPO.id)
            .join(AuctionItem, QuickEntryBid.item_id == AuctionItem.id)
            .where(QuickEntryBid.donor_user_id == user_id, event_filter)
        )

        # Buy-now bids
        buynow_stmt = (
            select(
                QuickEntryBuyNowBid.id.label("bid_id"),
                QuickEntryBuyNowBid.event_id,
                Event.name.label("event_name"),
                Event.npo_id,
                NPO.name.label("npo_name"),
                QuickEntryBuyNowBid.item_id.label("item_id"),
                AuctionItem.title.label("item_title"),
                AuctionItem.category.label("item_category"),
                QuickEntryBuyNowBid.amount.label("bid_amount"),
                literal("WINNING").label("bid_status"),
                literal("BUY_NOW").label("bid_type"),
                QuickEntryBuyNowBid.entered_at.label("created_at"),
            )
            .join(Event, QuickEntryBuyNowBid.event_id == Event.id)
            .join(NPO, Event.npo_id == NPO.id)
            .join(AuctionItem, QuickEntryBuyNowBid.item_id == AuctionItem.id)
            .where(QuickEntryBuyNowBid.donor_user_id == user_id, event_filter)
        )

        combined = union_all(silent_stmt, live_stmt, buynow_stmt).subquery()
        rows = (
            await self.db.execute(select(combined).order_by(combined.c.created_at.desc()))
        ).all()

        return [
            BidRecord(
                bid_id=r.bid_id,
                event_id=r.event_id,
                event_name=r.event_name,
                npo_id=r.npo_id,
                npo_name=r.npo_name,
                item_id=r.item_id,
                item_title=r.item_title,
                item_category=r.item_category,
                bid_amount=float(r.bid_amount),
                bid_status=str(r.bid_status),
                bid_type=r.bid_type,
                created_at=r.created_at,
            )
            for r in rows
        ]

    async def _get_donation_history(self, user_id: UUID, event_filter: Any) -> list[DonationRecord]:
        """Get all donations made by this donor."""
        records: list[DonationRecord] = []

        # Regular donations
        stmt = (
            select(
                Donation.id.label("donation_id"),
                Donation.event_id,
                Event.name.label("event_name"),
                Event.npo_id,
                NPO.name.label("npo_name"),
                Donation.amount,
                Donation.is_paddle_raise,
                Donation.created_at,
            )
            .join(Event, Donation.event_id == Event.id)
            .join(NPO, Event.npo_id == NPO.id)
            .where(
                Donation.donor_user_id == user_id,
                Donation.status == DonationStatus.ACTIVE,
                event_filter,
            )
            .order_by(Donation.created_at.desc())
        )
        rows = (await self.db.execute(stmt)).all()
        for r in rows:
            records.append(
                DonationRecord(
                    donation_id=r.donation_id,
                    event_id=r.event_id,
                    event_name=r.event_name,
                    npo_id=r.npo_id,
                    npo_name=r.npo_name,
                    amount=float(r.amount),
                    source="paddle_raise" if r.is_paddle_raise else "donation",
                    is_paddle_raise=r.is_paddle_raise,
                    created_at=r.created_at,
                )
            )

        # QE donations
        stmt2 = (
            select(
                QuickEntryDonation.id.label("donation_id"),
                QuickEntryDonation.event_id,
                Event.name.label("event_name"),
                Event.npo_id,
                NPO.name.label("npo_name"),
                QuickEntryDonation.amount,
                QuickEntryDonation.entered_at.label("created_at"),
            )
            .join(Event, QuickEntryDonation.event_id == Event.id)
            .join(NPO, Event.npo_id == NPO.id)
            .where(
                QuickEntryDonation.donor_user_id == user_id,
                event_filter,
            )
            .order_by(QuickEntryDonation.entered_at.desc())
        )
        rows2 = (await self.db.execute(stmt2)).all()
        for r2 in rows2:
            records.append(
                DonationRecord(
                    donation_id=r2.donation_id,
                    event_id=r2.event_id,
                    event_name=r2.event_name,
                    npo_id=r2.npo_id,
                    npo_name=r2.npo_name,
                    amount=float(r2.amount),
                    source="quick_entry_donation",
                    created_at=r2.created_at,
                )
            )

        # Paddle raise contributions
        stmt3 = (
            select(
                PaddleRaiseContribution.id.label("donation_id"),
                PaddleRaiseContribution.event_id,
                Event.name.label("event_name"),
                Event.npo_id,
                NPO.name.label("npo_name"),
                PaddleRaiseContribution.amount,
                PaddleRaiseContribution.placed_at.label("created_at"),
            )
            .join(Event, PaddleRaiseContribution.event_id == Event.id)
            .join(NPO, Event.npo_id == NPO.id)
            .where(
                PaddleRaiseContribution.user_id == user_id,
                event_filter,
            )
            .order_by(PaddleRaiseContribution.placed_at.desc())
        )
        rows3 = (await self.db.execute(stmt3)).all()
        for r3 in rows3:
            records.append(
                DonationRecord(
                    donation_id=r3.donation_id,
                    event_id=r3.event_id,
                    event_name=r3.event_name,
                    npo_id=r3.npo_id,
                    npo_name=r3.npo_name,
                    amount=float(r3.amount),
                    source="paddle_raise",
                    is_paddle_raise=True,
                    created_at=r3.created_at,
                )
            )

        records.sort(key=lambda d: d.created_at, reverse=True)
        return records

    async def _get_ticket_history(self, user_id: UUID, event_filter: Any) -> list[TicketRecord]:
        """Get all ticket purchases by this donor."""
        stmt = (
            select(
                TicketPurchase.id.label("purchase_id"),
                TicketPurchase.event_id,
                Event.name.label("event_name"),
                Event.npo_id,
                NPO.name.label("npo_name"),
                TicketPackage.name.label("package_name"),
                TicketPurchase.quantity,
                TicketPurchase.total_price,
                TicketPurchase.purchased_at,
            )
            .join(Event, TicketPurchase.event_id == Event.id)
            .join(NPO, Event.npo_id == NPO.id)
            .join(TicketPackage, TicketPurchase.ticket_package_id == TicketPackage.id)
            .where(
                TicketPurchase.user_id == user_id,
                TicketPurchase.payment_status == PaymentStatus.COMPLETED,
                event_filter,
            )
            .order_by(TicketPurchase.purchased_at.desc())
        )
        rows = (await self.db.execute(stmt)).all()
        return [
            TicketRecord(
                purchase_id=r.purchase_id,
                event_id=r.event_id,
                event_name=r.event_name,
                npo_id=r.npo_id,
                npo_name=r.npo_name,
                package_name=r.package_name,
                quantity=r.quantity,
                total_price=float(r.total_price),
                purchased_at=r.purchased_at,
            )
            for r in rows
        ]

    async def _get_category_interests(
        self, user_id: UUID, event_filter: Any
    ) -> list[CategoryInterest]:
        """Get bid activity grouped by auction item category."""
        stmt = (
            select(
                func.coalesce(AuctionItem.category, "Other").label("category"),
                func.count(AuctionBid.id).label("bid_count"),
                func.coalesce(func.sum(AuctionBid.bid_amount), 0).label("total_bid_amount"),
                func.count(
                    case(
                        (AuctionBid.bid_status == BidStatus.WINNING.value, AuctionBid.id),
                    )
                ).label("items_won"),
            )
            .join(AuctionItem, AuctionBid.auction_item_id == AuctionItem.id)
            .join(Event, AuctionBid.event_id == Event.id)
            .where(
                AuctionBid.user_id == user_id,
                AuctionBid.bid_status.notin_(
                    [BidStatus.CANCELLED.value, BidStatus.WITHDRAWN.value]
                ),
                event_filter,
            )
            .group_by(AuctionItem.category)
            .order_by(func.count(AuctionBid.id).desc())
        )
        rows = (await self.db.execute(stmt)).all()
        return [
            CategoryInterest(
                category=r.category,
                bid_count=r.bid_count,
                total_bid_amount=float(r.total_bid_amount),
                items_won=r.items_won,
            )
            for r in rows
        ]

    async def _get_outbid_summary(self, user_id: UUID, event_filter: Any) -> OutbidSummary:
        """Compute outbid metrics for a single donor."""
        # Items bid on (distinct)
        items_stmt = (
            select(
                func.count(distinct(AuctionBid.auction_item_id)).label("items_bid_on"),
                func.count(
                    distinct(
                        case(
                            (
                                AuctionBid.bid_status == BidStatus.WINNING.value,
                                AuctionBid.auction_item_id,
                            ),
                        )
                    )
                ).label("items_won"),
            )
            .join(Event, AuctionBid.event_id == Event.id)
            .where(
                AuctionBid.user_id == user_id,
                AuctionBid.bid_status.notin_(
                    [BidStatus.CANCELLED.value, BidStatus.WITHDRAWN.value]
                ),
                event_filter,
            )
        )
        r = (await self.db.execute(items_stmt)).one()
        items_bid_on = r.items_bid_on
        items_won = r.items_won
        items_lost = items_bid_on - items_won

        # Total outbid amount: max bid per lost item, then sum
        per_item = (
            select(
                func.max(AuctionBid.bid_amount).label("max_bid"),
            )
            .join(Event, AuctionBid.event_id == Event.id)
            .where(
                AuctionBid.user_id == user_id,
                AuctionBid.bid_status == BidStatus.OUTBID.value,
                event_filter,
            )
            .group_by(AuctionBid.auction_item_id)
        ).subquery()
        outer = select(func.coalesce(func.sum(per_item.c.max_bid), 0))
        total_outbid = float((await self.db.execute(outer)).scalar_one())

        return OutbidSummary(
            total_outbid_amount=total_outbid,
            items_bid_on=items_bid_on,
            items_won=items_won,
            items_lost=items_lost,
            win_rate=round(items_won / items_bid_on, 2) if items_bid_on > 0 else 0,
        )

    # ------------------------------------------------------------------
    # Outbid Leaders
    # ------------------------------------------------------------------

    async def get_outbid_leaders(
        self,
        accessible_npo_ids: list[UUID],
        *,
        event_id: UUID | None = None,
        page: int = 1,
        per_page: int = 25,
    ) -> OutbidLeadersResponse:
        event_filter = and_(
            Event.npo_id.in_(accessible_npo_ids),
            Event.status.in_([EventStatus.ACTIVE.value, EventStatus.CLOSED.value]),
            *([Event.id == event_id] if event_id else []),
        )

        # Per-item max bid for each user where they were outbid
        per_item_max = (
            select(
                AuctionBid.user_id,
                AuctionBid.auction_item_id,
                func.max(AuctionBid.bid_amount).label("max_bid_on_item"),
            )
            .join(Event, AuctionBid.event_id == Event.id)
            .where(
                AuctionBid.bid_status == BidStatus.OUTBID.value,
                AuctionBid.bid_status.notin_(
                    [BidStatus.CANCELLED.value, BidStatus.WITHDRAWN.value]
                ),
                event_filter,
            )
            .group_by(AuctionBid.user_id, AuctionBid.auction_item_id)
            .subquery("per_item_max")
        )

        # Items bid on (all statuses except CANCELLED/WITHDRAWN)
        items_bids = (
            select(
                AuctionBid.user_id,
                func.count(distinct(AuctionBid.auction_item_id)).label("items_bid_on"),
                func.count(
                    distinct(
                        case(
                            (
                                AuctionBid.bid_status == BidStatus.WINNING.value,
                                AuctionBid.auction_item_id,
                            ),
                        )
                    )
                ).label("items_won"),
            )
            .join(Event, AuctionBid.event_id == Event.id)
            .where(
                AuctionBid.bid_status.notin_(
                    [BidStatus.CANCELLED.value, BidStatus.WITHDRAWN.value]
                ),
                event_filter,
            )
            .group_by(AuctionBid.user_id)
            .subquery("items_bids")
        )

        # Sum of per-item max outbid amounts per user
        outbid_totals = (
            select(
                per_item_max.c.user_id,
                func.sum(per_item_max.c.max_bid_on_item).label("total_outbid_amount"),
            )
            .group_by(per_item_max.c.user_id)
            .subquery("outbid_totals")
        )

        base_query = (
            select(
                User.id.label("user_id"),
                User.first_name,
                User.last_name,
                outbid_totals.c.total_outbid_amount,
                func.coalesce(items_bids.c.items_bid_on, 0).label("items_bid_on"),
                func.coalesce(items_bids.c.items_won, 0).label("items_won"),
            )
            .join(outbid_totals, User.id == outbid_totals.c.user_id)
            .outerjoin(items_bids, User.id == items_bids.c.user_id)
            .order_by(outbid_totals.c.total_outbid_amount.desc())
        )

        count_query = select(func.count()).select_from(base_query.subquery())
        total = (await self.db.execute(count_query)).scalar_one()

        rows = (
            await self.db.execute(base_query.offset((page - 1) * per_page).limit(per_page))
        ).all()

        items = []
        for r in rows:
            items_bid_on = r.items_bid_on
            items_won = r.items_won
            items_lost = items_bid_on - items_won
            items.append(
                OutbidLeaderEntry(
                    user_id=r.user_id,
                    first_name=r.first_name,
                    last_name=r.last_name,
                    total_outbid_amount=float(r.total_outbid_amount),
                    items_bid_on=items_bid_on,
                    items_won=items_won,
                    items_lost=items_lost,
                    win_rate=round(items_won / items_bid_on, 2) if items_bid_on > 0 else 0,
                )
            )

        return OutbidLeadersResponse(
            items=items,
            total=total,
            page=page,
            per_page=per_page,
            pages=max(1, math.ceil(total / per_page)),
        )

    # ------------------------------------------------------------------
    # Bid Wars
    # ------------------------------------------------------------------

    async def get_bid_wars(
        self,
        accessible_npo_ids: list[UUID],
        *,
        event_id: UUID | None = None,
        page: int = 1,
        per_page: int = 25,
    ) -> BidWarsResponse:
        event_filter = and_(
            Event.npo_id.in_(accessible_npo_ids),
            Event.status.in_([EventStatus.ACTIVE.value, EventStatus.CLOSED.value]),
            *([Event.id == event_id] if event_id else []),
        )

        # Items where user placed 3+ bids
        war_items = (
            select(
                AuctionBid.user_id,
                AuctionBid.auction_item_id,
                func.count(AuctionBid.id).label("bid_count"),
                func.max(AuctionBid.bid_amount).label("highest_bid"),
            )
            .join(Event, AuctionBid.event_id == Event.id)
            .where(
                AuctionBid.bid_status.notin_(
                    [BidStatus.CANCELLED.value, BidStatus.WITHDRAWN.value]
                ),
                event_filter,
            )
            .group_by(AuctionBid.user_id, AuctionBid.auction_item_id)
            .having(func.count(AuctionBid.id) >= 3)
            .subquery("war_items")
        )

        # Aggregate per user
        user_wars = (
            select(
                war_items.c.user_id,
                func.count(distinct(war_items.c.auction_item_id)).label("bid_war_count"),
                func.sum(war_items.c.bid_count).label("total_bids_in_wars"),
            )
            .group_by(war_items.c.user_id)
            .subquery("user_wars")
        )

        base_query = (
            select(
                User.id.label("user_id"),
                User.first_name,
                User.last_name,
                user_wars.c.bid_war_count,
                user_wars.c.total_bids_in_wars,
            )
            .join(user_wars, User.id == user_wars.c.user_id)
            .order_by(user_wars.c.bid_war_count.desc())
        )

        count_query = select(func.count()).select_from(base_query.subquery())
        total = (await self.db.execute(count_query)).scalar_one()

        rows = (
            await self.db.execute(base_query.offset((page - 1) * per_page).limit(per_page))
        ).all()

        items: list[BidWarEntry] = []
        user_ids = [r.user_id for r in rows]
        # Bulk fetch top war items for all users on this page
        top_items_map: dict[UUID, list[BidWarItem]] = {uid: [] for uid in user_ids}
        if user_ids:
            top_items_map = await self._get_top_war_items_bulk(user_ids, event_filter)
        for r in rows:
            items.append(
                BidWarEntry(
                    user_id=r.user_id,
                    first_name=r.first_name,
                    last_name=r.last_name,
                    bid_war_count=r.bid_war_count,
                    total_bids_in_wars=r.total_bids_in_wars,
                    top_war_items=top_items_map.get(r.user_id, []),
                )
            )

        return BidWarsResponse(
            items=items,
            total=total,
            page=page,
            per_page=per_page,
            pages=max(1, math.ceil(total / per_page)),
        )

    async def _get_top_war_items_bulk(
        self, user_ids: list[UUID], event_filter: Any
    ) -> dict[UUID, list[BidWarItem]]:
        """Get top 5 bid war items per user in a single query using window functions."""
        per_user_items = (
            select(
                AuctionBid.user_id.label("user_id"),
                AuctionBid.auction_item_id.label("item_id"),
                AuctionItem.title.label("item_title"),
                func.count(AuctionBid.id).label("bid_count"),
                func.max(AuctionBid.bid_amount).label("highest_bid"),
                func.bool_or(AuctionBid.bid_status == BidStatus.WINNING.value).label("won"),
            )
            .join(Event, AuctionBid.event_id == Event.id)
            .join(AuctionItem, AuctionBid.auction_item_id == AuctionItem.id)
            .where(
                AuctionBid.user_id.in_(user_ids),
                AuctionBid.bid_status.notin_(
                    [BidStatus.CANCELLED.value, BidStatus.WITHDRAWN.value]
                ),
                event_filter,
            )
            .group_by(AuctionBid.user_id, AuctionBid.auction_item_id, AuctionItem.title)
            .having(func.count(AuctionBid.id) >= 3)
            .subquery("per_user_items")
        )

        row_num = (
            func.row_number()
            .over(
                partition_by=per_user_items.c.user_id,
                order_by=[
                    per_user_items.c.bid_count.desc(),
                    per_user_items.c.highest_bid.desc(),
                ],
            )
            .label("rn")
        )

        ranked = select(per_user_items, row_num).subquery("ranked")
        stmt = select(ranked).where(ranked.c.rn <= 5)

        rows = (await self.db.execute(stmt)).all()

        result: dict[UUID, list[BidWarItem]] = {uid: [] for uid in user_ids}
        for r in rows:
            result[r.user_id].append(
                BidWarItem(
                    item_id=r.item_id,
                    item_title=r.item_title,
                    bid_count=r.bid_count,
                    highest_bid=float(r.highest_bid),
                    won=r.won,
                )
            )
        return result

    # ------------------------------------------------------------------
    # Category Breakdown
    # ------------------------------------------------------------------

    async def get_category_breakdown(
        self,
        accessible_npo_ids: list[UUID],
        *,
        event_id: UUID | None = None,
    ) -> CategoryBreakdownResponse:
        event_filter = and_(
            Event.npo_id.in_(accessible_npo_ids),
            Event.status.in_([EventStatus.ACTIVE.value, EventStatus.CLOSED.value]),
            *([Event.id == event_id] if event_id else []),
        )

        giving_type = await self._get_giving_type_breakdown(
            event_filter, accessible_npo_ids, event_id
        )
        auction_cat = await self._get_auction_category_breakdown(event_filter)

        return CategoryBreakdownResponse(
            giving_type_breakdown=giving_type,
            auction_category_breakdown=auction_cat,
        )

    async def _get_giving_type_breakdown(
        self, event_filter: Any, accessible_npo_ids: list[UUID], event_id: UUID | None
    ) -> list[GivingTypeEntry]:
        """Compute total amount and distinct donor count per giving type."""
        ef = event_filter

        result: list[GivingTypeEntry] = []

        # Tickets
        r = await self.db.execute(
            select(
                func.coalesce(func.sum(TicketPurchase.total_price), 0).label("total"),
                func.count(distinct(TicketPurchase.user_id)).label("donors"),
            )
            .join(Event, TicketPurchase.event_id == Event.id)
            .where(TicketPurchase.payment_status == PaymentStatus.COMPLETED, ef)
        )
        row = r.one()
        result.append(
            GivingTypeEntry(
                category="tickets", total_amount=float(row.total), donor_count=row.donors
            )
        )

        # Donations + paddle raise
        don_amount = Decimal(0)
        don_donors: set[UUID] = set()

        r = await self.db.execute(
            select(
                func.coalesce(func.sum(Donation.amount), 0).label("total"),
                func.array_agg(distinct(Donation.donor_user_id)).label("donors"),
            )
            .join(Event, Donation.event_id == Event.id)
            .where(Donation.status == DonationStatus.ACTIVE, ef)
        )
        row = r.one()
        don_amount += row.total
        if row.donors:
            don_donors.update(d for d in row.donors if d is not None)

        r = await self.db.execute(
            select(
                func.coalesce(func.sum(QuickEntryDonation.amount), 0).label("total"),
                func.array_agg(distinct(QuickEntryDonation.donor_user_id)).label("donors"),
            )
            .join(Event, QuickEntryDonation.event_id == Event.id)
            .where(QuickEntryDonation.donor_user_id.isnot(None), ef)
        )
        row = r.one()
        don_amount += row.total
        if row.donors:
            don_donors.update(d for d in row.donors if d is not None)

        r = await self.db.execute(
            select(
                func.coalesce(func.sum(PaddleRaiseContribution.amount), 0).label("total"),
                func.array_agg(distinct(PaddleRaiseContribution.user_id)).label("donors"),
            )
            .join(Event, PaddleRaiseContribution.event_id == Event.id)
            .where(ef)
        )
        row = r.one()
        don_amount += row.total
        if row.donors:
            don_donors.update(d for d in row.donors if d is not None)

        result.append(
            GivingTypeEntry(
                category="donations_paddle_raise",
                total_amount=float(don_amount),
                donor_count=len(don_donors),
            )
        )

        # Silent auction
        r = await self.db.execute(
            select(
                func.coalesce(func.sum(AuctionBid.bid_amount), 0).label("total"),
                func.count(distinct(AuctionBid.user_id)).label("donors"),
            )
            .join(Event, AuctionBid.event_id == Event.id)
            .join(AuctionItem, AuctionBid.auction_item_id == AuctionItem.id)
            .where(
                AuctionBid.bid_status == BidStatus.WINNING.value,
                AuctionItem.auction_type == "silent",
                ef,
            )
        )
        row = r.one()
        result.append(
            GivingTypeEntry(
                category="silent_auction", total_amount=float(row.total), donor_count=row.donors
            )
        )

        # Live auction
        r = await self.db.execute(
            select(
                func.coalesce(func.sum(QuickEntryBid.amount), 0).label("total"),
                func.count(distinct(QuickEntryBid.donor_user_id)).label("donors"),
            )
            .join(Event, QuickEntryBid.event_id == Event.id)
            .where(
                QuickEntryBid.donor_user_id.isnot(None),
                QuickEntryBid.status == QuickEntryBidStatus.WINNING,
                ef,
            )
        )
        row = r.one()
        result.append(
            GivingTypeEntry(
                category="live_auction", total_amount=float(row.total), donor_count=row.donors
            )
        )

        # Buy-now
        r = await self.db.execute(
            select(
                func.coalesce(func.sum(QuickEntryBuyNowBid.amount), 0).label("total"),
                func.count(distinct(QuickEntryBuyNowBid.donor_user_id)).label("donors"),
            )
            .join(Event, QuickEntryBuyNowBid.event_id == Event.id)
            .where(QuickEntryBuyNowBid.donor_user_id.isnot(None), ef)
        )
        row = r.one()
        result.append(
            GivingTypeEntry(
                category="buy_now", total_amount=float(row.total), donor_count=row.donors
            )
        )

        return result

    async def _get_auction_category_breakdown(
        self, event_filter: Any
    ) -> list[AuctionCategoryEntry]:
        """Aggregate auction bid data by item category."""
        stmt = (
            select(
                func.coalesce(AuctionItem.category, "Other").label("category"),
                func.coalesce(func.sum(AuctionBid.bid_amount), 0).label("total_bid_amount"),
                func.coalesce(
                    func.sum(
                        case(
                            (
                                AuctionBid.bid_status == BidStatus.WINNING.value,
                                AuctionBid.bid_amount,
                            ),
                            else_=literal(0),
                        )
                    ),
                    0,
                ).label("total_revenue"),
                func.count(AuctionBid.id).label("bid_count"),
                func.count(distinct(AuctionItem.id)).label("item_count"),
            )
            .join(AuctionItem, AuctionBid.auction_item_id == AuctionItem.id)
            .join(Event, AuctionBid.event_id == Event.id)
            .where(
                AuctionBid.bid_status.notin_(
                    [BidStatus.CANCELLED.value, BidStatus.WITHDRAWN.value]
                ),
                event_filter,
            )
            .group_by(AuctionItem.category)
            .order_by(func.sum(AuctionBid.bid_amount).desc())
        )
        rows = (await self.db.execute(stmt)).all()
        return [
            AuctionCategoryEntry(
                category=r.category,
                total_bid_amount=float(r.total_bid_amount),
                total_revenue=float(r.total_revenue),
                bid_count=r.bid_count,
                item_count=r.item_count,
            )
            for r in rows
        ]

    # ------------------------------------------------------------------
    # CSV Export
    # ------------------------------------------------------------------

    async def export_leaderboard_csv(
        self,
        accessible_npo_ids: list[UUID],
        *,
        event_id: UUID | None = None,
        sort_by: str = "total_given",
        sort_order: str = "desc",
        search: str | None = None,
    ) -> str:
        """Generate CSV string of the full leaderboard (all rows, paginated internally)."""
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(
            [
                "Rank",
                "First Name",
                "Last Name",
                "Email",
                "Active",
                "Total Given",
                "Events Attended",
                "Tickets",
                "Donations",
                "Silent Auction",
                "Live Auction",
                "Buy Now",
            ]
        )

        page = 1
        batch_size = 500
        rank = 0
        known_total: int | None = None
        while True:
            result = await self.get_leaderboard(
                accessible_npo_ids,
                event_id=event_id,
                sort_by=sort_by,
                sort_order=sort_order,
                search=search,
                page=page,
                per_page=batch_size,
                _known_total=known_total,
            )
            if known_total is None:
                known_total = result.total
            for entry in result.items:
                rank += 1
                writer.writerow(
                    [
                        rank,
                        entry.first_name,
                        entry.last_name,
                        entry.email,
                        "Yes" if entry.is_active else "No",
                        f"{entry.total_given:.2f}",
                        entry.events_attended,
                        f"{entry.ticket_total:.2f}",
                        f"{entry.donation_total:.2f}",
                        f"{entry.silent_auction_total:.2f}",
                        f"{entry.live_auction_total:.2f}",
                        f"{entry.buy_now_total:.2f}",
                    ]
                )
            if page >= result.pages:
                break
            page += 1

        return output.getvalue()
