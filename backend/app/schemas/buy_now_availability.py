"""Pydantic schemas for buy now availability."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class BuyNowAvailabilityUpdate(BaseModel):
    """Schema for updating buy-now availability."""

    enabled: bool
    remaining_quantity: int = Field(..., ge=0)
    override_reason: str | None = Field(None, max_length=500)


class BuyNowAvailabilityResponse(BaseModel):
    """Schema for buy-now availability response."""

    id: UUID
    item_id: UUID
    event_id: UUID
    enabled: bool
    remaining_quantity: int
    override_reason: str | None
    updated_by_user_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
