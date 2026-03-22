"""Pydantic schemas for ticket purchasing, assignment, and invitation flows.

T007 — Donor ticket purchasing feature.
"""

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

# ===== Cart & Checkout Schemas =====


class CartItem(BaseModel):
    """A single item in the shopping cart."""

    package_id: uuid.UUID
    quantity: int = Field(..., ge=1, le=100)


class SponsorshipDetails(BaseModel):
    """Sponsor information attached to a sponsorship-tier purchase."""

    company_name: str = Field(..., max_length=200)
    logo_blob_name: str = Field(..., description="Blob name returned by the logo upload endpoint")
    website_url: str | None = Field(default=None, max_length=500)
    contact_name: str | None = Field(default=None, max_length=200)
    contact_email: str | None = Field(default=None, max_length=254)


class CheckoutRequest(BaseModel):
    """Request body for POST /tickets/checkout."""

    items: list[CartItem] = Field(..., min_length=1)
    promo_code: str | None = None
    payment_profile_id: uuid.UUID | None = None
    sponsorship_details: SponsorshipDetails | None = None


class CartValidationRequest(BaseModel):
    """Request body for POST /tickets/cart/validate — pre-checkout price check."""

    items: list[CartItem] = Field(..., min_length=1)
    promo_code: str | None = None


class CartItemValidation(BaseModel):
    """Validation result for a single cart item."""

    package_id: uuid.UUID
    package_name: str
    quantity: int
    unit_price: Decimal
    line_total: Decimal
    quantity_remaining: int | None = Field(
        default=None, description="Remaining packages available (None = unlimited)"
    )
    is_sold_out: bool
    warning: str | None = Field(default=None, description='e.g. "Only 3 remaining"')


class CartValidationResponse(BaseModel):
    """Response for POST /tickets/cart/validate."""

    items: list[CartItemValidation]
    subtotal: Decimal
    discount: Decimal = Decimal("0")
    promo_code_applied: str | None = None
    total: Decimal
    warnings: list[str] = Field(default_factory=list)
    per_donor_limit: int | None = None
    current_donor_ticket_count: int = 0


class PurchaseSummary(BaseModel):
    """Summary of a single package purchase within a checkout."""

    purchase_id: uuid.UUID
    package_name: str
    quantity: int
    total_price: Decimal
    ticket_numbers: list[str] = Field(..., description="Generated QR code strings for each ticket")


class CheckoutResponse(BaseModel):
    """Response for POST /tickets/checkout."""

    success: bool
    purchases: list[PurchaseSummary]
    total_charged: Decimal
    transaction_id: uuid.UUID | None = None
    receipt_url: str | None = None


# ===== Ticket Inventory Schemas =====


class AssignmentSummary(BaseModel):
    """Compact assignment info embedded in a ticket detail."""

    id: uuid.UUID
    guest_name: str
    guest_email: str
    status: str
    is_self_assignment: bool
    invitation_sent_at: datetime | None = None
    invitation_count: int = 0
    registered_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class TicketDetail(BaseModel):
    """Detail for a single assigned ticket within a purchase."""

    id: uuid.UUID
    ticket_number: int
    qr_code: str
    assignment_status: str = Field(
        ...,
        description="unassigned | assigned | invited | registered",
    )
    assignment: AssignmentSummary | None = None

    model_config = ConfigDict(from_attributes=True)


class PurchaseDetail(BaseModel):
    """A purchase record with its child tickets."""

    id: uuid.UUID
    package_name: str
    package_id: uuid.UUID
    quantity: int
    total_price: Decimal
    purchased_at: datetime
    payment_status: str
    tickets: list[TicketDetail]

    model_config = ConfigDict(from_attributes=True)


class EventTicketSummary(BaseModel):
    """Ticket inventory grouped by event."""

    event_id: uuid.UUID
    event_name: str
    event_slug: str
    event_date: datetime
    total_tickets: int
    assigned_count: int
    registered_count: int
    unassigned_count: int
    purchases: list[PurchaseDetail]


