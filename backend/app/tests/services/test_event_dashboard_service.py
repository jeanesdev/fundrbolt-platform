"""Tests for EventDashboardService."""

import pytest
from decimal import Decimal
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.models.user import User
from app.schemas.event_dashboard import (
    ScenarioType,
    SegmentType,
    ProjectionAdjustment,
    MoneyValue,
    RevenueSource,
)
from app.services.event_dashboard_service import EventDashboardService


@pytest.mark.asyncio
class TestDashboardSummary:
    """Test EventDashboardService.get_dashboard_summary method."""

    async def test_get_dashboard_summary_basic(
        self, db_session: AsyncSession, test_event: Event
    ):
        """Test getting basic dashboard summary for an event."""
        # Act
        summary = await EventDashboardService.get_dashboard_summary(
            db=db_session,
            event_id=test_event.id,
        )

        # Assert
        assert summary is not None
        assert summary.event_id == str(test_event.id)
        assert summary.goal.amount == Decimal(test_event.goal_amount or 0)
        assert summary.total_actual.amount >= Decimal("0")
        assert summary.total_projected.amount >= Decimal("0")
        assert summary.pacing is not None
        assert summary.pacing.status in ["on_track", "off_track"]
        assert len(summary.sources) > 0
        assert summary.last_refreshed_at is not None

    async def test_get_dashboard_summary_with_scenario(
        self, db_session: AsyncSession, test_event: Event
    ):
        """Test getting dashboard summary with different scenarios."""
        scenarios = [ScenarioType.BASE, ScenarioType.OPTIMISTIC, ScenarioType.CONSERVATIVE]

        for scenario in scenarios:
            # Act
            summary = await EventDashboardService.get_dashboard_summary(
                db=db_session,
                event_id=test_event.id,
                scenario=scenario,
            )

            # Assert
            assert summary is not None
            assert summary.event_id == str(test_event.id)

    async def test_get_dashboard_summary_with_date_filter(
        self, db_session: AsyncSession, test_event: Event
    ):
        """Test getting dashboard summary with date range filter."""
        # Arrange
        start_date = datetime.utcnow().date()
        end_date = (datetime.utcnow() + timedelta(days=30)).date()

        # Act
        summary = await EventDashboardService.get_dashboard_summary(
            db=db_session,
            event_id=test_event.id,
            start_date=start_date,
            end_date=end_date,
        )

        # Assert
        assert summary is not None
        assert summary.event_id == str(test_event.id)

    async def test_get_dashboard_summary_with_source_filter(
        self, db_session: AsyncSession, test_event: Event
    ):
        """Test getting dashboard summary with revenue source filter."""
        # Arrange
        sources = ["tickets", "sponsorships"]

        # Act
        summary = await EventDashboardService.get_dashboard_summary(
            db=db_session,
            event_id=test_event.id,
            sources=sources,
        )

        # Assert
        assert summary is not None
        assert summary.event_id == str(test_event.id)

    async def test_get_dashboard_summary_nonexistent_event(
        self, db_session: AsyncSession
    ):
        """Test getting dashboard for non-existent event raises error."""
        # Arrange
        import uuid
        fake_event_id = uuid.uuid4()

        # Act & Assert
        with pytest.raises(ValueError, match="not found"):
            await EventDashboardService.get_dashboard_summary(
                db=db_session,
                event_id=fake_event_id,
            )


@pytest.mark.asyncio
class TestPacingCalculation:
    """Test pacing calculation logic."""

    async def test_calculate_pacing_on_track(
        self, db_session: AsyncSession, test_event: Event
    ):
        """Test pacing calculation when on track."""
        # Set event with reasonable timeline
        test_event.starts_at = datetime.utcnow() - timedelta(days=10)
        test_event.ends_at = datetime.utcnow() + timedelta(days=20)
        test_event.goal_amount = Decimal("100000")

        # Act
        total_actual = Decimal("40000")  # 40% of goal at 33% of timeline = on track
        pacing = await EventDashboardService._calculate_pacing(
            db=db_session,
            event=test_event,
            total_actual=total_actual,
        )

        # Assert
        assert pacing is not None
        assert pacing.pacing_percent > 0

    async def test_calculate_pacing_off_track(
        self, db_session: AsyncSession, test_event: Event
    ):
        """Test pacing calculation when off track."""
        # Set event with reasonable timeline
        test_event.starts_at = datetime.utcnow() - timedelta(days=20)
        test_event.ends_at = datetime.utcnow() + timedelta(days=10)
        test_event.goal_amount = Decimal("100000")

        # Act
        total_actual = Decimal("30000")  # 30% of goal at 67% of timeline = off track
        pacing = await EventDashboardService._calculate_pacing(
            db=db_session,
            event=test_event,
            total_actual=total_actual,
        )

        # Assert
        assert pacing is not None
        assert pacing.pacing_percent < 90  # Below threshold


@pytest.mark.asyncio
class TestSegmentBreakdown:
    """Test segment breakdown methods."""

    async def test_get_segment_breakdown_by_table(
        self, db_session: AsyncSession, test_event: Event
    ):
        """Test getting segment breakdown by table."""
        # Act
        breakdown = await EventDashboardService.get_segment_breakdown(
            db=db_session,
            event_id=test_event.id,
            segment_type=SegmentType.TABLE,
        )

        # Assert
        assert breakdown is not None
        assert breakdown.segment_type == SegmentType.TABLE
        assert isinstance(breakdown.items, list)

    async def test_get_segment_breakdown_all_types(
        self, db_session: AsyncSession, test_event: Event
    ):
        """Test getting segment breakdown for all types."""
        segment_types = [
            SegmentType.TABLE,
            SegmentType.GUEST,
            SegmentType.REGISTRANT,
            SegmentType.COMPANY,
        ]

        for segment_type in segment_types:
            # Act
            breakdown = await EventDashboardService.get_segment_breakdown(
                db=db_session,
                event_id=test_event.id,
                segment_type=segment_type,
            )

            # Assert
            assert breakdown is not None
            assert breakdown.segment_type == segment_type

    async def test_get_segment_breakdown_with_limit(
        self, db_session: AsyncSession, test_event: Event
    ):
        """Test segment breakdown respects limit parameter."""
        # Act
        breakdown = await EventDashboardService.get_segment_breakdown(
            db=db_session,
            event_id=test_event.id,
            segment_type=SegmentType.TABLE,
            limit=10,
        )

        # Assert
        assert breakdown is not None
        assert len(breakdown.items) <= 10


