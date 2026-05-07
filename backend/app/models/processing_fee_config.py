"""ProcessingFeeConfig model — append-only fee rate history."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Numeric, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin

if TYPE_CHECKING:
    from app.models.user import User


class ProcessingFeeConfig(Base, UUIDMixin):
    """Append-only log of processing fee rate changes.

    New rows are inserted; old rows are never modified.
    The current rate is always the row with the latest created_at.
    """

    __tablename__ = "processing_fee_configs"

    rate: Mapped[Decimal] = mapped_column(
        Numeric(5, 4),
        nullable=False,
        comment="Processing fee rate (e.g. 0.0290 = 2.90%)",
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    creator: Mapped[User | None] = relationship(
        "User",
        foreign_keys=[created_by],
        lazy="select",
    )
