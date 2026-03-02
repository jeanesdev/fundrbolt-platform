"""Schemas for admin user import."""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class IssueSeverity(str, Enum):
    """Severity of a validation issue."""

    ERROR = "error"
    WARNING = "warning"


class ImportRowStatus(str, Enum):
    """Row-level import status."""

    CREATED = "created"
    SKIPPED = "skipped"
    MEMBERSHIP_ADDED = "membership_added"
    ERROR = "error"


class ImportErrorReportFormat(str, Enum):
    """Supported error report formats."""

    CSV = "csv"
    JSON = "json"


class PreflightIssue(BaseModel):
    """Validation issue returned by preflight."""

    row_number: int = Field(..., ge=1)
    field_name: str | None = None
    severity: IssueSeverity
    message: str
    raw_value: str | None = None


class PreflightResult(BaseModel):
    """Preflight response for user import."""

    preflight_id: str
    detected_format: str
    file_checksum: str | None = None
    total_rows: int = Field(..., ge=0)
    valid_rows: int = Field(..., ge=0)
    error_rows: int = Field(..., ge=0)
    warning_rows: int = Field(..., ge=0)
    issues: list[PreflightIssue] = Field(default_factory=list)
    warnings: list[PreflightIssue] = Field(default_factory=list)
    error_report_url: str | None = None


class ImportRowResult(BaseModel):
    """Row-level import outcome."""

    row_number: int = Field(..., ge=1)
    email: str | None = None
    full_name: str | None = None
    status: ImportRowStatus
    message: str


class ImportResult(BaseModel):
    """Import summary response."""

    batch_id: str
    created_rows: int = Field(..., ge=0)
    skipped_rows: int = Field(..., ge=0)
    membership_added_rows: int = Field(..., ge=0)
    failed_rows: int = Field(..., ge=0)
    rows: list[ImportRowResult] = Field(default_factory=list)
    warnings: list[PreflightIssue] = Field(default_factory=list)


class ErrorReportRequest(BaseModel):
    """Request to build an error report."""

    format: ImportErrorReportFormat = ImportErrorReportFormat.CSV
    rows: list[ImportRowResult]


class ErrorReportResponse(BaseModel):
    """Response containing error report content."""

    format: ImportErrorReportFormat
    content_type: str
    filename: str
    content: str
