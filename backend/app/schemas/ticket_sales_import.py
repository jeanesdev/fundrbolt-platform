"""Schemas for ticket sales bulk import."""

from __future__ import annotations

from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, Field


class ImportRowStatus(str, Enum):
    """Row-level import status."""

    CREATED = "created"
    SKIPPED = "skipped"
    ERROR = "error"


class IssueSeverity(str, Enum):
    """Severity level for validation issues."""

    ERROR = "error"
    WARNING = "warning"


class PreflightIssue(BaseModel):
    """Row-level validation issue from preflight."""

    row_number: int = Field(..., ge=1)
    field_name: str | None = None
    severity: IssueSeverity
    message: str
    raw_value: str | None = None


class PreflightResult(BaseModel):
    """Preflight validation results."""

    preflight_id: str
    detected_format: str
    total_rows: int = Field(..., ge=0)
    valid_rows: int = Field(..., ge=0)
    error_rows: int = Field(..., ge=0)
    warning_rows: int = Field(..., ge=0)
    issues: list[PreflightIssue] = Field(default_factory=list)
    warnings: list[PreflightIssue] = Field(default_factory=list)
    error_report_url: str | None = Field(
        None, description="Optional URL for downloadable error report"
    )


class ImportRowResult(BaseModel):
    """Result for a single imported row."""

    row_number: int = Field(..., ge=1)
    external_sale_id: str | None = None
    purchaser_name: str | None = None
    status: ImportRowStatus
    message: str


class ImportResult(BaseModel):
    """Import summary with created, skipped, and failed counts."""

    batch_id: str
    created_rows: int = Field(..., ge=0)
    skipped_rows: int = Field(..., ge=0)
    failed_rows: int = Field(..., ge=0)
    warnings: list[PreflightIssue] = Field(default_factory=list)


class TicketSaleImportRow(BaseModel):
    """Normalized import row parsed from the file."""

    # Required fields
    ticket_type: str = Field(..., min_length=1, max_length=200)
    purchaser_name: str = Field(..., min_length=1, max_length=200)
    purchaser_email: str = Field(..., min_length=1, max_length=200)
    quantity: int = Field(..., ge=1)
    total_amount: Decimal = Field(..., ge=0, decimal_places=2)
    purchase_date: str = Field(..., min_length=1)
    external_sale_id: str = Field(..., min_length=1, max_length=200)

    # Optional fields
    purchaser_phone: str | None = Field(None, max_length=50)
    fee_amount: Decimal | None = Field(None, ge=0, decimal_places=2)
    payment_status: str | None = Field(None, max_length=50)
    notes: str | None = Field(None, max_length=1000)
