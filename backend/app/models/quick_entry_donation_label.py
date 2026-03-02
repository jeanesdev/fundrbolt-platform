"""Quick-entry donation label link model."""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.donation_label import DonationLabel
    from app.models.quick_entry_donation import QuickEntryDonation


class QuickEntryDonationLabelLink(Base, UUIDMixin, TimestampMixin):
    """Associates quick-entry donations with predefined/custom labels."""

    __tablename__ = "quick_entry_donation_label_links"

    donation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("quick_entry_paddle_raise_donations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    label_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("donation_labels.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    custom_label_text: Mapped[str | None] = mapped_column(String(80), nullable=True)

    donation: Mapped["QuickEntryDonation"] = relationship(
        "QuickEntryDonation",
        back_populates="label_links",
    )
    label: Mapped["DonationLabel | None"] = relationship("DonationLabel")
