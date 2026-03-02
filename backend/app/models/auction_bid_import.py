"""Models for auction bid import tracking."""

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
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin


class AuctionBidImportStatus(str, enum.Enum):
    """Status of an auction bid import batch."""

    PREFLIGHTED = "preflighted"
    IMPORTED = "imported"
    FAILED = "failed"
    CANCELED = "canceled"


class AuctionBidImportFormat(str, enum.Enum):
    """Supported file formats for auction bid import."""

    JSON = "json"
    CSV = "csv"
    XLSX = "xlsx"


class AuctionBidImportIssueSeverity(str, enum.Enum):
    """Severity level for auction bid import issues."""

    ERROR = "error"
    WARNING = "warning"


class AuctionBidImportBatch(Base, UUIDMixin):
    """Import batch for auction bid preflight and confirmation."""

    __tablename__ = "auction_bid_import_batches"

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

    status: Mapped[AuctionBidImportStatus] = mapped_column(
        SQLEnum(
            AuctionBidImportStatus,
            name="auction_bid_import_status_enum",
            native_enum=False,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
    )
    source_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    source_format: Mapped[AuctionBidImportFormat] = mapped_column(
        SQLEnum(
            AuctionBidImportFormat,
            name="auction_bid_import_format_enum",
            native_enum=False,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
    )

    row_count: Mapped[int] = mapped_column(Integer, nullable=False)
    valid_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    error_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    warning_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    created_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    skipped_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    failed_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    preflight_checksum: Mapped[str | None] = mapped_column(String(64), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    issues: Mapped[list["AuctionBidImportIssue"]] = relationship(
        "AuctionBidImportIssue",
        back_populates="batch",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        CheckConstraint("row_count > 0", name="check_auction_bid_import_row_count_positive"),
        CheckConstraint("row_count <= 10000", name="check_auction_bid_import_row_count_max"),
        CheckConstraint("valid_count >= 0", name="check_auction_bid_import_valid_count_positive"),
        CheckConstraint("error_count >= 0", name="check_auction_bid_import_error_count_positive"),
        CheckConstraint(
            "warning_count >= 0", name="check_auction_bid_import_warning_count_positive"
        ),
        CheckConstraint(
            "created_count >= 0", name="check_auction_bid_import_created_count_positive"
        ),
        CheckConstraint(
            "skipped_count >= 0", name="check_auction_bid_import_skipped_count_positive"
        ),
        CheckConstraint("failed_count >= 0", name="check_auction_bid_import_failed_count_positive"),
    )


class AuctionBidImportIssue(Base, UUIDMixin):
    """Row-level issues found during auction bid import preflight."""

    __tablename__ = "auction_bid_import_issues"

    batch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auction_bid_import_batches.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    field_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    severity: Mapped[AuctionBidImportIssueSeverity] = mapped_column(
        SQLEnum(
            AuctionBidImportIssueSeverity,
            name="auction_bid_import_issue_severity_enum",
            native_enum=False,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    raw_value: Mapped[str | None] = mapped_column(Text, nullable=True)

    batch: Mapped["AuctionBidImportBatch"] = relationship(
        "AuctionBidImportBatch",
        back_populates="issues",
    )

    __table_args__ = (
        CheckConstraint(
            "row_number > 0",
            name="check_auction_bid_import_issue_row_number_positive",
        ),
    )
