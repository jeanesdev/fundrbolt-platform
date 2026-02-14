"""
Event Dashboard Service

Provides aggregation and business logic for the admin event dashboard including:
- Dashboard summary with totals, goals, variance, and pacing
- Revenue breakdowns by source
- Projection scenarios (base, optimistic, conservative)
- Segment drilldowns (table, guest, registrant, company)
- Conversion funnel data
- Alert generation for underperforming sources
"""

import logging
from datetime import datetime, date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Event,
    EventRegistration,
    RegistrationGuest,
    EventTable,
    AuctionItem,
    AuctionBid,
    Sponsor,
    User,
)
from app.schemas.event_dashboard import (
    DashboardSummary,
    RevenueSourceSummary,
    PacingStatusResponse,
    PacingStatus,
    Trajectory,
    MoneyValue,
    RevenueSource,
    CashflowPoint,
    WaterfallStep,
    FunnelStage,
    FunnelStageType,
    AlertCard,
    AlertStatus,
    SegmentBreakdownResponse,
    SegmentBreakdownItem,
    SegmentType,
    ProjectionAdjustmentSet,
    ProjectionAdjustment,
    ScenarioType,
)

logger = logging.getLogger(__name__)


class EventDashboardService:
    """Service for event dashboard data aggregation and calculations"""

    @staticmethod
    async def get_dashboard_summary(
        db: AsyncSession,
        event_id: UUID,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        sources: Optional[list[str]] = None,
        scenario: ScenarioType = ScenarioType.BASE,
    ) -> DashboardSummary:
        """
        Get complete dashboard summary for an event

        Args:
            db: Database session
            event_id: Event ID
            start_date: Optional filter start date
            end_date: Optional filter end date
            sources: Optional filter for revenue sources
            scenario: Projection scenario type

        Returns:
            DashboardSummary with all dashboard data
        """
        logger.info(f"Getting dashboard summary for event {event_id}, scenario={scenario}")

        # Get event with goal
        event_query = select(Event).where(Event.id == event_id)
        result = await db.execute(event_query)
        event = result.scalar_one_or_none()

        if not event:
            raise ValueError(f"Event {event_id} not found")

        # Calculate totals by source
        revenue_by_source = await EventDashboardService._calculate_revenue_by_source(
            db, event_id, start_date, end_date, sources
        )

        # Get projections for scenario
        projections = await EventDashboardService._get_projections(db, event_id, scenario)

        # Calculate summary values
        total_actual = sum(rev["actual"] for rev in revenue_by_source.values())
        total_projected = sum(rev["projected"] for rev in revenue_by_source.values())
        goal = event.goal_amount or Decimal("0")

        variance_amount = goal - total_actual
        variance_percent = float((variance_amount / goal * 100)) if goal > 0 else 0.0

        # Calculate pacing
        pacing = await EventDashboardService._calculate_pacing(db, event, total_actual, start_date, end_date)

        # Build source summaries
        source_summaries = []
        for source_code, rev_data in revenue_by_source.items():
            source_summaries.append(
                RevenueSourceSummary(
                    source=RevenueSource(source_code),
                    actual=MoneyValue(amount=rev_data["actual"]),
                    projected=MoneyValue(amount=rev_data["projected"]),
                    target=MoneyValue(amount=rev_data["target"]),
                    variance_amount=MoneyValue(amount=rev_data["target"] - rev_data["actual"]),
                    variance_percent=float((rev_data["target"] - rev_data["actual"]) / rev_data["target"] * 100)
                    if rev_data["target"] > 0
                    else 0.0,
                    pacing_percent=rev_data.get("pacing_percent", 0.0),
                )
            )

        # Get waterfall data
        waterfall = await EventDashboardService._build_waterfall(revenue_by_source)

        # Get cashflow data
        cashflow = await EventDashboardService._calculate_cashflow(db, event_id, start_date, end_date)

        # Get funnel data
        funnel = await EventDashboardService._calculate_funnel(db, event_id)

        # Get alerts
        alerts = await EventDashboardService._generate_alerts(db, event_id, revenue_by_source, pacing)

        return DashboardSummary(
            event_id=str(event_id),
            goal=MoneyValue(amount=goal),
            total_actual=MoneyValue(amount=total_actual),
            total_projected=MoneyValue(amount=total_projected),
            variance_amount=MoneyValue(amount=variance_amount),
            variance_percent=variance_percent,
            pacing=pacing,
            sources=source_summaries,
            waterfall=waterfall,
            cashflow=cashflow,
            funnel=funnel,
            alerts=alerts,
            last_refreshed_at=datetime.utcnow(),
        )

    @staticmethod
    async def _calculate_revenue_by_source(
        db: AsyncSession,
        event_id: UUID,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        sources: Optional[list[str]] = None,
    ) -> dict:
        """Calculate actual and projected revenue by source"""
        logger.info(f"Calculating revenue by source for event {event_id}")

        # Initialize all sources with zeros
        revenue_data = {
            source.value: {"actual": Decimal("0"), "projected": Decimal("0"), "target": Decimal("0")}
            for source in RevenueSource
        }

        # TODO: Calculate actual revenue from:
        # - Tickets (ticket_sales table)
        # - Sponsorships (sponsors table)
        # - Silent/Live Auction (auction_bids table)
        # - Donations (donations table if exists)
        # - Paddle Raise (paddle_raise table if exists)

        # For now, return placeholder data
        # This will be implemented with actual queries in the next iteration

        return revenue_data

    @staticmethod
    async def _get_projections(
        db: AsyncSession, event_id: UUID, scenario: ScenarioType
    ) -> dict:
        """Get projection values for a scenario"""
        logger.info(f"Getting projections for event {event_id}, scenario={scenario}")

        # TODO: Implement projection storage and retrieval
        # For now, return placeholder data based on actuals with multipliers
        # Base: 1.2x actual, Optimistic: 1.5x, Conservative: 1.1x

        return {}

    @staticmethod
    async def _calculate_pacing(
        db: AsyncSession,
        event: Event,
        total_actual: Decimal,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> PacingStatusResponse:
        """Calculate pacing status relative to goal trajectory"""
        logger.info(f"Calculating pacing for event {event.id}")

        # Linear pacing from event start to goal by event end
        goal = event.goal_amount or Decimal("0")
        if goal == 0:
            return PacingStatusResponse(status=PacingStatus.OFF_TRACK, pacing_percent=0.0, trajectory=Trajectory.LINEAR)

        # Calculate expected progress based on timeline
        now = datetime.utcnow()
        if event.starts_at and event.ends_at:
            total_duration = (event.ends_at - event.starts_at).total_seconds()
            elapsed = (now - event.starts_at).total_seconds()
            timeline_percent = (elapsed / total_duration * 100) if total_duration > 0 else 0
        else:
            timeline_percent = 50.0  # Default if dates not set

        # Calculate actual progress
        actual_percent = float(total_actual / goal * 100)

        # Pacing percent = actual progress / expected progress
        pacing_percent = (actual_percent / timeline_percent * 100) if timeline_percent > 0 else 0

        # On track if within 90% of expected pacing
        status = PacingStatus.ON_TRACK if pacing_percent >= 90 else PacingStatus.OFF_TRACK

        return PacingStatusResponse(status=status, pacing_percent=pacing_percent, trajectory=Trajectory.LINEAR)

    @staticmethod
    async def _build_waterfall(revenue_by_source: dict) -> list[WaterfallStep]:
        """Build waterfall chart data from revenue sources"""
        logger.info("Building waterfall chart data")

        waterfall = []
        for source_code, rev_data in revenue_by_source.items():
            if rev_data["actual"] > 0:
                waterfall.append(WaterfallStep(label=source_code.replace("_", " ").title(), amount=MoneyValue(amount=rev_data["actual"])))

        return waterfall

    @staticmethod
    async def _calculate_cashflow(
        db: AsyncSession, event_id: UUID, start_date: Optional[date] = None, end_date: Optional[date] = None
    ) -> list[CashflowPoint]:
        """Calculate cashflow timeline data"""
        logger.info(f"Calculating cashflow for event {event_id}")

        # TODO: Implement cashflow aggregation by date
        # Group transactions by date and calculate cumulative totals

        return []

    @staticmethod
    async def _calculate_funnel(db: AsyncSession, event_id: UUID) -> list[FunnelStage]:
        """Calculate conversion funnel data"""
        logger.info(f"Calculating funnel for event {event_id}")

        # Count invited (if we track invitations)
        invited_count = 0  # TODO: Implement if invitation tracking exists

        # Count registered
        registered_query = select(func.count()).select_from(EventRegistration).where(EventRegistration.event_id == event_id)
        registered_result = await db.execute(registered_query)
        registered_count = registered_result.scalar() or 0

        # Count checked in
        checked_in_query = (
            select(func.count())
            .select_from(RegistrationGuest)
            .join(EventRegistration)
            .where(and_(EventRegistration.event_id == event_id, RegistrationGuest.checked_in_at.isnot(None)))
        )
        checked_in_result = await db.execute(checked_in_query)
        checked_in_count = checked_in_result.scalar() or 0

        # Count donated/bid (guests with bids or donations)
        donated_bid_count = 0  # TODO: Calculate guests with activity

        return [
            FunnelStage(stage=FunnelStageType.INVITED, count=invited_count),
            FunnelStage(stage=FunnelStageType.REGISTERED, count=registered_count),
            FunnelStage(stage=FunnelStageType.CHECKED_IN, count=checked_in_count),
            FunnelStage(stage=FunnelStageType.DONATED_BID, count=donated_bid_count),
        ]

    @staticmethod
    async def _generate_alerts(
        db: AsyncSession, event_id: UUID, revenue_by_source: dict, pacing: PacingStatusResponse
    ) -> list[AlertCard]:
        """Generate alerts for underperforming sources"""
        logger.info(f"Generating alerts for event {event_id}")

        alerts = []

        # Check each source for underperformance (below 90% of pacing)
        for source_code, rev_data in revenue_by_source.items():
            source_pacing = rev_data.get("pacing_percent", 0.0)
            if source_pacing < 90.0:
                # TODO: Track consecutive refreshes for 2+ threshold
                alerts.append(
                    AlertCard(
                        source=RevenueSource(source_code),
                        status=AlertStatus.ACTIVE,
                        threshold_percent=90.0,
                        consecutive_refreshes=2,
                        triggered_at=datetime.utcnow(),
                    )
                )

        return alerts

    @staticmethod
    async def get_segment_breakdown(
        db: AsyncSession,
        event_id: UUID,
        segment_type: SegmentType,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        limit: int = 100,
        sort: str = "total_amount",
    ) -> SegmentBreakdownResponse:
        """Get segment breakdown by type (table, guest, registrant, company)"""
        logger.info(f"Getting segment breakdown for event {event_id}, type={segment_type}")

        items = []

        if segment_type == SegmentType.TABLE:
            # TODO: Aggregate by table
            pass
        elif segment_type == SegmentType.GUEST:
            # TODO: Aggregate by guest
            pass
        elif segment_type == SegmentType.REGISTRANT:
            # TODO: Aggregate by registrant
            pass
        elif segment_type == SegmentType.COMPANY:
            # TODO: Aggregate by company
            pass

        return SegmentBreakdownResponse(segment_type=segment_type, items=items)

    @staticmethod
    async def get_projection_adjustments(
        db: AsyncSession, event_id: UUID, scenario: ScenarioType = ScenarioType.BASE
    ) -> ProjectionAdjustmentSet:
        """Get projection adjustments for an event and scenario"""
        logger.info(f"Getting projection adjustments for event {event_id}, scenario={scenario}")

        # TODO: Retrieve from storage
        # For now, return empty set
        return ProjectionAdjustmentSet(
            event_id=str(event_id), scenario=scenario, adjustments=[], updated_at=datetime.utcnow()
        )

    @staticmethod
    async def update_projection_adjustments(
        db: AsyncSession, event_id: UUID, scenario: ScenarioType, adjustments: list[ProjectionAdjustment], user_id: UUID
    ) -> ProjectionAdjustmentSet:
        """Update projection adjustments for an event and scenario"""
        logger.info(f"Updating projection adjustments for event {event_id}, scenario={scenario}")

        # TODO: Store adjustments
        # For now, return the input as confirmation

        return ProjectionAdjustmentSet(
            event_id=str(event_id),
            scenario=scenario,
            adjustments=adjustments,
            updated_at=datetime.utcnow(),
            updated_by=str(user_id),
        )
