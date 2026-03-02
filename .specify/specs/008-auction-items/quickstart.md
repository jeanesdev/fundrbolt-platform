# Quickstart Guide: Auction Items Feature

**Feature**: 008-auction-items
**Date**: 2025-11-13
**Target Audience**: Developers implementing the auction items feature

## Overview

This guide provides step-by-step instructions for implementing the auction items feature in the Fundrbolt platform. The feature enables event coordinators to create and manage auction items with rich media, sponsor attribution, and buy-now functionality.

**Estimated Implementation Time**: 3-4 days (backend + frontend + tests)

---

## Prerequisites

- ✅ Completed features: 001 (auth), 002 (NPOs), 003 (events), 007 (sponsors)
- ✅ Development environment set up (see root README.md)
- ✅ PostgreSQL running (docker-compose up)
- ✅ Azure Blob Storage configured (or local dev mode)
- ✅ Python 3.11+ with Poetry
- ✅ Node 22+ with pnpm

---

## Phase 1: Database Setup (30 minutes)

### Step 1.1: Create Alembic Migration

```bash
cd backend
poetry run alembic revision -m "add_auction_items_tables"
```

### Step 1.2: Define Migration (Up)

File: `backend/alembic/versions/XXXX_add_auction_items_tables.py`

```python
"""add auction items tables

Revision ID: XXXX
Revises: YYYY
Create Date: 2025-11-13
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

def upgrade() -> None:
    # Create auction_items table
    op.create_table(
        'auction_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('event_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('events.id', ondelete='CASCADE'), nullable=False),
        sa.Column('bid_number', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('auction_type', sa.String(20), nullable=False),
        sa.Column('starting_bid', sa.Numeric(10, 2), nullable=False),
        sa.Column('donor_value', sa.Numeric(10, 2), nullable=True),
        sa.Column('cost', sa.Numeric(10, 2), nullable=True),
        sa.Column('buy_now_price', sa.Numeric(10, 2), nullable=True),
        sa.Column('buy_now_enabled', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('quantity_available', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('donated_by', sa.String(200), nullable=True),
        sa.Column('sponsor_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('sponsors.id', ondelete='SET NULL'), nullable=True),
        sa.Column('item_webpage', sa.Text(), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='draft'),
        sa.Column('display_priority', sa.Integer(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),

        sa.UniqueConstraint('event_id', 'bid_number', name='uq_auction_items_event_bid_number'),
        sa.CheckConstraint("auction_type IN ('live', 'silent')", name='ck_auction_items_auction_type'),
        sa.CheckConstraint("status IN ('draft', 'published', 'sold', 'withdrawn')", name='ck_auction_items_status'),
        sa.CheckConstraint('starting_bid >= 0', name='ck_auction_items_starting_bid_nonnegative'),
        sa.CheckConstraint('donor_value IS NULL OR donor_value >= 0', name='ck_auction_items_donor_value_nonnegative'),
        sa.CheckConstraint('cost IS NULL OR cost >= 0', name='ck_auction_items_cost_nonnegative'),
        sa.CheckConstraint('buy_now_price IS NULL OR buy_now_price >= starting_bid', name='ck_auction_items_buy_now_price_min'),
        sa.CheckConstraint('quantity_available >= 1', name='ck_auction_items_quantity_min'),
        sa.CheckConstraint(
            '(buy_now_enabled = false) OR (buy_now_enabled = true AND buy_now_price IS NOT NULL)',
            name='ck_auction_items_buy_now_consistency'
        ),
    )

    # Create indexes
    op.create_index('idx_auction_items_event_id', 'auction_items', ['event_id'], postgresql_where=sa.text('deleted_at IS NULL'))
    op.create_index('idx_auction_items_status', 'auction_items', ['status'], postgresql_where=sa.text('deleted_at IS NULL'))
    op.create_index('idx_auction_items_auction_type', 'auction_items', ['auction_type'], postgresql_where=sa.text('deleted_at IS NULL'))
    op.create_index('idx_auction_items_sponsor_id', 'auction_items', ['sponsor_id'], postgresql_where=sa.text('deleted_at IS NULL'))
    op.create_index('idx_auction_items_event_status_type', 'auction_items', ['event_id', 'status', 'auction_type'], postgresql_where=sa.text('deleted_at IS NULL'))
    op.create_index('idx_auction_items_bid_number', 'auction_items', ['event_id', 'bid_number'], postgresql_where=sa.text('deleted_at IS NULL'))

    # Create auction_item_media table
    op.create_table(
        'auction_item_media',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('auction_item_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('auction_items.id', ondelete='CASCADE'), nullable=False),
        sa.Column('media_type', sa.String(20), nullable=False),
        sa.Column('file_path', sa.Text(), nullable=False),
        sa.Column('file_name', sa.String(255), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=False),
        sa.Column('mime_type', sa.String(100), nullable=False),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('thumbnail_path', sa.Text(), nullable=True),
        sa.Column('video_url', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),

        sa.CheckConstraint("media_type IN ('image', 'video')", name='ck_auction_item_media_type'),
        sa.CheckConstraint('file_size > 0', name='ck_auction_item_media_file_size_positive'),
    )

    # Create media indexes
    op.create_index('idx_auction_item_media_item_id', 'auction_item_media', ['auction_item_id'])
    op.create_index('idx_auction_item_media_display_order', 'auction_item_media', ['auction_item_id', 'display_order'])


def downgrade() -> None:
    op.drop_index('idx_auction_item_media_display_order', table_name='auction_item_media')
    op.drop_index('idx_auction_item_media_item_id', table_name='auction_item_media')
    op.drop_table('auction_item_media')

    op.drop_index('idx_auction_items_bid_number', table_name='auction_items')
    op.drop_index('idx_auction_items_event_status_type', table_name='auction_items')
    op.drop_index('idx_auction_items_sponsor_id', table_name='auction_items')
    op.drop_index('idx_auction_items_auction_type', table_name='auction_items')
    op.drop_index('idx_auction_items_status', table_name='auction_items')
    op.drop_index('idx_auction_items_event_id', table_name='auction_items')
    op.drop_table('auction_items')
```

