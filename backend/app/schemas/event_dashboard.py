"""Pydantic schemas for admin event dashboard endpoints."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

ScenarioType = Literal["base", "optimistic", "conservative"]
SegmentType = Literal["table", "guest", "registrant", "company"]
SortType = Literal["total_amount", "contribution_share"]


class MoneyValue(BaseModel):
    """Monetary value representation."""

    amount: float = Field(default=0)
    currency: str = Field(default="USD")


class RevenueSourceSummary(BaseModel):
    """Summary for one revenue source."""

    source: str
    actual: MoneyValue
    projected: MoneyValue
    target: MoneyValue
    variance_amount: MoneyValue
    variance_percent: float = Field(default=0)
    pacing_percent: float = Field(default=0)


class PacingStatus(BaseModel):
    """Pacing status for an event."""

    status: Literal["on_track", "off_track"]
    pacing_percent: float = Field(default=0)
    trajectory: Literal["linear"] = "linear"


class CashflowPoint(BaseModel):
    """Timeline point for cashflow chart."""

    date: date
    actual: MoneyValue
    projected: MoneyValue


class WaterfallStep(BaseModel):
    """Waterfall chart step."""

    label: str
    amount: MoneyValue


class FunnelStage(BaseModel):
    """Conversion funnel stage."""

    stage: Literal["invited", "registered", "checked_in", "donated_bid"]
    count: int = Field(default=0, ge=0)


class AlertCard(BaseModel):
    """Dashboard alert item."""

    source: str
    status: Literal["active", "resolved"]
    threshold_percent: float = Field(default=90)
    consecutive_refreshes: int = Field(default=0, ge=0)
    triggered_at: datetime | None = None


class DashboardSummary(BaseModel):
    """Main dashboard payload."""

    event_id: UUID
    goal: MoneyValue
    total_actual: MoneyValue
    total_projected: MoneyValue
    variance_amount: MoneyValue
    variance_percent: float = Field(default=0)
    pacing: PacingStatus
    sources: list[RevenueSourceSummary]
    waterfall: list[WaterfallStep]
    cashflow: list[CashflowPoint]
    funnel: list[FunnelStage]
    alerts: list[AlertCard]
    last_refreshed_at: datetime


class SegmentBreakdownItem(BaseModel):
    """Breakdown row for a segment."""

    segment_id: str
    segment_label: str
    total_amount: MoneyValue
    contribution_share: float = Field(default=0)
    guest_count: int = Field(default=0, ge=0)


class SegmentBreakdownResponse(BaseModel):
    """Segment breakdown payload."""

    segment_type: SegmentType
    items: list[SegmentBreakdownItem]


class ProjectionAdjustment(BaseModel):
    """Projected value for a source."""

    source: str
    projected: MoneyValue


class ProjectionAdjustmentSet(BaseModel):
    """Projection scenario values."""

    event_id: UUID
    scenario: ScenarioType
    adjustments: list[ProjectionAdjustment]
    updated_at: datetime
    updated_by: str


class ProjectionAdjustmentUpdate(BaseModel):
    """Request body for projection updates."""

    scenario: ScenarioType = "base"
    adjustments: list[ProjectionAdjustment] = Field(default_factory=list)
