"""
Event Dashboard Schemas

Pydantic models for event dashboard data including:
- Summary with totals, goals, and variance
- Revenue breakdowns by source
- Projections with scenarios
- Pacing status
- Segment drilldowns
- Alerts
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class RevenueSource(str, Enum):
    """Revenue source categories"""

    TICKETS = "tickets"
    SPONSORSHIPS = "sponsorships"
    SILENT_AUCTION = "silent_auction"
    LIVE_AUCTION = "live_auction"
    PADDLE_RAISE = "paddle_raise"
    DONATIONS = "donations"
    FEES_OTHER = "fees_other"


class PacingStatus(str, Enum):
    """Pacing status relative to goal trajectory"""

    ON_TRACK = "on_track"
    OFF_TRACK = "off_track"


class Trajectory(str, Enum):
    """Trajectory type for goal pacing"""

    LINEAR = "linear"


class ScenarioType(str, Enum):
    """Projection scenario types"""

    BASE = "base"
    OPTIMISTIC = "optimistic"
    CONSERVATIVE = "conservative"


class SegmentType(str, Enum):
    """Segment types for drilldown"""

    TABLE = "table"
    GUEST = "guest"
    REGISTRANT = "registrant"
    COMPANY = "company"


class FunnelStageType(str, Enum):
    """Conversion funnel stages"""

    INVITED = "invited"
    REGISTERED = "registered"
    CHECKED_IN = "checked_in"
    DONATED_BID = "donated_bid"


class AlertStatus(str, Enum):
    """Alert status"""

    ACTIVE = "active"
    RESOLVED = "resolved"


class MoneyValue(BaseModel):
    """Money value with currency"""

    amount: Decimal = Field(..., description="Monetary amount")
    currency: str = Field(default="USD", description="Currency code")

    model_config = ConfigDict(
        json_encoders={Decimal: str}, json_schema_extra={"example": {"amount": "1500.00", "currency": "USD"}}
    )


class RevenueSourceSummary(BaseModel):
    """Revenue summary for a specific source"""

    source: RevenueSource = Field(..., description="Revenue source")
    actual: MoneyValue = Field(..., description="Actual amount raised")
    projected: MoneyValue = Field(..., description="Projected total amount")
    target: MoneyValue = Field(..., description="Target amount for this source")
    variance_amount: MoneyValue = Field(..., description="Variance from target (target - actual)")
    variance_percent: float = Field(..., description="Variance as percentage")
    pacing_percent: float = Field(..., description="Pacing percentage relative to timeline")

    model_config = ConfigDict(json_schema_extra={"example": {"source": "tickets", "actual": {"amount": "15000.00", "currency": "USD"}, "projected": {"amount": "20000.00", "currency": "USD"}, "target": {"amount": "25000.00", "currency": "USD"}, "variance_amount": {"amount": "10000.00", "currency": "USD"}, "variance_percent": 40.0, "pacing_percent": 75.0}})


class PacingStatusResponse(BaseModel):
    """Pacing status response"""

    status: PacingStatus = Field(..., description="Current pacing status")
    pacing_percent: float = Field(..., description="Overall pacing percentage")
    trajectory: Trajectory = Field(default=Trajectory.LINEAR, description="Trajectory type")

    model_config = ConfigDict(json_schema_extra={"example": {"status": "on_track", "pacing_percent": 85.0, "trajectory": "linear"}})


class CashflowPoint(BaseModel):
    """Single point in cashflow timeline"""

    date: str = Field(..., description="Date in ISO format")
    actual: MoneyValue = Field(..., description="Actual funds on this date")
    projected: Optional[MoneyValue] = Field(None, description="Projected funds on this date")

    model_config = ConfigDict(json_schema_extra={"example": {"date": "2026-02-01", "actual": {"amount": "5000.00", "currency": "USD"}, "projected": {"amount": "7000.00", "currency": "USD"}}})


class WaterfallStep(BaseModel):
    """Single step in waterfall chart"""

    label: str = Field(..., description="Step label (source or category)")
    amount: MoneyValue = Field(..., description="Amount for this step")

    model_config = ConfigDict(json_schema_extra={"example": {"label": "Tickets", "amount": {"amount": "15000.00", "currency": "USD"}}})


class FunnelStage(BaseModel):
    """Single stage in conversion funnel"""

    stage: FunnelStageType = Field(..., description="Funnel stage")
    count: int = Field(..., ge=0, description="Count for this stage")

    model_config = ConfigDict(json_schema_extra={"example": {"stage": "registered", "count": 150}})


class AlertCard(BaseModel):
    """Alert card for underperformance"""

    source: RevenueSource = Field(..., description="Revenue source")
    status: AlertStatus = Field(..., description="Alert status")
    threshold_percent: float = Field(default=90.0, description="Threshold percentage")
    consecutive_refreshes: int = Field(..., ge=2, description="Number of consecutive refreshes")
    triggered_at: datetime = Field(..., description="When alert was triggered")
    resolved_at: Optional[datetime] = Field(None, description="When alert was resolved")

    model_config = ConfigDict(json_schema_extra={"example": {"source": "sponsorships", "status": "active", "threshold_percent": 90.0, "consecutive_refreshes": 3, "triggered_at": "2026-02-07T10:00:00Z"}})


class DashboardSummary(BaseModel):
    """Complete dashboard summary response"""

    event_id: str = Field(..., description="Event ID")
    goal: MoneyValue = Field(..., description="Event fundraising goal")
    total_actual: MoneyValue = Field(..., description="Total actual funds raised")
    total_projected: MoneyValue = Field(..., description="Total projected funds")
    variance_amount: MoneyValue = Field(..., description="Variance from goal (goal - actual)")
    variance_percent: float = Field(..., description="Variance as percentage")
    pacing: PacingStatusResponse = Field(..., description="Pacing status")
    sources: list[RevenueSourceSummary] = Field(..., description="Revenue breakdown by source")
    waterfall: list[WaterfallStep] = Field(..., description="Waterfall chart data")
    cashflow: list[CashflowPoint] = Field(..., description="Cashflow timeline data")
    funnel: list[FunnelStage] = Field(..., description="Conversion funnel data")
    alerts: list[AlertCard] = Field(..., description="Active alerts")
    last_refreshed_at: datetime = Field(..., description="Last refresh timestamp")

    model_config = ConfigDict(json_schema_extra={"example": {"event_id": "123e4567-e89b-12d3-a456-426614174000", "goal": {"amount": "100000.00", "currency": "USD"}, "total_actual": {"amount": "75000.00", "currency": "USD"}, "total_projected": {"amount": "95000.00", "currency": "USD"}, "variance_amount": {"amount": "25000.00", "currency": "USD"}, "variance_percent": 25.0, "pacing": {"status": "on_track", "pacing_percent": 85.0, "trajectory": "linear"}, "sources": [], "waterfall": [], "cashflow": [], "funnel": [], "alerts": [], "last_refreshed_at": "2026-02-07T12:00:00Z"}})


class SegmentBreakdownItem(BaseModel):
    """Single segment breakdown item"""

    segment_id: str = Field(..., description="Segment identifier")
    segment_label: str = Field(..., description="Segment display label")
    total_amount: MoneyValue = Field(..., description="Total amount for this segment")
    contribution_share: float = Field(..., ge=0, le=1, description="Share of total (0-1)")
    guest_count: int = Field(..., ge=0, description="Number of guests in segment")

    model_config = ConfigDict(json_schema_extra={"example": {"segment_id": "table-5", "segment_label": "Table 5 - VIP Sponsors", "total_amount": {"amount": "12000.00", "currency": "USD"}, "contribution_share": 0.16, "guest_count": 10}})


class SegmentBreakdownResponse(BaseModel):
    """Segment breakdown response"""

    segment_type: SegmentType = Field(..., description="Type of segment")
    items: list[SegmentBreakdownItem] = Field(..., description="Segment items")

    model_config = ConfigDict(json_schema_extra={"example": {"segment_type": "table", "items": []}})


class ProjectionAdjustment(BaseModel):
    """Single projection adjustment for a revenue source"""

    source: RevenueSource = Field(..., description="Revenue source")
    projected: MoneyValue = Field(..., description="Projected amount")

    model_config = ConfigDict(json_schema_extra={"example": {"source": "tickets", "projected": {"amount": "25000.00", "currency": "USD"}}})


class ProjectionAdjustmentSet(BaseModel):
    """Set of projection adjustments for an event"""

    event_id: str = Field(..., description="Event ID")
    scenario: ScenarioType = Field(..., description="Scenario type")
    adjustments: list[ProjectionAdjustment] = Field(..., description="Projection adjustments")
    updated_at: datetime = Field(..., description="Last update timestamp")
    updated_by: Optional[str] = Field(None, description="User who updated")

    model_config = ConfigDict(json_schema_extra={"example": {"event_id": "123e4567-e89b-12d3-a456-426614174000", "scenario": "optimistic", "adjustments": [], "updated_at": "2026-02-07T12:00:00Z", "updated_by": "admin@example.com"}})


class ProjectionAdjustmentUpdate(BaseModel):
    """Update request for projection adjustments"""

    scenario: ScenarioType = Field(..., description="Scenario type")
    adjustments: list[ProjectionAdjustment] = Field(..., description="Projection adjustments to apply")

    model_config = ConfigDict(json_schema_extra={"example": {"scenario": "optimistic", "adjustments": [{"source": "tickets", "projected": {"amount": "30000.00", "currency": "USD"}}]}})
