"""Schemas for auction item bulk import."""

from __future__ import annotations

from decimal import Decimal
from enum import Enum
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class ImportRowStatus(str, Enum):
    """Row-level import status."""

    CREATED = "created"
    UPDATED = "updated"
    SKIPPED = "skipped"
    ERROR = "error"


class ImportImageStatus(str, Enum):
    """Image validation status."""

    OK = "ok"
    MISSING = "missing"
    INVALID = "invalid"


class AuctionItemImportRow(BaseModel):
    """Normalized import row parsed from the workbook."""

    external_id: str = Field(..., min_length=1, max_length=200)
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1, max_length=10000)
    category: str = Field(..., min_length=1, max_length=100)
    starting_bid: Decimal = Field(..., ge=0, decimal_places=2)
    fair_market_value: Decimal = Field(..., ge=0, decimal_places=2)
    buy_it_now: Decimal | None = Field(None, ge=0, decimal_places=2)
    quantity: int | None = Field(default=1, ge=1)
    donor_name: str | None = Field(None, max_length=200)
    tags: str | None = Field(None, max_length=500)
    restrictions: str | None = Field(None, max_length=1000)
    fulfillment_notes: str | None = Field(None, max_length=1000)
    is_featured: bool | None = False
    sort_order: int | None = None
    image_filename: str = Field(..., min_length=1, max_length=255)


class ImportRowResult(BaseModel):
    """Row-level result for preflight or commit."""

    row_number: int = Field(..., ge=1)
    external_id: str | None = None
    status: ImportRowStatus
    message: str
    image_status: ImportImageStatus | None = None


class ImportReport(BaseModel):
    """Import report with aggregate totals and row-level results."""

    total_rows: int = Field(..., ge=0)
    created_count: int = Field(..., ge=0)
    updated_count: int = Field(..., ge=0)
    skipped_count: int = Field(..., ge=0)
    error_count: int = Field(..., ge=0)
    warnings_count: int = Field(default=0, ge=0)
    rows: list[ImportRowResult] = Field(default_factory=list)
    error_report_url: str | None = Field(
        None, description="Optional URL for downloadable error report"
    )


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
    status: Literal["preflight", "commit"]
    total_rows: int
    error_count: int