class TicketInventoryResponse(BaseModel):
    """Response for GET /tickets/inventory — all tickets owned by the donor."""

    events: list[EventTicketSummary]
    total_tickets: int
    total_assigned: int
    total_registered: int
    total_unassigned: int


# ===== Assignment Schemas =====


class AssignTicketRequest(BaseModel):
    """Request body for POST /tickets/{ticket_id}/assign."""

    guest_name: str = Field(..., max_length=200)
    guest_email: EmailStr


class AssignTicketResponse(BaseModel):
    """Response for POST /tickets/{ticket_id}/assign."""

    id: uuid.UUID
    assigned_ticket_id: uuid.UUID
    guest_name: str
    guest_email: str
    status: str
    is_self_assignment: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AssignmentUpdateRequest(BaseModel):
    """Request body for PATCH /tickets/assignments/{assignment_id}."""

    guest_name: str | None = Field(default=None, max_length=200)
    guest_email: EmailStr | None = None


class SelfRegisterRequest(BaseModel):
    """Request body for POST /tickets/{ticket_id}/register — donor self-registration."""

    phone: str | None = Field(default=None, max_length=20)
    meal_selection_id: uuid.UUID | None = None
    custom_responses: dict[str, str] = Field(
        default_factory=dict, description="Mapping of option_id to response_value"
    )


class SelfRegisterResponse(BaseModel):
    """Response for POST /tickets/{ticket_id}/register."""

    registration_id: uuid.UUID
    assignment_id: uuid.UUID
    event_id: uuid.UUID
    status: str

    model_config = ConfigDict(from_attributes=True)


# ===== Invitation Schemas =====


class InvitationSendRequest(BaseModel):
    """Request body for POST /tickets/assignments/{assignment_id}/invite."""

    personal_message: str | None = Field(default=None, max_length=500)


class InvitationSendResponse(BaseModel):
    """Response for POST /tickets/assignments/{assignment_id}/invite."""

    invitation_id: uuid.UUID
    assignment_id: uuid.UUID
    email_address: str
    sent_at: datetime
    invitation_count: int


class InvitationValidateResponse(BaseModel):
    """Response for GET /invitations/{token}/validate — public, no auth required."""

    valid: bool
    expired: bool = False
    already_registered: bool = False
    event_name: str | None = None
    event_date: datetime | None = None
    event_slug: str | None = None
    guest_name: str | None = None
    guest_email: str | None = None
    assignment_id: uuid.UUID | None = None


class InvitationRegisterRequest(BaseModel):
    """Request body for POST /invitations/{token}/register — guest completes registration."""

    phone: str | None = Field(default=None, max_length=20)
    meal_selection_id: uuid.UUID | None = None
    custom_responses: dict[str, str] = Field(default_factory=dict)


class InvitationRegisterResponse(BaseModel):
    """Response for POST /invitations/{token}/register."""

    registration_id: uuid.UUID
    event_id: uuid.UUID
    event_slug: str
    status: str

    model_config = ConfigDict(from_attributes=True)


# ===== Purchase History Schemas =====


class PurchaseHistoryItem(BaseModel):
    """A single purchase in the donor's history."""

    id: uuid.UUID
    event_name: str
    event_slug: str
    event_date: datetime
    package_name: str
    quantity: int
    total_price: Decimal
    discount_amount: Decimal = Decimal("0")
    promo_code: str | None = None
    payment_status: str
    purchased_at: datetime
    receipt_url: str | None = None

    model_config = ConfigDict(from_attributes=True)


class PurchaseHistoryResponse(BaseModel):
    """Paginated response for GET /tickets/purchases."""

    purchases: list[PurchaseHistoryItem]
    total_count: int
    page: int
    per_page: int


# ===== Sponsor Logo Upload Schema =====


class SponsorLogoUploadResponse(BaseModel):
    """Response for POST /tickets/sponsor-logo — upload a sponsor logo."""

    blob_name: str
    preview_url: str
