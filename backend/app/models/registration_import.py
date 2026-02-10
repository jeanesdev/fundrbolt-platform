"""Registration import models for tracking import batches and validation issues."""

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin

if TYPE_CHECKING:
    from app.models.event import Event
    from app.models.user import User


class ImportBatchStatus(str, enum.Enum):
    """Import batch status."""

    PREFLIGHT = "preflight"
    COMPLETED = "completed"
    FAILED = "failed"


class ValidationSeverity(str, enum.Enum):
    """Validation issue severity."""

    ERROR = "error"
    WARNING = "warning"


class RegistrationImportBatch(Base, UUIDMixin):
    """Import batch for tracking registration imports.

    Business Rules:
    - Each import attempt creates one batch record
    - Batch tracks preflight and commit status
    - Batch links to the event and initiating user
    - Batch stores summary counts and metadata
    """

    __tablename__ = "registration_import_batches"

    # Foreign Keys
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    # Batch Details
    status: Mapped[ImportBatchStatus] = mapped_column(
        SQLEnum(ImportBatchStatus, native_enum=False, length=20),
        nullable=False,
        default=ImportBatchStatus.PREFLIGHT,
    )
    file_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="File type: json, csv, xlsx",
    )
    original_filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    # Summary Counts
    total_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    valid_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    warning_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    skipped_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Metadata
    metadata: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="Additional metadata (e.g., processing time)",
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default="now()",
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    event: Mapped["Event"] = relationship("Event")
    user: Mapped["User"] = relationship("User")
    validation_issues: Mapped[list["RegistrationValidationIssue"]] = relationship(
        "RegistrationValidationIssue",
        back_populates="batch",
        cascade="all, delete-orphan",
    )


class RegistrationValidationIssue(Base, UUIDMixin):
    """Validation issue for a specific row in an import batch.

    Business Rules:
    - Each issue links to a batch and identifies the row number
    - Issues can be errors (blocking) or warnings (non-blocking)
    - Issues provide field name and message for actionable feedback
    """

    __tablename__ = "registration_validation_issues"

    # Foreign Keys
    batch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("registration_import_batches.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Issue Details
    row_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="1-indexed row number from the file",
    )
    severity: Mapped[ValidationSeverity] = mapped_column(
        SQLEnum(ValidationSeverity, native_enum=False, length=10),
        nullable=False,
    )
    field_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Field that caused the issue (if applicable)",
    )
    message: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Human-readable error message",
    )

    # Relationships
    batch: Mapped["RegistrationImportBatch"] = relationship(
        "RegistrationImportBatch",
        back_populates="validation_issues",
    )
