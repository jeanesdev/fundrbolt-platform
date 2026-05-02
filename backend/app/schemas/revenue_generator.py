"""Pydantic schemas for Revenue Generator endpoints."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class RevenueGeneratorItemCreate(BaseModel):
    name: str = Field(max_length=255)
    description: str | None = None
    price_per_entry: Decimal = Field(gt=0, decimal_places=2)
    display_order: int = Field(default=0, ge=0)


class RevenueGeneratorItemUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    description: str | None = None
    price_per_entry: Decimal | None = Field(default=None, gt=0, decimal_places=2)
    is_visible: bool | None = None
    is_open_for_entries: bool | None = None
    display_order: int | None = Field(default=None, ge=0)


class RevenueGeneratorItemAdminResponse(BaseModel):
    id: UUID
    event_id: UUID
    name: str
    description: str | None
    price_per_entry: Decimal
    is_visible: bool
    is_open_for_entries: bool
    display_order: int
    total_entries: int = 0
    total_revenue: Decimal = Decimal("0.00")
    current_winner_name: str | None = None
    current_winner_bidder_number: int | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RevenueGeneratorItemDonorResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    price_per_entry: Decimal
    is_open_for_entries: bool
    my_entry_count: int = 0
    current_winner_name: str | None = None

    model_config = {"from_attributes": True}


class RevenueGeneratorDonorListResponse(BaseModel):
    items: list[RevenueGeneratorItemDonorResponse]


class RevenueGeneratorAdminListResponse(BaseModel):
    items: list[RevenueGeneratorItemAdminResponse]


class EntryPurchaseResponse(BaseModel):
    entry_id: UUID
    item_id: UUID
    my_entry_count: int
    amount_paid: Decimal


class EntryRow(BaseModel):
    registration_guest_id: UUID | None
    bidder_number: int
    donor_name: str
    entry_count: int
    total_paid: Decimal
    last_purchased_at: datetime


class RevenueGeneratorEntryListResponse(BaseModel):
    item_id: UUID
    entries: list[EntryRow]
    total_entries: int
    total_revenue: Decimal
    page: int
    per_page: int
    total_pages: int


class ManualWinnerSelectRequest(BaseModel):
    registration_guest_id: UUID


class WinnerSelectionResponse(BaseModel):
    id: UUID
    item_id: UUID
    winner_name: str
    bidder_number: int
    selection_method: Literal["random_draw", "manual"]
    selected_at: datetime
    selected_by_user_id: UUID | None

    model_config = {"from_attributes": True}


class WinnerHistoryResponse(BaseModel):
    item_id: UUID
    history: list[WinnerSelectionResponse]


# --- Quick Entry schemas ---


class QuickEntryRevenueGeneratorItem(BaseModel):
    id: UUID
    name: str
    price_per_entry: Decimal

    model_config = {"from_attributes": True}


class QuickEntryRevenueGeneratorItemListResponse(BaseModel):
    items: list[QuickEntryRevenueGeneratorItem]


class QuickEntryRevenueGeneratorEntryCreate(BaseModel):
    item_id: UUID
    bidder_number: int = Field(ge=100, le=999)


class QuickEntryRevenueGeneratorEntryResponse(BaseModel):
    entry_id: UUID
    item_id: UUID
    item_name: str
    bidder_number: int
    donor_name: str | None
    entry_count_for_item: int
    amount_paid: Decimal


# --- Dashboard summary schemas ---


class RevenueGeneratorItemSummary(BaseModel):
    id: UUID
    name: str
    entry_count: int
    revenue: Decimal
    current_winner_name: str | None = None


class RevenueGeneratorDashboardSummary(BaseModel):
    total_entries: int
    total_revenue: Decimal
    items: list[RevenueGeneratorItemSummary]