### Step 1.3: Run Migration

```bash
poetry run alembic upgrade head
```

**Verify**:

```bash
poetry run python -c "
from app.core.database import engine
from sqlalchemy import inspect
inspector = inspect(engine)
print('Tables:', inspector.get_table_names())
print('auction_items columns:', [c['name'] for c in inspector.get_columns('auction_items')])
"
```

---

## Phase 2: Backend Models (45 minutes)

### Step 2.1: Create SQLAlchemy Models

File: `backend/app/models/auction_item.py`

```python
"""Auction item models for live and silent auctions."""

import enum
import uuid
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.event import Event
    from app.models.sponsor import Sponsor
    from app.models.user import User


class AuctionType(str, enum.Enum):
    """Auction type enumeration."""

    LIVE = "live"
    SILENT = "silent"


class ItemStatus(str, enum.Enum):
    """Auction item status."""

    DRAFT = "draft"
    PUBLISHED = "published"
    SOLD = "sold"
    WITHDRAWN = "withdrawn"


class MediaType(str, enum.Enum):
    """Media file type."""

    IMAGE = "image"
    VIDEO = "video"


class AuctionItem(Base, UUIDMixin, TimestampMixin):
    """Auction item model."""

    __tablename__ = "auction_items"

    # Relationships
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sponsor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sponsors.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    # Core fields
    bid_number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    auction_type: Mapped[str] = mapped_column(String(20), nullable=False)

    # Pricing
    starting_bid: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    donor_value: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    cost: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    buy_now_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    buy_now_enabled: Mapped[bool] = mapped_column(
        default=False,
        server_default="false",
        nullable=False,
    )

    # Additional fields
    quantity_available: Mapped[int] = mapped_column(
        Integer,
        default=1,
        server_default="1",
        nullable=False,
    )
    donated_by: Mapped[str | None] = mapped_column(String(200), nullable=True)
    item_webpage: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20),
        default=ItemStatus.DRAFT.value,
        server_default=ItemStatus.DRAFT.value,
        nullable=False,
    )
    display_priority: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # SQLAlchemy relationships
    event: Mapped["Event"] = relationship("Event", back_populates="auction_items")
    sponsor: Mapped["Sponsor | None"] = relationship("Sponsor", lazy="select")
    media: Mapped[list["AuctionItemMedia"]] = relationship(
        "AuctionItemMedia",
        back_populates="auction_item",
        cascade="all, delete-orphan",
        order_by="AuctionItemMedia.display_order",
    )
    creator: Mapped["User"] = relationship("User", foreign_keys=[created_by])

    # Constraints (documented in migration)
    __table_args__ = (
        CheckConstraint("auction_type IN ('live', 'silent')", name="ck_auction_items_auction_type"),
        CheckConstraint(
            "status IN ('draft', 'published', 'sold', 'withdrawn')",
            name="ck_auction_items_status",
        ),
        CheckConstraint("starting_bid >= 0", name="ck_auction_items_starting_bid_nonnegative"),
        CheckConstraint(
            "donor_value IS NULL OR donor_value >= 0",
            name="ck_auction_items_donor_value_nonnegative",
        ),
        CheckConstraint("cost IS NULL OR cost >= 0", name="ck_auction_items_cost_nonnegative"),
        CheckConstraint(
            "buy_now_price IS NULL OR buy_now_price >= starting_bid",
            name="ck_auction_items_buy_now_price_min",
        ),
        CheckConstraint("quantity_available >= 1", name="ck_auction_items_quantity_min"),
        CheckConstraint(
            "(buy_now_enabled = false) OR (buy_now_enabled = true AND buy_now_price IS NOT NULL)",
            name="ck_auction_items_buy_now_consistency",
        ),
    )


class AuctionItemMedia(Base, UUIDMixin, TimestampMixin):
    """Auction item media (images/videos)."""

    __tablename__ = "auction_item_media"

    auction_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auction_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    media_type: Mapped[str] = mapped_column(String(20), nullable=False)
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    display_order: Mapped[int] = mapped_column(
        Integer,
        default=0,
        server_default="0",
        nullable=False,
    )
    thumbnail_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    video_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    auction_item: Mapped["AuctionItem"] = relationship("AuctionItem", back_populates="media")

    # Constraints
    __table_args__ = (
        CheckConstraint("media_type IN ('image', 'video')", name="ck_auction_item_media_type"),
        CheckConstraint("file_size > 0", name="ck_auction_item_media_file_size_positive"),
    )
```