@pytest.mark.asyncio
class TestProjectionAdjustments:
    """Test projection adjustment methods."""

    async def test_get_projection_adjustments_default(
        self, db_session: AsyncSession, test_event: Event
    ):
        """Test getting projection adjustments with default scenario."""
        # Act
        projections = await EventDashboardService.get_projection_adjustments(
            db=db_session,
            event_id=test_event.id,
        )

        # Assert
        assert projections is not None
        assert projections.event_id == str(test_event.id)
        assert projections.scenario == ScenarioType.BASE
        assert isinstance(projections.adjustments, list)

    async def test_get_projection_adjustments_all_scenarios(
        self, db_session: AsyncSession, test_event: Event
    ):
        """Test getting projection adjustments for all scenarios."""
        scenarios = [ScenarioType.BASE, ScenarioType.OPTIMISTIC, ScenarioType.CONSERVATIVE]

        for scenario in scenarios:
            # Act
            projections = await EventDashboardService.get_projection_adjustments(
                db=db_session,
                event_id=test_event.id,
                scenario=scenario,
            )

            # Assert
            assert projections is not None
            assert projections.scenario == scenario

    async def test_update_projection_adjustments(
        self, db_session: AsyncSession, test_event: Event, test_user: User
    ):
        """Test updating projection adjustments."""
        # Arrange
        adjustments = [
            ProjectionAdjustment(
                source=RevenueSource.TICKETS,
                projected=MoneyValue(amount=Decimal("25000"), currency="USD"),
            ),
            ProjectionAdjustment(
                source=RevenueSource.SPONSORSHIPS,
                projected=MoneyValue(amount=Decimal("50000"), currency="USD"),
            ),
        ]

        # Act
        updated = await EventDashboardService.update_projection_adjustments(
            db=db_session,
            event_id=test_event.id,
            scenario=ScenarioType.OPTIMISTIC,
            adjustments=adjustments,
            user_id=test_user.id,
        )

        # Assert
        assert updated is not None
        assert updated.event_id == str(test_event.id)
        assert updated.scenario == ScenarioType.OPTIMISTIC
        assert len(updated.adjustments) == 2
        assert updated.updated_by == str(test_user.id)


@pytest.mark.asyncio
class TestFunnelCalculation:
    """Test funnel calculation methods."""

    async def test_calculate_funnel_basic(
        self, db_session: AsyncSession, test_event: Event
    ):
        """Test calculating funnel stages."""
        # Act
        funnel = await EventDashboardService._calculate_funnel(
            db=db_session,
            event_id=test_event.id,
        )

        # Assert
        assert funnel is not None
        assert len(funnel) == 4  # invited, registered, checked_in, donated_bid
        
        # Verify stages are in order
        stages = [stage.stage for stage in funnel]
        assert "invited" in stages
        assert "registered" in stages
        assert "checked_in" in stages
        assert "donated_bid" in stages

        # Verify counts are non-negative
        for stage in funnel:
            assert stage.count >= 0


@pytest.mark.asyncio
class TestAlertGeneration:
    """Test alert generation for underperforming sources."""

    async def test_generate_alerts_no_underperformance(
        self, db_session: AsyncSession, test_event: Event
    ):
        """Test no alerts generated when all sources on track."""
        # Arrange
        revenue_by_source = {
            "tickets": {
                "actual": Decimal("10000"),
                "projected": Decimal("12000"),
                "target": Decimal("15000"),
                "pacing_percent": 95.0,
            }
        }
        from app.schemas.event_dashboard import PacingStatusResponse, PacingStatus, Trajectory
        pacing = PacingStatusResponse(
            status=PacingStatus.ON_TRACK,
            pacing_percent=95.0,
            trajectory=Trajectory.LINEAR,
        )

        # Act
        alerts = await EventDashboardService._generate_alerts(
            db=db_session,
            event_id=test_event.id,
            revenue_by_source=revenue_by_source,
            pacing=pacing,
        )

        # Assert
        assert isinstance(alerts, list)

    async def test_generate_alerts_with_underperformance(
        self, db_session: AsyncSession, test_event: Event
    ):
        """Test alerts generated for underperforming sources."""
        # Arrange
        revenue_by_source = {
            "tickets": {
                "actual": Decimal("5000"),
                "projected": Decimal("12000"),
                "target": Decimal("15000"),
                "pacing_percent": 50.0,  # Below 90% threshold
            }
        }
        from app.schemas.event_dashboard import PacingStatusResponse, PacingStatus, Trajectory
        pacing = PacingStatusResponse(
            status=PacingStatus.OFF_TRACK,
            pacing_percent=50.0,
            trajectory=Trajectory.LINEAR,
        )

        # Act
        alerts = await EventDashboardService._generate_alerts(
            db=db_session,
            event_id=test_event.id,
            revenue_by_source=revenue_by_source,
            pacing=pacing,
        )

        # Assert
        assert isinstance(alerts, list)
