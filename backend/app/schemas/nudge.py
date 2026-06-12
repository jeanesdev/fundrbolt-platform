"""Pydantic schemas and constants for Revenue Nudge feature."""

from __future__ import annotations

import enum
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class NudgeType(str, enum.Enum):
    WATCHERS_NO_BID = "watchers_no_bid"
    ITEMS_NO_BIDS = "items_no_bids"
    ITEMS_MOST_BIDS = "items_most_bids"
    CLOSING_SOON_WATCHERS = "closing_soon_watchers"
    OUTBID_STILL_WATCHING = "outbid_still_watching"
    NON_PARTICIPATING_ATTENDEES = "non_participating_attendees"
    REVENUE_GENERATOR_LOW_PARTICIPATION = "revenue_generator_low_participation"
    REVENUE_GENERATORS_NOT_STARTED = "revenue_generators_not_started"
    GOAL_PROGRESS = "goal_progress"
    GOAL_MILESTONE_APPROACHING = "goal_milestone_approaching"
    PARETO_DONORS = "pareto_donors"
    CHECKED_IN_NO_ACTIVITY = "checked_in_no_activity"
    PADDLE_RAISE_MOMENTUM = "paddle_raise_momentum"


NUDGE_BASE_RANKS: dict[NudgeType, int] = {
    NudgeType.CLOSING_SOON_WATCHERS: 1,
    NudgeType.WATCHERS_NO_BID: 2,
    NudgeType.NON_PARTICIPATING_ATTENDEES: 2,
    NudgeType.REVENUE_GENERATORS_NOT_STARTED: 2,
    NudgeType.GOAL_MILESTONE_APPROACHING: 2,
    NudgeType.PADDLE_RAISE_MOMENTUM: 2,
    NudgeType.OUTBID_STILL_WATCHING: 3,
    NudgeType.ITEMS_NO_BIDS: 3,
    NudgeType.REVENUE_GENERATOR_LOW_PARTICIPATION: 3,
    NudgeType.CHECKED_IN_NO_ACTIVITY: 3,
    NudgeType.PARETO_DONORS: 4,
    NudgeType.ITEMS_MOST_BIDS: 5,
    NudgeType.GOAL_PROGRESS: 5,
}

NOTIFYING_NUDGE_TYPES: frozenset[NudgeType] = frozenset(
    k for k, v in NUDGE_BASE_RANKS.items() if v <= 2
)

GOAL_MILESTONE_THRESHOLDS: list[int] = [75, 85, 90, 95, 100]


class NudgeItem(BaseModel):
    nudge_key: str
    nudge_type: NudgeType
    rank: int = Field(ge=1, le=5)
    title: str
    description: str
    action_url: str | None = None
    action_label: str | None = None
    affected_count: int = 0
    metadata: dict[str, Any] = Field(default_factory=dict)
    is_dismissible: bool = True
    notifies_on_appear: bool = False
    is_dismissed: bool = False


class NudgesResponse(BaseModel):
    nudges: list[NudgeItem]
    total_count: int
    active_count: int
    computed_at: datetime


class DismissNudgeRequest(BaseModel):
    action: Literal["dismissed", "actioned"]


class DismissNudgeResponse(BaseModel):
    nudge_key: str
    action: str
    expires_at: datetime | None = None
