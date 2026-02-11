"""Schemas for registration import."""

from __future__ import annotations

from datetime import date
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field


class ImportRowStatus(str, Enum):
    """Row-level import status."""

    CREATED = "created"
    SKIPPED = "skipped"
    ERROR = "error"


class ValidationIssueSeverity(str, Enum):
    """Validation issue severity."""

    ERROR = "error"
    WARNING = "warning"


class RegistrationImportRow(BaseModel):
    """Normalized import row parsed from the file."""

    # Required fields
    event_id: str | None = Field(None, description="Event identifier (informational only)")
    registrant_name: str = Field(..., min_length=1, max_length=255)
    registrant_email: str = Field(..., min_length=1, max_length=255)
    registration_date: date
    quantity: int = Field(..., ge=1)
    external_registration_id: str = Field(..., min_length=1, max_length=200)

    # Optional fields
    registrant_phone: str | None = Field(None, max_length=20)
    notes: str | None = Field(None, max_length=1000)
    bidder_number: int | None = Field(None, ge=100, le=999)
    table_number: int | None = Field(None, ge=1)
    guest_count: int | None = Field(None, ge=1)
    ticket_purchase_id: str | None = Field(
        None,
        description="Optional ticket purchase ID to link registration",
        max_length=200,
    )
    ticket_purchaser_email: str | None = Field(
        None,
        description="Alternative purchaser email for ticket purchase lookup",
        max_length=255,
    )
    ticket_purchase_date: date | None = Field(
        None,
        description="Alternative purchase date (YYYY-MM-DD) for ticket purchase lookup",
    )


class ValidationIssue(BaseModel):
    """Single validation issue for a row."""

    row_number: int = Field(..., ge=1)
    severity: ValidationIssueSeverity
    field_name: str | None = None
    message: str


class ImportRowResult(BaseModel):
    """Row-level result for preflight or commit."""

    row_number: int = Field(..., ge=1)
    external_id: str | None = None
    registrant_name: str | None = None
    registrant_email: str | None = None
    status: ImportRowStatus
    message: str
    issues: list[ValidationIssue] = Field(default_factory=list)


class ImportReport(BaseModel):
    """Import report with aggregate totals and row-level results."""

    total_rows: int = Field(..., ge=0)
    valid_rows: int = Field(..., ge=0)
    error_rows: int = Field(..., ge=0)
    warning_rows: int = Field(..., ge=0)
    created_count: int = Field(..., ge=0)
    skipped_count: int = Field(..., ge=0)
    failed_count: int = Field(..., ge=0)
    rows: list[ImportRowResult] = Field(default_factory=list)
    error_report_url: str | None = Field(
        None, description="Optional URL for downloadable error report"
    )
    file_type: str | None = Field(None, description="File type: json, csv, xlsx")


class ImportErrorReportFormat(str, Enum):
    """Supported error report formats."""

    CSV = "csv"
    JSON = "json"


class ImportErrorReportRequest(BaseModel):
    """Request for generating an error report."""

    format: ImportErrorReportFormat = ImportErrorReportFormat.CSV
    rows: list[ImportRowResult]


class ImportErrorReportResponse(BaseModel):
    """Response containing error report payload."""

    format: ImportErrorReportFormat
    content_type: str
    filename: str
    content: str


class ImportAuditContext(BaseModel):
    """Audit context for logging import attempts."""

    event_id: UUID
    user_id: UUID
    status: str
    total_rows: int
    error_count: int
