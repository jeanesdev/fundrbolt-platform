"""Pydantic schemas for NPO-level donations (donate-now page)."""

import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

NpoDonationStatusType = Literal["pending", "captured", "declined", "cancelled"]
RecurrenceStatusType = Literal["active", "cancelled", "completed"]


class DonationCreateRequest(BaseModel):
    """Request body for submitting a donate-now donation."""

    amount_cents: Annotated[int, Field(gt=0, description="Donation amount in cents")]
    covers_processing_fee: bool = False
    is_monthly: bool = False
    recurrence_start: date | None = None
    recurrence_end: date | None = None
    donor_name: str | None = Field(None, max_length=100)
    support_wall_message: str | None = Field(None, max_length=200)
    is_anonymous: bool = False
    show_amount: bool = True
    idempotency_key: str | None = Field(None, max_length=100)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "amount_cents": 5000,
                "covers_processing_fee": True,
                "is_monthly": False,
                "idempotency_key": "donor-uuid-timestamp",
            }
        }
    )


class DonationResponse(BaseModel):
    """Response for a submitted donation."""

    id: uuid.UUID
    npo_id: uuid.UUID
    amount_cents: int
    covers_processing_fee: bool
    processing_fee_cents: int
    total_charged_cents: int
    is_monthly: bool
    recurrence_start: date | None
    recurrence_end: date | None
    recurrence_status: RecurrenceStatusType | None
    next_charge_date: date | None
    status: NpoDonationStatusType
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaymentDeclinedError(BaseModel):
    """Error returned when a payment is declined."""

    detail: str = "Payment declined"
    decline_code: str | None = None
    decline_message: str | None = None
