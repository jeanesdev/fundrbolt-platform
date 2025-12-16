"""Pydantic schemas for seating assignment and bidder number management."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Request Schemas (T007-T009)


class EventSeatingConfigRequest(BaseModel):
    """Request schema for configuring event seating (T007)."""

    table_count: int = Field(..., gt=0, description="Total number of tables")
    max_guests_per_table: int = Field(..., gt=0, description="Maximum guests per table")

    @field_validator("table_count")
    @classmethod
    def validate_table_count(cls, v: int) -> int:
        """Validate table count is within reasonable limits."""
        if v > 1000:  # Reasonable upper limit
            raise ValueError("Table count cannot exceed 1000")
        return v

    @field_validator("max_guests_per_table")
    @classmethod
    def validate_max_guests(cls, v: int) -> int:
        """Validate max guests per table is within reasonable limits."""
        if v > 50:  # Reasonable upper limit
            raise ValueError("Max guests per table cannot exceed 50")
        return v


class EventSeatingConfigResponse(BaseModel):
    """Response schema for event seating configuration (T007)."""

    event_id: UUID
    table_count: int
    max_guests_per_table: int
    total_capacity: int

    model_config = ConfigDict(from_attributes=True)


class TableAssignmentRequest(BaseModel):
    """Request schema for assigning guest(s) to a table (T008)."""

    table_number: int = Field(..., gt=0, description="Target table number")


class TableAssignmentResponse(BaseModel):
    """Response schema for table assignment (T008)."""

    guest_id: UUID
    table_number: int
    bidder_number: int | None

    model_config = ConfigDict(from_attributes=True)


class BulkTableAssignmentRequest(BaseModel):
    """Request schema for assigning multiple guests to tables (T008)."""

    assignments: list[dict[str, UUID | int]] = Field(
        ...,
        description="List of {guest_id: UUID, table_number: int} assignments",
    )


class BulkAssignmentResponse(BaseModel):
    """Response schema for bulk table assignments (T008)."""

    successful_count: int
    failed_count: int
    assignments: list[TableAssignmentResponse]
    errors: list[dict[str, str]] = Field(
        default_factory=list,
        description="List of errors for failed assignments",
    )


class BidderNumberAssignmentRequest(BaseModel):
    """Request schema for manually assigning a bidder number (T009)."""

    bidder_number: int = Field(
        ...,
        ge=100,
        le=999,
        description="Three-digit bidder number",
    )


class BidderNumberAssignmentResponse(BaseModel):
    """Response schema for bidder number assignment (T009)."""

    guest_id: UUID
    bidder_number: int
    assigned_at: datetime
    previous_holder_id: UUID | None = Field(
        None,
        description="Guest ID of previous bidder number holder (if reassigned)",
    )

    model_config = ConfigDict(from_attributes=True)


class AvailableBidderNumbersResponse(BaseModel):
    """Response schema for available bidder numbers (T009)."""

    event_id: UUID
    available_numbers: list[int] = Field(
        ...,
        description="List of available bidder numbers (100-999)",
    )
    total_available: int
    total_assigned: int


# Admin Seating Management Schemas (T010)


class GuestSeatingInfo(BaseModel):
    """Guest seating information for admin views (T010)."""

    guest_id: UUID
    name: str | None
    email: str | None
    bidder_number: int | None
    table_number: int | None
    registration_id: UUID
    checked_in: bool

    model_config = ConfigDict(from_attributes=True)


class GuestSeatingListResponse(BaseModel):
    """Paginated list of guests with seating information (T010)."""

    guests: list[GuestSeatingInfo]
    total: int
    page: int
    per_page: int
    has_more: bool


class TableOccupancyResponse(BaseModel):
    """Response schema for table occupancy information (T010)."""

    table_number: int
    current_occupancy: int
    max_capacity: int
    guests: list[GuestSeatingInfo]
    is_full: bool

    model_config = ConfigDict(from_attributes=True)


class AutoAssignResponse(BaseModel):
    """Response schema for auto-assignment operation (T010)."""

    assigned_count: int
    assignments: list[TableAssignmentResponse]
    unassigned_count: int = 0
    warnings: list[str] = Field(
        default_factory=list,
        description="Warnings for parties that could not be assigned",
    )


# Donor PWA Seating Schemas (T011)


class TablemateInfo(BaseModel):
    """Tablemate information for donor PWA display (T011)."""

    guest_id: UUID
    name: str | None
    bidder_number: int | None
    company: str | None
    profile_image_url: str | None

    model_config = ConfigDict(from_attributes=True)


class MySeatingInfo(BaseModel):
    """Current user's seating information (T011)."""

    guest_id: UUID
    full_name: str | None
    bidder_number: int | None  # NULL if not checked in yet
    table_number: int | None
    checked_in: bool

    model_config = ConfigDict(from_attributes=True)


class SeatingInfoResponse(BaseModel):
    """Response schema for donor PWA seating information display (T011)."""

    my_info: MySeatingInfo = Field(
        ...,
        description="Current user's seating info (bidder_number null if not checked in)",
    )
    tablemates: list[TablemateInfo] = Field(
        ...,
        description="List of guests at the same table",
    )
    table_capacity: dict[str, int] = Field(
        ...,
        description="Current and maximum capacity for the table",
    )
    has_table_assignment: bool
    message: str | None = Field(
        None,
        description="Message to display (e.g., 'Check in at the event to see your bidder number')",
    )
