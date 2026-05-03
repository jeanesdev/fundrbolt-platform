# Data Model: Revenue Generators

**Feature**: 042-revenue-generators
**Date**: 2026-05-01

## New Tables

### revenue_generator_items

Event-scoped Revenue Generator item (raffle, game of chance, etc.) with two independent state controls.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | Primary key |
| event_id | UUID | FK → events.id (CASCADE), NOT NULL, indexed | Event scope |
| created_by | UUID | FK → users.id (SET NULL), nullable | Admin who created the item |
| name | VARCHAR(255) | NOT NULL | Display name shown to donors and admins |
| description | TEXT | nullable | Optional description shown on item card |
| price_per_entry | NUMERIC(10,2) | NOT NULL, CHECK (price_per_entry > 0) | Fixed cost per entry in dollars |
| is_visible | BOOLEAN | NOT NULL, DEFAULT false | Controls donor "Play" tab visibility |
| is_open_for_entries | BOOLEAN | NOT NULL, DEFAULT true | Controls whether new entries can be purchased |
| display_order | INTEGER | NOT NULL, DEFAULT 0 | Sort order within the event's item list |
| created_at | TIMESTAMP(tz) | NOT NULL, DEFAULT now() | Set by TimestampMixin |
| updated_at | TIMESTAMP(tz) | NOT NULL, DEFAULT now() | Set by TimestampMixin |

**Relationships**:
- `event_id` → `events.id` CASCADE DELETE — deleting an event removes all its RG items
- `created_by` → `users.id` SET NULL — preserves record if user is deleted; nullable for seeded/imported items

**Indexes**:
- `ix_revenue_generator_items_event_id` on `event_id`

---

### revenue_generator_entries

A single purchased entry for a Revenue Generator item. Append-only — entries are never displaced or invalidated.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | Primary key |
| revenue_generator_item_id | UUID | FK → revenue_generator_items.id (CASCADE), NOT NULL, indexed | The item this entry is for |
| event_id | UUID | FK → events.id (CASCADE), NOT NULL, indexed | Denormalized event scope for query optimization |
| registration_guest_id | UUID | FK → registration_guests.id (SET NULL), nullable | Guest who purchased; SET NULL if guest deleted |
| bidder_number | INTEGER | NOT NULL | Denormalized bidder number (snapshot at purchase time) |
| amount_paid | NUMERIC(10,2) | NOT NULL | Price paid per entry (snapshot of price_per_entry at purchase time) |
| recorded_by_user_id | UUID | FK → users.id (SET NULL), nullable | NULL = donor self-purchased; non-NULL = staff recorded via Quick Entry |
| purchased_at | TIMESTAMP(tz) | NOT NULL, DEFAULT now() | When the entry was recorded |
| created_at | TIMESTAMP(tz) | NOT NULL, DEFAULT now() | Set by TimestampMixin |
| updated_at | TIMESTAMP(tz) | NOT NULL, DEFAULT now() | Set by TimestampMixin |

**Relationships**:
- `revenue_generator_item_id` → `revenue_generator_items.id` CASCADE DELETE
- `event_id` → `events.id` CASCADE DELETE (belt-and-suspenders; item cascade also covers this)
- `registration_guest_id` → `registration_guests.id` SET NULL — preserves financial records when guests are deleted
- `recorded_by_user_id` → `users.id` SET NULL

**Indexes**:
- `ix_revenue_generator_entries_item_id` on `revenue_generator_item_id`
- `ix_revenue_generator_entries_event_id` on `event_id`

**Notes**:
- `bidder_number` and `amount_paid` are denormalized snapshots: they capture the values at purchase time so winner selection and audit trails remain accurate even if the guest's bidder number or the item's price is later changed.
- Multiple entries with the same `registration_guest_id` and `revenue_generator_item_id` are valid and expected (a donor can purchase many entries).

---

### revenue_generator_winner_selections

