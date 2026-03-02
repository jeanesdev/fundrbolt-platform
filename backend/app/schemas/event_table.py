"""Pydantic schemas for table customization (Feature 014)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Base Schemas (T012)


class EventTableBase(BaseModel):
    """Base schema for event table customization."""

    custom_capacity: int | None = Field(
        None,
        ge=1,
        le=20,
        description="Custom capacity override (1-20); NULL uses event default",
    )
    table_name: str | None = Field(
        None,
        max_length=50,
        description="Optional friendly name for the table",
    )

    @field_validator("table_name")
    @classmethod
    def validate_table_name(cls, v: str | None) -> str | None:
        """Convert empty strings to None, trim whitespace."""
        if v is not None:
            v = v.strip()
            if len(v) == 0:
                return None
        return v


# Update Schemas (T013)


class EventTableUpdate(EventTableBase):
    """Schema for updating table details."""

    table_captain_id: UUID | None = Field(
        None,
        description="Guest UUID to designate as table captain",
    )

    @field_validator("custom_capacity")
    @classmethod
    def validate_capacity_range(cls, v: int | None) -> int | None:
        """Ensure capacity is within valid range."""
        if v is not None and (v < 1 or v > 20):
            raise ValueError("Custom capacity must be between 1 and 20")
        return v


# Response Schemas (T014)


class TableCaptainSummary(BaseModel):
    """Summary information about a table captain (T015)."""

    id: UUID
    first_name: str
    last_name: str

    model_config = ConfigDict(from_attributes=True)


class EventTableResponse(BaseModel):
    """Response schema for table details (T014)."""

    id: UUID
    event_id: UUID
    table_number: int
    custom_capacity: int | None
    table_name: str | None
    table_captain: TableCaptainSummary | None
    current_occupancy: int
    effective_capacity: int
    is_full: bool
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EventTablesListResponse(BaseModel):
    """Response schema for listing all tables in an event."""

    event_id: UUID
    event_max_guests_per_table: int | None
    tables: list[EventTableResponse]
    summary: dict[str, int]

    model_config = ConfigDict(from_attributes=True)


# Donor View Schemas (T056)


class TableAssignment(BaseModel):
    """Schema for donor's table assignment information."""

    table_number: int
    table_name: str | None
    captain_full_name: str | None
    you_are_captain: bool

    model_config = ConfigDict(from_attributes=True)
