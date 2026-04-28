"""DonateNowMedia model for hero slideshow images/videos on the donate-now page."""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.donate_now_config import DonateNowPageConfig
    from app.models.user import User


class DonateNowMedia(Base, UUIDMixin, TimestampMixin):
    """Hero media (images/videos) for a donate-now page.

    Business Rules:
    - Maximum 10MB per file
    - Allowed types: image/jpeg, image/png, image/webp, image/gif, video/mp4, video/quicktime
    - Files stored in Azure Blob Storage under donate-now/{config_id}/{media_id}/{filename}
    """

    __tablename__ = "donate_now_media"

    config_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("donate_now_page_configs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    media_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="Type of media: image or video",
    )
    file_url: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="Azure Blob Storage URL",
    )
    file_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Original filename",
    )
    file_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="MIME type (e.g., image/jpeg)",
    )
    mime_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="MIME type for validation",
    )
    blob_name: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="Azure Blob Storage blob name/path",
    )
    file_size: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="File size in bytes",
    )
    display_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Order for slideshow display",
    )
    uploaded_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    # Relationships
    config: Mapped["DonateNowPageConfig"] = relationship(
        "DonateNowPageConfig", back_populates="media_items"
    )
    uploader: Mapped["User"] = relationship("User", foreign_keys=[uploaded_by])

    # Constraints
    __table_args__ = (
        CheckConstraint(
            "media_type IN ('image', 'video')",
            name="check_donate_now_media_type",
        ),
        CheckConstraint(
            "file_size <= 10485760",
            name="check_donate_now_media_file_size_max_10mb",
        ),
    )

    def __repr__(self) -> str:
        """Return string representation."""
        return (
            f"<DonateNowMedia(id={self.id}, config_id={self.config_id}, "
            f"type={self.media_type}, name={self.file_name})>"
        )
