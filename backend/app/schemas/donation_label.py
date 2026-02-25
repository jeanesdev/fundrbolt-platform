"""Donation label Pydantic schemas."""

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, model_validator


class DonationLabelCreateRequest(BaseModel):
    """Schema for creating a donation label."""

    name: Annotated[str, Field(min_length=1, max_length=100)]

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "Last Hero",
            }
        }
    )


class DonationLabelUpdateRequest(BaseModel):
    """Schema for updating a donation label."""

    name: Annotated[str, Field(min_length=1, max_length=100)] | None = None
    is_active: bool | None = None

    @model_validator(mode="after")
    def validate_has_update_fields(self) -> "DonationLabelUpdateRequest":
        """Require at least one mutable field in patch payload."""
        if self.name is None and self.is_active is None:
            raise ValueError("At least one field must be provided")
        return self


class DonationLabelResponse(BaseModel):
    """Schema for donation label response payloads."""

    id: uuid.UUID
    event_id: uuid.UUID
    name: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "8ad610f2-c7a0-492e-9fa0-1480cb2f2a8f",
                "event_id": "596a1f5e-5c50-42b6-a7fb-06dbda29c465",
                "name": "Last Hero",
                "is_active": True,
                "created_at": "2026-02-25T12:00:00Z",
                "updated_at": "2026-02-25T12:00:00Z",
            }
        },
    )


class DonationLabelListResponse(BaseModel):
    """Schema for list donation labels responses."""

    items: list[DonationLabelResponse]