### Step 2.2: Update Event Model

File: `backend/app/models/event.py` (add relationship)

```python
# Add to Event class:
auction_items: Mapped[list["AuctionItem"]] = relationship(
    "AuctionItem",
    back_populates="event",
    cascade="all, delete-orphan",
    order_by="AuctionItem.bid_number",
)
```

### Step 2.3: Test Models

```bash
poetry run pytest app/tests/unit/test_auction_item_models.py -v
```

---

## Phase 3: Pydantic Schemas (30 minutes)

File: `backend/app/schemas/auction_item.py`

```python
"""Pydantic schemas for auction items."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.models.auction_item import AuctionType, ItemStatus


class AuctionItemBase(BaseModel):
    """Base schema for auction items."""

    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1, max_length=10000)
    auction_type: AuctionType
    starting_bid: Decimal = Field(..., ge=0, decimal_places=2)
    donor_value: Decimal | None = Field(None, ge=0, decimal_places=2)
    cost: Decimal | None = Field(None, ge=0, decimal_places=2)
    buy_now_price: Decimal | None = Field(None, ge=0, decimal_places=2)
    buy_now_enabled: bool = False
    quantity_available: int = Field(default=1, ge=1)
    donated_by: str | None = Field(None, max_length=200)
    sponsor_id: UUID | None = None
    item_webpage: str | None = Field(None, max_length=2048)
    display_priority: int | None = None

    @field_validator("buy_now_price")
    @classmethod
    def validate_buy_now_price(cls, v: Decimal | None, info) -> Decimal | None:
        """Ensure buy_now_price >= starting_bid if set."""
        if v is not None:
            starting_bid = info.data.get("starting_bid")
            if starting_bid and v < starting_bid:
                raise ValueError("buy_now_price must be >= starting_bid")
        return v


class AuctionItemCreate(AuctionItemBase):
    """Schema for creating auction items."""

    pass


class AuctionItemUpdate(BaseModel):
    """Schema for updating auction items (all fields optional)."""

    title: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = Field(None, min_length=1, max_length=10000)
    auction_type: AuctionType | None = None
    starting_bid: Decimal | None = Field(None, ge=0)
    donor_value: Decimal | None = Field(None, ge=0)
    cost: Decimal | None = Field(None, ge=0)
    buy_now_price: Decimal | None = Field(None, ge=0)
    buy_now_enabled: bool | None = None
    quantity_available: int | None = Field(None, ge=1)
    donated_by: str | None = Field(None, max_length=200)
    sponsor_id: UUID | None = None
    item_webpage: str | None = Field(None, max_length=2048)
    display_priority: int | None = None


class AuctionItemResponse(AuctionItemBase):
    """Schema for auction item responses."""

    id: UUID
    event_id: UUID
    bid_number: int = Field(..., ge=100, le=999)
    status: ItemStatus
    created_by: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

---

## Next Steps

Continue with:

1. **Services Layer** (1 day)
   - `AuctionItemService` with bid number assignment
   - `AuctionItemMediaService` with Azure Blob integration

2. **API Routes** (1 day)
   - CRUD endpoints
   - Media upload/delete
   - Publish/withdraw actions

3. **Testing** (1 day)
   - Unit tests (services, bid number logic)
   - Integration tests (API endpoints)
   - E2E tests (Playwright)

4. **Frontend** (2 days)
   - Item list/form components
   - Media upload with drag-drop
   - Status workflow UI

**Total Estimated Time**: 5-6 days (backend + frontend + tests)

---

## References

- [Data Model](./data-model.md)
- [API Contracts](./contracts/auction-items-openapi.yaml)
- [Research Decisions](./research.md)
- [Implementation Plan](./plan.md)
