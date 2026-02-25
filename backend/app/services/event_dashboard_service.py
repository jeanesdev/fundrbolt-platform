"""Service for admin event dashboard aggregations."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import TypedDict
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auction_bid import AuctionBid, BidStatus, PaddleRaiseContribution
from app.models.event import Event
from app.models.event_registration import EventRegistration
from app.models.registration_guest import RegistrationGuest
from app.models.sponsor import Sponsor
from app.models.ticket_management import PaymentStatus, TicketPurchase
from app.schemas.event_dashboard import (
    AlertCard,
    CashflowPoint,
    DashboardSummary,
    FunnelStage,
    MoneyValue,
    PacingStatus,
    ProjectionAdjustment,
    ProjectionAdjustmentSet,
    ProjectionAdjustmentUpdate,
    RevenueSourceSummary,
    ScenarioType,
    SegmentBreakdownItem,
    SegmentBreakdownResponse,
    SegmentType,
    SortType,
    WaterfallStep,
)


class SegmentRow(TypedDict):
    """Internal segment row type."""

    segment_id: str
    segment_label: str
    total_amount: Decimal
    guest_count: int


_PROJECTION_OVERRIDES: dict[tuple[str, ScenarioType], dict[str, Decimal]] = {}


class EventDashboardService:
    """Compute event dashboard views from event data."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _get_event(self, event_id: UUID) -> Event | None:
        result = await self.db.execute(select(Event).where(Event.id == event_id))
        return result.scalar_one_or_none()

    async def _get_source_actuals(self, event_id: UUID) -> dict[str, Decimal]:
        ticket_stmt = select(func.coalesce(func.sum(TicketPurchase.total_price), 0)).where(
            TicketPurchase.event_id == event_id,
            TicketPurchase.payment_status == PaymentStatus.COMPLETED,
        )
        sponsor_stmt = select(func.coalesce(func.sum(Sponsor.donation_amount), 0)).where(
            Sponsor.event_id == event_id
        )
        auction_item_high_bids = (
            select(
                AuctionBid.auction_item_id.label("auction_item_id"),
                func.max(AuctionBid.bid_amount).label("max_bid"),
            )
            .where(
                AuctionBid.event_id == event_id,
                AuctionBid.bid_status.in_(
                    [
                        BidStatus.ACTIVE.value,
                        BidStatus.OUTBID.value,
                        BidStatus.WINNING.value,
                    ]
                ),
            )
            .group_by(AuctionBid.auction_item_id)
            .subquery()
        )
        auction_stmt = select(func.coalesce(func.sum(auction_item_high_bids.c.max_bid), 0))
        paddle_stmt = select(func.coalesce(func.sum(PaddleRaiseContribution.amount), 0)).where(
            PaddleRaiseContribution.event_id == event_id
        )

        tickets_total = Decimal((await self.db.execute(ticket_stmt)).scalar_one() or 0)
        sponsorship_total = Decimal((await self.db.execute(sponsor_stmt)).scalar_one() or 0)
        auction_total = Decimal((await self.db.execute(auction_stmt)).scalar_one() or 0)
        paddle_total = Decimal((await self.db.execute(paddle_stmt)).scalar_one() or 0)

        return {
            "tickets": tickets_total,
            "sponsorships": sponsorship_total,
            "silent_auction": auction_total,
            "paddle_raise": paddle_total,
            "donations": Decimal("0"),
            "fees_other": Decimal("0"),
        }

    def _default_multiplier(self, scenario: ScenarioType) -> Decimal:
        if scenario == "optimistic":
            return Decimal("1.25")
        if scenario == "conservative":
            return Decimal("0.95")
        return Decimal("1.10")

    def _money(self, amount: Decimal) -> MoneyValue:
        return MoneyValue(amount=float(round(amount, 2)), currency="USD")

    def _percent(self, numerator: Decimal, denominator: Decimal) -> float:
        if denominator <= 0:
            return 0.0
        return float(round((numerator / denominator) * Decimal("100"), 2))

    async def get_projection_adjustments(
        self,
        event_id: UUID,
        scenario: ScenarioType = "base",
        reference_now: datetime | None = None,
    ) -> ProjectionAdjustmentSet:
        now = reference_now or datetime.now(UTC)
        source_actuals = await self._get_source_actuals(event_id)
        key = (str(event_id), scenario)
        overrides = _PROJECTION_OVERRIDES.get(key, {})

        multiplier = self._default_multiplier(scenario)
        adjustments: list[ProjectionAdjustment] = []

        for source, actual in source_actuals.items():
            projected = overrides.get(source, actual * multiplier)
            adjustments.append(
                ProjectionAdjustment(
                    source=source,
                    projected=self._money(projected),
                )
            )

        return ProjectionAdjustmentSet(
            event_id=event_id,
            scenario=scenario,
            adjustments=adjustments,
            updated_at=now,
            updated_by="system",
        )

    async def update_projection_adjustments(
        self,
        event_id: UUID,
        payload: ProjectionAdjustmentUpdate,
        updated_by: str,
        reference_now: datetime | None = None,
    ) -> ProjectionAdjustmentSet:
        now = reference_now or datetime.now(UTC)
        key = (str(event_id), payload.scenario)
        overrides = _PROJECTION_OVERRIDES.setdefault(key, {})

        for adjustment in payload.adjustments:
            overrides[adjustment.source] = Decimal(str(adjustment.projected.amount))

        projection_set = await self.get_projection_adjustments(
            event_id,
            payload.scenario,
            reference_now=now,
        )
        projection_set.updated_by = updated_by
        projection_set.updated_at = now
        return projection_set

    async def _funnel(self, event_id: UUID) -> list[FunnelStage]:
        registered_stmt = select(func.count(EventRegistration.id)).where(
            EventRegistration.event_id == event_id
        )
        guests_stmt = (
            select(func.count(RegistrationGuest.id))
            .join(EventRegistration, RegistrationGuest.registration_id == EventRegistration.id)
            .where(EventRegistration.event_id == event_id)
        )
        checked_in_stmt = (
            select(func.count(RegistrationGuest.id))
            .join(EventRegistration, RegistrationGuest.registration_id == EventRegistration.id)
            .where(
                EventRegistration.event_id == event_id,
                RegistrationGuest.checked_in.is_(True),
            )
        )
        donated_bid_stmt = select(func.count(AuctionBid.id)).where(
            AuctionBid.event_id == event_id,
            AuctionBid.bid_status == BidStatus.WINNING.value,
        )

        registered = int((await self.db.execute(registered_stmt)).scalar_one() or 0)
        guests = int((await self.db.execute(guests_stmt)).scalar_one() or 0)
        checked_in = int((await self.db.execute(checked_in_stmt)).scalar_one() or 0)
        donated_bid = int((await self.db.execute(donated_bid_stmt)).scalar_one() or 0)

        invited = max(registered + guests, registered)

        return [
            FunnelStage(stage="invited", count=invited),
            FunnelStage(stage="registered", count=registered + guests),
            FunnelStage(stage="checked_in", count=checked_in),
            FunnelStage(stage="donated_bid", count=donated_bid),
        ]

    async def get_dashboard_summary(
        self,
        event_id: UUID,
        scenario: ScenarioType = "base",
        reference_now: datetime | None = None,
    ) -> DashboardSummary:
        now = reference_now or datetime.now(UTC)
        event = await self._get_event(event_id)
        if event is None:
            raise ValueError("Event not found")

        source_actuals = await self._get_source_actuals(event_id)
        projection_set = await self.get_projection_adjustments(
            event_id,
            scenario,
            reference_now=now,
        )
        projection_map = {
            p.source: Decimal(str(p.projected.amount)) for p in projection_set.adjustments
        }

        source_summaries: list[RevenueSourceSummary] = []
        alerts: list[AlertCard] = []

        total_actual = Decimal("0")
        total_projected = Decimal("0")

        for source, actual in source_actuals.items():
            projected = projection_map.get(source, actual)
            target = (actual * Decimal("1.15")) if actual > 0 else projected
            variance_amount = projected - actual
            pacing_percent = self._percent(actual, target)
            variance_percent = self._percent(variance_amount, actual) if actual > 0 else 0.0

            total_actual += actual
            total_projected += projected

            source_summaries.append(
                RevenueSourceSummary(
                    source=source,
                    actual=self._money(actual),
                    projected=self._money(projected),
                    target=self._money(target),
                    variance_amount=self._money(variance_amount),
                    variance_percent=variance_percent,
                    pacing_percent=pacing_percent,
                )
            )

            if target > 0 and pacing_percent < 90:
                alerts.append(
                    AlertCard(
                        source=source,
                        status="active",
                        threshold_percent=90,
                        consecutive_refreshes=2,
                        triggered_at=now,
                    )
                )

        configured_goal = (
            Decimal(str(event.fundraising_goal))
            if event.fundraising_goal is not None
            else Decimal("0")
        )
        goal_amount = (
            configured_goal
            if configured_goal > 0
            else max(total_projected, total_actual, Decimal("1"))
        )
        variance_total = total_projected - total_actual

        pacing = PacingStatus(
            status="on_track" if total_projected >= goal_amount * Decimal("0.9") else "off_track",
            pacing_percent=self._percent(total_projected, goal_amount),
            trajectory="linear",
        )

        waterfall = [
            WaterfallStep(label="Actual", amount=self._money(total_actual)),
            WaterfallStep(label="Projected", amount=self._money(total_projected)),
            WaterfallStep(label="Variance", amount=self._money(variance_total)),
        ]

        today = now.date()
        cashflow: list[CashflowPoint] = []
        for offset in range(5, -1, -1):
            period_date = today - timedelta(days=offset * 7)
            divisor = Decimal("6")
            progress = Decimal(str(6 - offset)) / divisor
            cashflow.append(
                CashflowPoint(
                    date=period_date,
                    actual=self._money(total_actual * progress),
                    projected=self._money(total_projected * progress),
                )
            )

        return DashboardSummary(
            event_id=event_id,
            goal=self._money(goal_amount),
            total_actual=self._money(total_actual),
            total_projected=self._money(total_projected),
            variance_amount=self._money(variance_total),
            variance_percent=self._percent(variance_total, total_actual)
            if total_actual > 0
            else 0.0,
            pacing=pacing,
            sources=source_summaries,
            waterfall=waterfall,
            cashflow=cashflow,
            funnel=await self._funnel(event_id),
            alerts=alerts,
            last_refreshed_at=now,
        )

    async def _guest_rows(self, event_id: UUID) -> list[tuple[RegistrationGuest, UUID]]:
        stmt = (
            select(RegistrationGuest, EventRegistration.user_id)
            .join(EventRegistration, RegistrationGuest.registration_id == EventRegistration.id)
            .where(EventRegistration.event_id == event_id)
        )
        result = await self.db.execute(stmt)
        return [(row[0], row[1]) for row in result.all()]

    async def _winning_bid_totals(self, event_id: UUID) -> dict[int, Decimal]:
        current_item_leaders = (
            select(
                AuctionBid.auction_item_id.label("auction_item_id"),
                AuctionBid.bidder_number.label("bidder_number"),
                AuctionBid.bid_amount.label("bid_amount"),
                func.row_number()
                .over(
                    partition_by=AuctionBid.auction_item_id,
                    order_by=(AuctionBid.bid_amount.desc(), AuctionBid.placed_at.asc()),
                )
                .label("row_num"),
            )
            .where(
                AuctionBid.event_id == event_id,
                AuctionBid.bid_status.in_(
                    [
                        BidStatus.ACTIVE.value,
                        BidStatus.OUTBID.value,
                        BidStatus.WINNING.value,
                    ]
                ),
                AuctionBid.bidder_number.is_not(None),
            )
            .subquery()
        )
        stmt = (
            select(
                current_item_leaders.c.bidder_number,
                func.coalesce(func.sum(current_item_leaders.c.bid_amount), 0),
            )
            .where(current_item_leaders.c.row_num == 1)
            .group_by(current_item_leaders.c.bidder_number)
        )
        result = await self.db.execute(stmt)
        rows = list(result.all())
        return {int(row[0]): Decimal(row[1]) for row in rows if row[0] is not None}

    async def _ticket_totals_by_user(self, event_id: UUID) -> dict[UUID, Decimal]:
        stmt = (
            select(TicketPurchase.user_id, func.coalesce(func.sum(TicketPurchase.total_price), 0))
            .where(
                TicketPurchase.event_id == event_id,
                TicketPurchase.payment_status == PaymentStatus.COMPLETED,
            )
            .group_by(TicketPurchase.user_id)
        )
        result = await self.db.execute(stmt)
        rows = list(result.all())
        return {UUID(str(row[0])): Decimal(row[1]) for row in rows if row[0] is not None}

    def _to_segment_response(
        self,
        segment_type: SegmentType,
        rows: list[SegmentRow],
        sort: SortType,
        limit: int,
    ) -> SegmentBreakdownResponse:
        total_amount_all = sum((row["total_amount"] for row in rows), Decimal("0"))

        if sort == "contribution_share":
            rows.sort(
                key=lambda row: (row["total_amount"] / total_amount_all)
                if total_amount_all > 0
                else Decimal("0"),
                reverse=True,
            )
        else:
            rows.sort(key=lambda row: row["total_amount"], reverse=True)

        items = [
            SegmentBreakdownItem(
                segment_id=row["segment_id"],
                segment_label=row["segment_label"],
                total_amount=self._money(row["total_amount"]),
                contribution_share=round(
                    float(row["total_amount"] / total_amount_all) if total_amount_all > 0 else 0.0,
                    4,
                ),
                guest_count=row["guest_count"],
            )
            for row in rows[:limit]
        ]

        return SegmentBreakdownResponse(segment_type=segment_type, items=items)

    async def get_segment_breakdown(
        self,
        event_id: UUID,
        segment_type: SegmentType,
        limit: int = 20,
        sort: SortType = "total_amount",
    ) -> SegmentBreakdownResponse:
        guest_rows = await self._guest_rows(event_id)
        bid_totals = await self._winning_bid_totals(event_id)
        ticket_totals_by_user = await self._ticket_totals_by_user(event_id)

        if segment_type == "table":
            table_map: dict[str, SegmentRow] = {}
            for guest, user_id in guest_rows:
                table_number = guest.table_number if guest.table_number is not None else 0
                key = str(table_number)
                if key not in table_map:
                    table_map[key] = {
                        "segment_id": key,
                        "segment_label": f"Table {table_number}" if table_number else "Unassigned",
                        "total_amount": Decimal("0"),
                        "guest_count": 0,
                    }
                table_map[key]["guest_count"] += 1
                if guest.bidder_number is not None:
                    table_map[key]["total_amount"] += bid_totals.get(
                        guest.bidder_number, Decimal("0")
                    )
                if guest.is_primary:
                    table_map[key]["total_amount"] += ticket_totals_by_user.get(
                        user_id, Decimal("0")
                    )

            return self._to_segment_response(segment_type, list(table_map.values()), sort, limit)

        if segment_type == "guest":
            rows: list[SegmentRow] = []
            for guest, user_id in guest_rows:
                guest_id = str(guest.id)
                label = guest.name or guest.email or f"Guest {guest_id[:8]}"
                total = bid_totals.get(guest.bidder_number or -1, Decimal("0"))
                if guest.is_primary:
                    total += ticket_totals_by_user.get(user_id, Decimal("0"))
                rows.append(
                    {
                        "segment_id": guest_id,
                        "segment_label": label,
                        "total_amount": total,
                        "guest_count": 1,
                    }
                )
            return self._to_segment_response(segment_type, rows, sort, limit)

        if segment_type == "registrant":
            registrant_map: dict[str, SegmentRow] = {}
            for guest, user_id in guest_rows:
                key = str(user_id)
                if key not in registrant_map:
                    registrant_map[key] = {
                        "segment_id": key,
                        "segment_label": guest.name or guest.email or f"Registrant {key[:8]}",
                        "total_amount": ticket_totals_by_user.get(user_id, Decimal("0")),
                        "guest_count": 0,
                    }
                registrant_map[key]["guest_count"] += 1
                if guest.bidder_number is not None:
                    registrant_map[key]["total_amount"] += bid_totals.get(
                        guest.bidder_number, Decimal("0")
                    )
            return self._to_segment_response(
                segment_type, list(registrant_map.values()), sort, limit
            )

        company_map: dict[str, SegmentRow] = {}
        for guest, user_id in guest_rows:
            email = guest.email or ""
            domain = email.split("@")[-1].lower() if "@" in email else "unknown"
            if domain not in company_map:
                company_map[domain] = {
                    "segment_id": domain,
                    "segment_label": domain if domain != "unknown" else "Unknown",
                    "total_amount": Decimal("0"),
                    "guest_count": 0,
                }
            company_map[domain]["guest_count"] += 1
            if guest.bidder_number is not None:
                company_map[domain]["total_amount"] += bid_totals.get(
                    guest.bidder_number, Decimal("0")
                )
            if guest.is_primary:
                company_map[domain]["total_amount"] += ticket_totals_by_user.get(
                    user_id, Decimal("0")
                )

        return self._to_segment_response(segment_type, list(company_map.values()), sort, limit)
