"""Pydantic schemas for item view tracking."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ItemViewCreate(BaseModel):
    """Schema for recording an item view."""

    item_id: UUID
    view_started_at: datetime
    view_duration_seconds: int = Field(..., ge=0)


class ItemViewResponse(BaseModel):
    """Schema for item view response."""

    id: UUID
    item_id: UUID
    event_id: UUID
    user_id: UUID
    view_started_at: datetime
    view_duration_seconds: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ItemViewSummary(BaseModel):
    """Summary of a user's view of an item (for admin)."""

    user_id: UUID
    user_name: str
    view_duration_seconds: int
    last_viewed_at: datetime

    model_config = {"from_attributes": True}
