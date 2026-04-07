# Data Model: Auctioneer Dashboard

**Feature**: 038-auctioneer-dashboard
**Date**: 2026-04-04

## New Tables

### auctioneer_item_commissions

Per-auctioneer, per-item commission and fee tracking. Only visible to the owning auctioneer and Super Admins.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, default gen | Primary key |
| auctioneer_user_id | UUID | FK → users.id, NOT NULL, indexed | The auctioneer who set the commission |
| auction_item_id | UUID | FK → auction_items.id (CASCADE), NOT NULL, indexed | The auction item |
| commission_percent | DECIMAL(5,2) | NOT NULL, CHECK (0 <= val <= 100) | Commission percentage (e.g., 15.00 = 15%) |
| flat_fee | DECIMAL(12,2) | NOT NULL, DEFAULT 0, CHECK (val >= 0) | Flat fee amount in dollars |
| notes | TEXT | nullable | Free-text notes about the item |
| created_at | TIMESTAMP(tz) | NOT NULL, DEFAULT now | Record creation time |
| updated_at | TIMESTAMP(tz) | NOT NULL, DEFAULT now | Last update time |

**Unique constraint**: (auctioneer_user_id, auction_item_id) — one commission record per auctioneer per item.

**Relationships**:
- auctioneer_user_id → users.id (RESTRICT on delete)
- auction_item_id → auction_items.id (CASCADE on delete — if item deleted, commission record goes too)

### auctioneer_event_settings

Per-auctioneer, per-event category-level earning percentages.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, default gen | Primary key |
| auctioneer_user_id | UUID | FK → users.id, NOT NULL, indexed | The auctioneer |
| event_id | UUID | FK → events.id (CASCADE), NOT NULL, indexed | The event |
| live_auction_percent | DECIMAL(5,2) | NOT NULL, DEFAULT 0, CHECK (0 <= val <= 100) | % of live auction category revenue |
| paddle_raise_percent | DECIMAL(5,2) | NOT NULL, DEFAULT 0, CHECK (0 <= val <= 100) | % of paddle raise category revenue |
| silent_auction_percent | DECIMAL(5,2) | NOT NULL, DEFAULT 0, CHECK (0 <= val <= 100) | % of silent auction category revenue |
| created_at | TIMESTAMP(tz) | NOT NULL, DEFAULT now | Record creation time |
| updated_at | TIMESTAMP(tz) | NOT NULL, DEFAULT now | Last update time |

**Unique constraint**: (auctioneer_user_id, event_id) — one settings record per auctioneer per event.

**Relationships**:
- auctioneer_user_id → users.id (RESTRICT on delete)
- event_id → events.id (CASCADE on delete)

## Modified Tables

### events

| Field | Change | Type | Constraints | Description |
|-------|--------|------|-------------|-------------|
| live_auction_start_datetime | ADD | TIMESTAMP(tz) | nullable | When the live auction starts (optional, for countdown timers) |
| auction_close_datetime | MAP (exists in DB, not in model) | TIMESTAMP(tz) | nullable | When the silent auction closes (already in DB from migration 032) |

### roles

| Field | Change | Details |
|-------|--------|---------|
| name check constraint | UPDATE | Add `auctioneer` to allowed values: `('super_admin', 'npo_admin', 'event_coordinator', 'staff', 'donor', 'auctioneer')` |
| scope check constraint | UPDATE | No change needed — `auctioneer` uses scope `npo` (same as `event_coordinator`) |

**Seed data**: Insert new role row: `(gen_uuid, 'auctioneer', 'Professional auctioneer with commission tracking', 'npo')`

### npo_members (enum update)

| Field | Change | Details |
|-------|--------|---------|
| role enum | UPDATE | Add `AUCTIONEER` value to MemberRole enum: `('admin', 'co_admin', 'staff', 'auctioneer')` |

## State Transitions

### Auctioneer Item Commission Lifecycle

```
[No Record] → CREATE → [Active Commission]
[Active Commission] → UPDATE → [Active Commission] (edit commission_percent, flat_fee, notes)
[Active Commission] → DELETE → [No Record] (auctioneer removes commission from item)
```

No complex state machine — simple CRUD lifecycle.

### Auctioneer Event Settings Lifecycle

```
[No Record] → CREATE (on first percentage entry) → [Active Settings]
[Active Settings] → UPDATE → [Active Settings] (edit percentages)
```

Settings are created on first save (upsert pattern) and updated thereafter. No deletion needed.

## Earnings Calculation Model

### Per-Item Earnings (from auctioneer_item_commissions)

For each commission record where the auction item has a winning bid:
```
item_earning = (winning_bid_amount × commission_percent / 100) + flat_fee
```

Only items with status `SOLD` or bid_status `WINNING` contribute. Items with status `WITHDRAWN` or `CANCELLED` are excluded.

### Category-Level Earnings (from auctioneer_event_settings)

For each category (Live Auction, Paddle Raise, Silent Auction):
```
category_pool = total_revenue_in_category - revenue_from_items_with_per_item_commissions
category_earning = category_pool × category_percent / 100
```

Items that have a record in auctioneer_item_commissions (for this auctioneer) are excluded from the category pool to prevent double-counting.

### Total Earnings

```
total = sum(all item_earnings) + sum(all category_earnings)
```
