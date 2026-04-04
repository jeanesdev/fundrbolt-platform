"""Pydantic schemas for donor labels."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class DonorLabelCreateRequest(BaseModel):
    """Request to create a new donor label."""

    name: str = Field(min_length=1, max_length=100)
    color: str | None = Field(None, max_length=7, pattern=r"^#[0-9a-fA-F]{6}$")


class DonorLabelUpdateRequest(BaseModel):
    """Request to update a donor label."""

    name: str | None = Field(None, min_length=1, max_length=100)
    color: str | None = Field(None, max_length=7, pattern=r"^#[0-9a-fA-F]{6}$")


class DonorLabelResponse(BaseModel):
    """Response for a single donor label."""

    id: uuid.UUID
    npo_id: uuid.UUID
    name: str
    color: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DonorLabelListResponse(BaseModel):
    """Response for listing donor labels."""

    items: list[DonorLabelResponse]


class DonorLabelAssignRequest(BaseModel):
    """Request to assign/remove labels on a user."""

    label_ids: list[uuid.UUID]


class DonorLabelAssignmentInfo(BaseModel):
    """A label assigned to a user (returned as part of user detail)."""

    id: uuid.UUID
    name: str
    color: str | None = None

    model_config = {"from_attributes": True}
