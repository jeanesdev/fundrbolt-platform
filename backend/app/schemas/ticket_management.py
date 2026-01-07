"""Pydantic schemas for ticket package management."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.ticket_management import DiscountType, OptionType, PaymentStatus

# ===== Ticket Package Schemas =====


class TicketPackageBase(BaseModel):
    """Base schema for ticket package data."""

    name: str = Field(..., min_length=1, max_length=100, description="Package name")
    description: str | None = Field(
        None, max_length=5000, description="Package description (Markdown)"
    )
    price: Decimal = Field(..., ge=0, max_digits=10, decimal_places=2, description="Price in USD")
    seats_per_package: int = Field(..., ge=1, le=100, description="Number of seats included")
    quantity_limit: int | None = Field(
        None, ge=1, description="Maximum packages available (NULL = unlimited)"
    )
    is_enabled: bool = Field(True, description="Visibility to donors")

    @field_validator("price")
    @classmethod
    def validate_price(cls, v: Decimal) -> Decimal:
        """Ensure price has max 2 decimal places."""
        exponent = v.as_tuple().exponent
        if isinstance(exponent, int) and exponent < -2:
            raise ValueError("Price must have at most 2 decimal places")
        return v


class TicketPackageCreate(TicketPackageBase):
    """Schema for creating a ticket package."""

    event_id: uuid.UUID


class TicketPackageUpdate(BaseModel):
    """Schema for updating a ticket package (partial updates)."""

    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = Field(None, max_length=5000)
    price: Decimal | None = Field(None, ge=0, max_digits=10, decimal_places=2)
    seats_per_package: int | None = Field(None, ge=1, le=100)
    quantity_limit: int | None = Field(None, ge=1)
    is_enabled: bool | None = None
    image_url: str | None = Field(None, max_length=500)
    version: int = Field(..., description="Current version for optimistic locking")

    model_config = ConfigDict(extra="forbid")

    @field_validator("price")
    @classmethod
    def validate_price(cls, v: Decimal | None) -> Decimal | None:
        """Ensure price has max 2 decimal places."""
        if v is not None:
            exponent = v.as_tuple().exponent
            if isinstance(exponent, int) and exponent < -2:
                raise ValueError("Price must have at most 2 decimal places")
        return v


class TicketPackageRead(TicketPackageBase):
    """Schema for reading a ticket package."""

    id: uuid.UUID
    event_id: uuid.UUID
    sold_count: int
    display_order: int
    image_url: str | None
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
    version: int

    model_config = ConfigDict(from_attributes=True)


class TicketPackageWithSales(TicketPackageRead):
    """Schema with real-time sales metrics (from Redis cache)."""

    current_sold_count: int = Field(..., description="Real-time sold count from cache")
    remaining_quantity: int | None = Field(
        None, description="Remaining packages (NULL = unlimited)"
    )


# ===== Custom Ticket Option Schemas =====


class CustomTicketOptionBase(BaseModel):
    """Base schema for custom ticket options."""

    option_label: str = Field(..., min_length=1, max_length=200, description="Question text")
    option_type: OptionType
    choices: list[str] | None = Field(
        None, description="Required for multi_select, ignored for boolean/text_input"
    )
    is_required: bool = Field(False, description="Whether donor must answer")
    display_order: int = Field(0, ge=0, description="Ordering in UI")

    @field_validator("choices")
    @classmethod
    def validate_choices(cls, v: list[str] | None, info: Any) -> list[str] | None:
        """Ensure multi_select has choices, others don't."""
        option_type = info.data.get("option_type")
        if option_type == OptionType.MULTI_SELECT:
            if not v or len(v) < 2:
                raise ValueError("multi_select must have at least 2 choices")
        elif v is not None:
            raise ValueError(f"{option_type} cannot have choices")
        return v


class CustomTicketOptionCreate(CustomTicketOptionBase):
    """Schema for creating a custom option."""

    ticket_package_id: uuid.UUID


class CustomTicketOptionRead(CustomTicketOptionBase):
    """Schema for reading a custom option."""

    id: uuid.UUID
    ticket_package_id: uuid.UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ===== Option Response Schemas =====


class OptionResponseCreate(BaseModel):
    """Schema for creating an option response."""

    custom_option_id: uuid.UUID
    response_value: str | None = Field(
        None, max_length=500, description="NULL if skipped optional question"
    )


class OptionResponseRead(BaseModel):
    """Schema for reading an option response."""

    id: uuid.UUID
    ticket_purchase_id: uuid.UUID
    custom_option_id: uuid.UUID
    response_value: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ===== Promo Code Schemas =====


