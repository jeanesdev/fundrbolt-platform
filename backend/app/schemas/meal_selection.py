"""Pydantic schemas for Meal Selection management."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

# ================================
# Request Schemas
# ================================


class MealSelectionCreateRequest(BaseModel):
    """Request schema for creating a meal selection."""

    registration_id: uuid.UUID = Field(..., description="ID of the event registration")
    guest_id: uuid.UUID | None = Field(
        default=None,
        description="ID of the guest (NULL for registrant's meal)",
    )
    food_option_id: uuid.UUID = Field(..., description="ID of the selected food option")


class MealSelectionUpdateRequest(BaseModel):
    """Request schema for updating a meal selection."""

    food_option_id: uuid.UUID = Field(..., description="Updated food option ID")


# ================================
# Response Schemas
# ================================


class MealSelectionResponse(BaseModel):
    """Response schema for meal selection details."""

    id: uuid.UUID
    registration_id: uuid.UUID
    guest_id: uuid.UUID | None
    food_option_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MealSelectionListResponse(BaseModel):
    """Response schema for list of meal selections."""

    meal_selections: list[MealSelectionResponse]
    total: int


class MealSelectionSummary(BaseModel):
    """Summary of meal selections for an event (for catering planning)."""

    food_option_name: str
    food_option_description: str | None
    count: int


class MealSelectionSummaryResponse(BaseModel):
    """Response schema for meal selection summary."""

    event_id: uuid.UUID
    event_name: str
    total_attendees: int
    meal_summary: list[MealSelectionSummary]
