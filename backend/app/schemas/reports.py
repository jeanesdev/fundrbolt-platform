"""Schemas for printable report generation."""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class LabelSize(str, Enum):
    """Brady label printer size options."""

    TWO_BY_THREE = "2x3"
    TWO_BY_FOUR = "2x4"
    THREE_BY_THREE = "3x3"
    THREE_BY_FIVE = "3x5"

    @property
    def css_dimensions(self) -> str:
        """Return CSS page dimensions for this label size."""
        return {
            LabelSize.TWO_BY_THREE: "50.8mm 76.2mm",
            LabelSize.TWO_BY_FOUR: "50.8mm 101.6mm",
            LabelSize.THREE_BY_THREE: "76.2mm 76.2mm",
            LabelSize.THREE_BY_FIVE: "76.2mm 127mm",
        }[self]


class BidCardRequest(BaseModel):
    """Request body for bid card PDF generation."""

    item_ids: list[str] | None = Field(
        default=None,
        description="Auction item IDs to include. Omit or null for all published items.",
    )
    label_size: LabelSize = Field(
        description="Brady-compatible label size for the printed cards.",
    )
    include_live: bool = Field(
        default=True,
        description="Include live auction items (in addition to silent items).",
    )
    show_image: bool = Field(
        default=True,
        description="Embed item image on each card.",
    )
    show_value: bool = Field(
        default=True,
        description="Show donor value on each card (suppressed when value is 0).",
    )
    show_qr: bool = Field(
        default=True,
        description="Print QR code linking to the donor bidding page.",
    )
    show_starting_bid: bool = Field(
        default=True,
        description="Show the starting bid on each card.",
    )
    show_min_bid_increment: bool = Field(
        default=False,
        description="Show the minimum bid increment on each card.",
    )