class PromoCodeBase(BaseModel):
    """Base schema for promo codes."""

    code: str = Field(..., min_length=1, max_length=50, description="Promo code (case-insensitive)")
    discount_type: DiscountType
    discount_value: Decimal = Field(
        ..., gt=0, max_digits=10, decimal_places=2, description="Amount or percentage"
    )
    max_uses: int | None = Field(None, ge=1, description="Max redemptions (NULL = unlimited)")
    valid_from: datetime | None = Field(None, description="Start date (NULL = immediately valid)")
    valid_until: datetime | None = Field(None, description="End date (NULL = no expiration)")
    is_active: bool = Field(True, description="Active status")

    @field_validator("discount_value")
    @classmethod
    def validate_discount(cls, v: Decimal, info: Any) -> Decimal:
        """Ensure percentage <= 100, fixed_amount has max 2 decimals."""
        discount_type = info.data.get("discount_type")
        if discount_type == DiscountType.PERCENTAGE and v > 100:
            raise ValueError("Percentage discount cannot exceed 100%")
        exponent = v.as_tuple().exponent
        if isinstance(exponent, int) and exponent < -2:
            raise ValueError("Discount value must have at most 2 decimal places")
        return v

    @field_validator("code")
    @classmethod
    def validate_code(cls, v: str) -> str:
        """Normalize promo code to uppercase."""
        return v.upper().strip()


class PromoCodeCreate(PromoCodeBase):
    """Schema for creating a promo code."""

    event_id: uuid.UUID


class PromoCodeUpdate(BaseModel):
    """Schema for updating a promo code (partial updates)."""

    discount_type: DiscountType | None = None
    discount_value: Decimal | None = Field(None, gt=0, max_digits=10, decimal_places=2)
    max_uses: int | None = Field(None, ge=1)
    valid_from: datetime | None = None
    valid_until: datetime | None = None
    is_active: bool | None = None
    version: int = Field(..., description="Current version for optimistic locking")

    model_config = ConfigDict(extra="forbid")


class PromoCodeRead(PromoCodeBase):
    """Schema for reading a promo code."""

    id: uuid.UUID
    event_id: uuid.UUID
    used_count: int
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
    version: int

    model_config = ConfigDict(from_attributes=True)


class PromoCodeValidationResponse(BaseModel):
    """Schema for promo code validation result."""

    valid: bool
    discount_amount: Decimal | None = None
    error_message: str | None = None


# ===== Ticket Purchase Schemas =====


class TicketPurchaseCreate(BaseModel):
    """Schema for creating a ticket purchase."""

    event_id: uuid.UUID
    ticket_package_id: uuid.UUID
    quantity: int = Field(..., ge=1, description="Number of packages to purchase")
    promo_code: str | None = Field(None, max_length=50, description="Optional promo code")
    option_responses: list[OptionResponseCreate] = Field(default_factory=list)


class TicketPurchaseRead(BaseModel):
    """Schema for reading a ticket purchase."""

    id: uuid.UUID
    event_id: uuid.UUID
    ticket_package_id: uuid.UUID
    user_id: uuid.UUID
    quantity: int
    total_price: Decimal
    payment_status: PaymentStatus
    purchased_at: datetime
    promo_code_applied: PromoCodeRead | None = None
    option_responses: list[OptionResponseRead]

    model_config = ConfigDict(from_attributes=True)


# ===== Assigned Ticket Schemas =====


class AssignedTicketRead(BaseModel):
    """Schema for reading an assigned ticket."""

    id: uuid.UUID
    ticket_purchase_id: uuid.UUID
    ticket_number: int
    qr_code: str
    assigned_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ===== Ticket Audit Log Schemas =====


class TicketAuditLogRead(BaseModel):
    """Schema for reading a ticket audit log entry."""

    id: uuid.UUID
    entity_type: str
    entity_id: uuid.UUID
    coordinator_id: uuid.UUID
    field_name: str
    old_value: str | None
    new_value: str | None
    changed_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ===== Reordering Schema =====


class ReorderRequest(BaseModel):
    """Schema for reordering ticket packages."""

    package_ids: list[uuid.UUID] = Field(
        ..., min_length=1, description="Ordered list of package IDs"
    )


# ===== Sales Report Schema =====


class SalesReportRow(BaseModel):
    """Single row in sales CSV export."""

    package_name: str
    package_price: Decimal
    sold_count: int
    total_revenue: Decimal
    quantity_limit: int | None
    remaining: int | None


class SalesReport(BaseModel):
    """Complete sales report with summary."""

    event_id: uuid.UUID
    event_name: str
    generated_at: datetime
    total_packages_sold: int
    total_revenue: Decimal
    packages: list[SalesReportRow]
