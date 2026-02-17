"""Models for admin user import tracking."""

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.models.base import Base, UUIDMixin

if TYPE_CHECKING:
    from app.models.npo import NPO
    from app.models.user import User


class UserImportStatus(str, enum.Enum):
    """Status of a user import batch."""

    PREFLIGHT = "preflight"
    COMMITTED = "committed"
    FAILED = "failed"


class UserImportIssueSeverity(str, enum.Enum):
    """Severity of an import issue."""

    ERROR = "error"
    WARNING = "warning"


class UserImportBatch(Base, UUIDMixin):
    """Import batch for admin user imports."""

    __tablename__ = "user_import_batches"

    npo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("npos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    initiated_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_checksum: Mapped[str] = mapped_column(String(64), nullable=False)
    file_type: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[UserImportStatus] = mapped_column(
        SQLEnum(
            UserImportStatus,
            name="user_import_status",
            native_enum=False,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
        default=UserImportStatus.PREFLIGHT,
    )
    total_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    valid_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    warning_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    skipped_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    membership_added_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    npo: Mapped["NPO"] = relationship("NPO")
    initiated_by: Mapped["User"] = relationship("User")
    issues: Mapped[list["UserImportIssue"]] = relationship(
        "UserImportIssue",
        back_populates="batch",
        cascade="all, delete-orphan",
    )


class UserImportIssue(Base, UUIDMixin):
    """Row-level validation issues for user imports."""

    __tablename__ = "user_import_issues"

    batch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user_import_batches.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    severity: Mapped[UserImportIssueSeverity] = mapped_column(
        SQLEnum(
            UserImportIssueSeverity,
            name="user_import_issue_severity",
            native_enum=False,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
    )
    field_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    raw_value: Mapped[str | None] = mapped_column(Text, nullable=True)

    batch: Mapped["UserImportBatch"] = relationship(
        "UserImportBatch",
        back_populates="issues",
    )