Append-only winner selection history. The current winner is the record with `MAX(selected_at)` for an item.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | Primary key |
| revenue_generator_item_id | UUID | FK → revenue_generator_items.id (CASCADE), NOT NULL, indexed | The item this selection is for |
| winning_entry_id | UUID | FK → revenue_generator_entries.id (SET NULL), nullable | The winning entry record; nullable if entry is deleted |
| winner_name | VARCHAR(255) | NOT NULL | Denormalized winner display name (snapshot at selection time) |
| bidder_number | INTEGER | NOT NULL | Denormalized winning bidder number (snapshot at selection time) |
| selection_method | ENUM('random_draw', 'manual') | NOT NULL | How the winner was chosen |
| selected_at | TIMESTAMP(tz) | NOT NULL, DEFAULT now() | When the selection was made |
| selected_by_user_id | UUID | FK → users.id (SET NULL), nullable | Admin or auctioneer who performed the selection |
| created_at | TIMESTAMP(tz) | NOT NULL, DEFAULT now() | Set by TimestampMixin |
| updated_at | TIMESTAMP(tz) | NOT NULL, DEFAULT now() | Set by TimestampMixin |

**Relationships**:
- `revenue_generator_item_id` → `revenue_generator_items.id` CASCADE DELETE
- `winning_entry_id` → `revenue_generator_entries.id` SET NULL — preserves selection history if entry is later removed
- `selected_by_user_id` → `users.id` SET NULL

**Indexes**:
- `ix_revenue_generator_winner_selections_item_id` on `revenue_generator_item_id`

**Notes**:
- This table is append-only. Re-draws and manual overrides create new rows; previous rows are never updated or deleted.
- "Current winner" query: `SELECT * FROM revenue_generator_winner_selections WHERE revenue_generator_item_id = $1 ORDER BY selected_at DESC LIMIT 1`
- `winner_name` and `bidder_number` are denormalized so the historical winner display remains correct even if the guest record is modified or deleted.

---

## State Model: RevenueGeneratorItem

The two boolean fields are independently controlled. All four combinations are valid:

```
is_visible=false, is_open_for_entries=true   [DEFAULT / Draft]
  Admin preparing the item; not visible to donors but can accept entries (admin/Quick Entry only)

is_visible=true, is_open_for_entries=true    [Active / Live]
  Visible to donors; donors can purchase entries via Play tab

is_visible=true, is_open_for_entries=false   [Results Visible / Closed]
  Donors can see item and winner announcement; purchase action disabled ("Entries closed" indicator)

is_visible=false, is_open_for_entries=false  [Hidden and Closed]
  Item not visible to donors; no new entries; admin-only view

is_visible=false, is_open_for_entries=true   [Hidden but Open]
  Unusual but valid; admin/Quick Entry can still record entries; donors cannot see or purchase
```

State transitions are unrestricted — admin can toggle either boolean independently at any time. There is no enforced state machine progression.

---

## Modified Tables

No existing tables are modified. All data for this feature is contained in the three new tables above.

---

## Enum Additions

### WinnerSelectionMethod (new PostgreSQL enum or Python string enum)

| Value | Description |
|-------|-------------|
| `random_draw` | Winner chosen by weighted random selection (each entry = equal probability) |
| `manual` | Winner explicitly chosen by admin/auctioneer from entry list |

Implementation: Python `StrEnum` in `backend/app/models/revenue_generator_winner_selection.py`, stored as VARCHAR or PostgreSQL ENUM in the database column.

---

## Migration Plan

**File**: `backend/alembic/versions/042_add_revenue_generator_tables.py`

**Operations** (in order):
1. Create `revenue_generator_winner_method` PostgreSQL ENUM type (`random_draw`, `manual`)
2. Create `revenue_generator_items` table with all columns and check constraint on `price_per_entry > 0`
3. Create index `ix_revenue_generator_items_event_id`
4. Create `revenue_generator_entries` table with all columns
5. Create indexes `ix_revenue_generator_entries_item_id` and `ix_revenue_generator_entries_event_id`
6. Create `revenue_generator_winner_selections` table with all columns
7. Create index `ix_revenue_generator_winner_selections_item_id`

**Rollback** (downgrade):
1. Drop `revenue_generator_winner_selections` table
2. Drop `revenue_generator_entries` table
3. Drop `revenue_generator_items` table
4. Drop `revenue_generator_winner_method` enum type
