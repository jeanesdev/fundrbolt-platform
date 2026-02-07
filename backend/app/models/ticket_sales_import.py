"""Models for ticket sales bulk import tracking."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy import (
    Enum as SQLEnum,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin


class ImportStatus(str, enum.Enum):
    """Status of an import batch."""

    PREFLIGHTED = "preflighted"
    IMPORTED = "imported"
    FAILED = "failed"
    CANCELED = "canceled"


class ImportFormat(str, enum.Enum):
    """Supported file formats for import."""

    JSON = "json"
    CSV = "csv"
    XLSX = "xlsx"


class IssueSeverity(str, enum.Enum):
    """Severity level for validation issues."""

    ERROR = "error"
    WARNING = "warning"


class TicketSalesImportBatch(Base, UUIDMixin):
    """Represents one upload attempt and its preflight/import outcome.

    Business Rules:
    - row_count <= 5000 (MAX_IMPORT_ROWS)
    - preflight_id required for import
    - preflight_checksum ensures file hasn't changed between preflight and import
    """

    __tablename__ = "ticket_sales_import_batches"

    # Foreign Keys
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )

    # Import Details
    status: Mapped[ImportStatus] = mapped_column(
        SQLEnum(
            ImportStatus,
            name="import_status_enum",
            native_enum=False,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
    )
    source_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    source_format: Mapped[ImportFormat] = mapped_column(
        SQLEnum(
            ImportFormat,
            name="import_format_enum",
            native_enum=False,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
    )

    # Row Counts
    row_count: Mapped[int] = mapped_column(Integer, nullable=False)
    valid_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    error_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    warning_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    # Preflight Verification
    preflight_checksum: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    # Relationships
    issues: Mapped[list["TicketSalesImportIssue"]] = relationship(
        "TicketSalesImportIssue",
        back_populates="batch",
        cascade="all, delete-orphan",
    )

    # Constraints
    __table_args__ = (
        CheckConstraint("row_count > 0", name="check_import_batch_row_count_positive"),
        CheckConstraint("row_count <= 5000", name="check_import_batch_row_count_max"),
        CheckConstraint("valid_count >= 0", name="check_valid_count_positive"),
        CheckConstraint("error_count >= 0", name="check_error_count_positive"),
        CheckConstraint("warning_count >= 0", name="check_warning_count_positive"),
    )

    def __repr__(self) -> str:
        return f"<TicketSalesImportBatch(id={self.id}, status={self.status}, rows={self.row_count})>"


class TicketSalesImportIssue(Base, UUIDMixin):
    """Represents row-level validation issues from preflight.

    Business Rules:
    - Errors block import
    - Warnings allow import with skipped rows where applicable
    """

    __tablename__ = "ticket_sales_import_issues"

    # Foreign Keys
    batch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ticket_sales_import_batches.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Issue Details
    row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    field_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    severity: Mapped[IssueSeverity] = mapped_column(
        SQLEnum(
            IssueSeverity,
            name="issue_severity_enum",
            native_enum=False,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    raw_value: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    batch: Mapped["TicketSalesImportBatch"] = relationship(
        "TicketSalesImportBatch", back_populates="issues"
    )

    # Constraints
    __table_args__ = (CheckConstraint("row_number > 0", name="check_issue_row_number_positive"),)

    def __repr__(self) -> str:
        return f"<TicketSalesImportIssue(id={self.id}, row={self.row_number}, severity={self.severity})>"
