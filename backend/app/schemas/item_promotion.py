"""Pydantic schemas for item promotions."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ItemPromotionUpdate(BaseModel):
    """Schema for updating item promotion."""

    badge_label: str | None = Field(None, max_length=50)
    notice_message: str | None = Field(None, max_length=1000)


class ItemPromotionResponse(BaseModel):
    """Schema for item promotion response."""

    id: UUID
    item_id: UUID
    event_id: UUID
    badge_label: str | None
    notice_message: str | None
    updated_by_user_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
