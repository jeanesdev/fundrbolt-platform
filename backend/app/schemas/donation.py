"""Donation Pydantic schemas."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

DonationStatusType = Literal["active", "voided"]
LabelMatchMode = Literal["all", "any"]


class DonationCreateRequest(BaseModel):
    """Schema for creating a donation."""

    donor_user_id: uuid.UUID
    amount: Annotated[Decimal, Field(gt=0, max_digits=12, decimal_places=2)]
    is_paddle_raise: bool = False
    label_ids: list[uuid.UUID] = Field(default_factory=list)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "donor_user_id": "c6a9f049-8488-49aa-a7f7-e70af24459b6",
                "amount": "250.00",
                "is_paddle_raise": True,
                "label_ids": ["8ad610f2-c7a0-492e-9fa0-1480cb2f2a8f"],
            }
        }
    )


class DonationUpdateRequest(BaseModel):
    """Schema for updating a donation."""

    amount: Annotated[Decimal, Field(gt=0, max_digits=12, decimal_places=2)] | None = None
    is_paddle_raise: bool | None = None
    label_ids: list[uuid.UUID] | None = None

    @model_validator(mode="after")
    def validate_has_update_fields(self) -> "DonationUpdateRequest":
        """Require at least one mutable field in patch payload."""
        if self.amount is None and self.is_paddle_raise is None and self.label_ids is None:
            raise ValueError("At least one field must be provided")
        return self

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "amount": "300.00",
                "is_paddle_raise": False,
                "label_ids": ["8ad610f2-c7a0-492e-9fa0-1480cb2f2a8f"],
            }
        }
    )


class DonationResponse(BaseModel):
    """Schema for donation API responses."""

    id: uuid.UUID
    event_id: uuid.UUID
    donor_user_id: uuid.UUID
    amount: Decimal
    is_paddle_raise: bool
    status: DonationStatusType
    label_ids: list[uuid.UUID]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "ad1dea6d-bf48-4f63-95f1-68c7532e04e8",
                "event_id": "596a1f5e-5c50-42b6-a7fb-06dbda29c465",
                "donor_user_id": "c6a9f049-8488-49aa-a7f7-e70af24459b6",
                "amount": "300.00",
                "is_paddle_raise": False,
                "status": "active",
                "label_ids": ["8ad610f2-c7a0-492e-9fa0-1480cb2f2a8f"],
                "created_at": "2026-02-25T12:00:00Z",
                "updated_at": "2026-02-25T12:05:00Z",
            }
        },
    )


class DonationListResponse(BaseModel):
    """Schema for list donation responses."""

    items: list[DonationResponse]


class DonationListFilters(BaseModel):
    """Schema for donation list filter arguments."""

    donor_user_id: uuid.UUID | None = None
    is_paddle_raise: bool | None = None
    include_voided: bool = False
    label_ids: list[uuid.UUID] = Field(default_factory=list)
    label_match_mode: LabelMatchMode = "all"
