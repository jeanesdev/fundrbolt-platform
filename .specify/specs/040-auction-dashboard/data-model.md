# Data Model: Auction Dashboard (040)

**Date**: 2026-04-07
**Status**: Complete

## Existing Entities (No Migrations Required)

This feature is read-only analytics over existing data. No new database tables or columns are needed.

### AuctionItem (existing — `auction_items` table)

| Field | Type | Dashboard Usage |
|-------|------|-----------------|
| id | UUID (PK) | Item identifier, drill-down link |
| event_id | UUID (FK → events) | Scope filtering, "Event" column in All Events mode |
| title | str | Display name in table/cards |
| auction_type | enum(SILENT, LIVE) | Type filter, type charts |
| category | str (nullable) | Category filter, category charts |
| status | enum(DRAFT, PUBLISHED, SOLD, WITHDRAWN) | Status column |
| starting_bid | Decimal | Item detail view |
| current_bid_amount | Decimal (nullable) | Current bid column, revenue calculation |
| bid_count | int | Bid count column, top items chart |
| watcher_count | int | Views/watchers column, top items chart |
| buy_now_enabled | bool | "Buy Now" visual category filter |
| buy_now_price | Decimal (nullable) | Item detail view, timeline reference line |
| bid_increment | Decimal | Item detail view |
| donated_by | str (nullable) | Search match target |
| description | text (nullable) | Item detail view |
| donor_value | Decimal (nullable) | Item detail view |
| bidding_open | bool | Status indicator |
| created_at | datetime | Sorting |

### AuctionBid (existing — `auction_bids` table)

| Field | Type | Dashboard Usage |
|-------|------|-----------------|
| id | UUID (PK) | Bid identifier |
| auction_item_id | UUID (FK → auction_items) | Join to item for bid history |
| event_id | UUID (FK → events) | Scope filtering |
| user_id | UUID (FK → users) | Bidder identity lookup |
| bidder_number | int | Display as "#142" in bid history |
| bid_amount | Decimal | Bid history display, timeline chart Y-axis |
| bid_type | enum(REGULAR, BUY_NOW, PROXY_AUTO) | Bid type column |
| bid_status | enum(ACTIVE, OUTBID, WINNING, CANCELLED, WITHDRAWN) | Bid status column, revenue exclusion logic |
| placed_at | datetime | Bid history timestamp, timeline chart X-axis |
| transaction_status | enum(PENDING, PROCESSING, PROCESSED, FAILED, REFUNDED) | Context in bid history |

### Event (existing — `events` table)

| Field | Type | Dashboard Usage |
|-------|------|-----------------|
| id | UUID (PK) | Scope filtering |
| name | str | Event column in "All Events" mode |
| slug | str | Route parameter |

### User (existing — `users` table)

| Field | Type | Dashboard Usage |
|-------|------|-----------------|
| id | UUID (PK) | FK from bids |
| first_name | str | Bidder name in bid history |
| last_name | str | Bidder name in bid history |

## Relationships Used

- `AuctionItem → Event`: Many-to-one via `event_id`. Used for scope filtering and event name display.
- `AuctionBid → AuctionItem`: Many-to-one via `auction_item_id`. Used for bid history on item detail page.
- `AuctionBid → User`: Many-to-one via `user_id`. Used to display bidder name alongside bidder number.
- `User → NPOMember → NPO → Event`: Existing access control chain used to determine which events a user can see in "All Events" mode.

## Aggregation Queries (Service Layer)

### Summary Statistics
- **Total Items**: `COUNT(auction_items)` where status != DRAFT, scoped by event(s)
- **Total Bids**: `SUM(auction_items.bid_count)` scoped by event(s)
- **Total Revenue**: `SUM(auction_items.current_bid_amount)` where bid_status IN (ACTIVE, WINNING) + buy now completed amounts
- **Average Bid**: `Total Revenue / Total Bids`

### Chart Aggregations
- **Revenue by Type**: `GROUP BY auction_type` + separate group for `buy_now_enabled=True`
- **Revenue by Category**: `GROUP BY category`
- **Bid Count by Type**: `GROUP BY auction_type` with buy now separation
- **Top 10 by Revenue**: `ORDER BY current_bid_amount DESC LIMIT 10`
- **Top 10 by Bid Count**: `ORDER BY bid_count DESC LIMIT 10`
- **Top 10 by Watchers**: `ORDER BY watcher_count DESC LIMIT 10`

## State Transitions

No state transitions managed by this feature — it is read-only.
