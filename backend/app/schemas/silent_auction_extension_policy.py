"""Pydantic schemas for event-level silent auction extension policy."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class SilentAuctionExtensionPolicyBase(BaseModel):
    auto_extension_enabled: bool = True
    trigger_window_minutes: int = Field(default=3, ge=1)
    extension_duration_minutes: int = Field(default=3, ge=1, le=10)
    max_total_extension_minutes: int = Field(default=30, ge=0, le=60)


class SilentAuctionExtensionPolicyUpdate(BaseModel):
    auto_extension_enabled: bool
    extension_duration_minutes: int = Field(ge=1, le=10)
    max_total_extension_minutes: int = Field(ge=0, le=60)


class SilentAuctionExtensionPolicyResponse(SilentAuctionExtensionPolicyBase):
    id: UUID
    event_id: UUID
    updated_by_user_id: UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SilentAuctionExtensionEvaluation(BaseModel):
    extension_applied_minutes: int = Field(ge=0)
    item_effective_close_at: datetime | None = None
    max_extension_reached: bool = False


class SilentAuctionItemTimingResponse(BaseModel):
    auction_item_id: UUID
    original_close_at: datetime
    effective_close_at: datetime
    total_extension_minutes_applied: int = Field(ge=0)

    model_config = {"from_attributes": True}
