"""Pydantic schemas for quick sale at check-in."""

import uuid
from decimal import Decimal

from pydantic import BaseModel, EmailStr, Field


class QuickSaleGuestInfo(BaseModel):
    """Guest information for quick sale."""

    name: str = Field(..., min_length=1, max_length=255, description="Guest's full name")
    email: EmailStr | None = Field(None, description="Guest's email address (optional)")
    phone: str | None = Field(None, max_length=20, description="Guest's phone number (optional)")


class QuickSaleRequest(BaseModel):
    """Request schema for quick ticket sale at check-in."""

    ticket_package_id: uuid.UUID = Field(..., description="ID of the ticket package to purchase")
    quantity: int = Field(default=1, ge=1, le=20, description="Number of tickets to purchase")
    buyer_name: str = Field(..., min_length=1, max_length=255, description="Buyer's full name")
    buyer_email: EmailStr = Field(..., description="Buyer's email address")
    buyer_phone: str | None = Field(None, max_length=20, description="Buyer's phone number")
    guests: list[QuickSaleGuestInfo] = Field(
        default_factory=list,
        description="Additional guests (buyer is automatically the first guest)",
    )
    payment_method: str = Field(
        default="cash", description="Payment method: cash, check, card, other"
    )
    check_in_immediately: bool = Field(
        default=True, description="Check in all guests immediately after purchase"
    )
    notes: str | None = Field(None, max_length=500, description="Optional notes for this sale")


class QuickSaleGuestResult(BaseModel):
    """Result for a single guest in the quick sale."""

    id: uuid.UUID
    registration_id: uuid.UUID
    name: str
    email: str | None
    phone: str | None
    is_primary: bool
    checked_in: bool
    bidder_number: int | None = None

    class Config:
        from_attributes = True


class QuickSaleResponse(BaseModel):
    """Response schema for quick sale creation."""

    purchase_id: uuid.UUID
    registration_id: uuid.UUID
    confirmation_code: str
    ticket_count: int
    package_name: str
    total_amount: Decimal
    payment_method: str
    guests: list[QuickSaleGuestResult]
    message: str

    class Config:
        from_attributes = True
