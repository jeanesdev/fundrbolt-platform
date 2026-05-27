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

    # Address fields (optional)
    address_line1: str | None = Field(None, max_length=255, description="Street address line 1")
    address_line2: str | None = Field(None, max_length=255, description="Street address line 2")
    city: str | None = Field(None, max_length=100, description="City")
    state: str | None = Field(None, max_length=100, description="State/Province")
    postal_code: str | None = Field(None, max_length=20, description="ZIP/Postal code")
    country: str | None = Field(None, max_length=100, description="Country")

    guests: list[QuickSaleGuestInfo] = Field(
        default_factory=list,
        description="All attendees (buyer is separate and may or may not be attending)",
    )
    payment_method: str = Field(
        default="cash", description="Payment method: cash, check, card, other"
    )
    # Payment details (optional, based on payment method)
    card_last_four: str | None = Field(
        None, max_length=4, description="Last 4 digits of card (if card payment)"
    )
    check_number: str | None = Field(
        None, max_length=50, description="Check number (if check payment)"
    )

    # Bidder and table assignment (optional - null means auto-assign)
    bidder_number: int | None = Field(
        None, ge=100, le=999, description="Bidder number (100-999), or null to auto-assign"
    )
    table_number: int | None = Field(
        None, ge=1, description="Table number, or null to auto-assign to next available"
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
    table_number: int | None = None

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
