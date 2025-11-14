# Data Model: Auction Items

**Feature**: 008-auction-items
**Date**: 2025-11-13
**Status**: Design Complete

## Overview

This document defines the database schema, entities, relationships, validation rules, and state transitions for the auction items feature. The design follows existing patterns from events, sponsors, and media uploads.

---

## Entity Relationship Diagram

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────────────┐
│   events    │1      * │  auction_items   │1      * │ auction_item_media  │
│             ├─────────│                  ├─────────│                     │
│ - id        │         │ - id             │         │ - id                │
│ - name      │         │ - event_id (FK)  │         │ - auction_item_id   │
│ - status    │         │ - bid_number     │         │ - media_type        │
└─────────────┘         │ - title          │         │ - file_path         │
                        │ - auction_type   │         │ - display_order     │
┌─────────────┐         │ - sponsor_id (FK)│         └─────────────────────┘
│  sponsors   │1      * │ - status         │
│             ├─────────│ - created_by (FK)│
│ - id        │         │ - starting_bid   │
│ - name      │         │ - buy_now_price  │
│ - event_id  │         └──────────────────┘
└─────────────┘                   │
                                  │
                        ┌─────────┴─────────┐
                        │      users        │
                        │   (created_by)    │
                        └───────────────────┘
```

---

## Entities

### 1. auction_items

**Purpose**: Core table for auction items (both live and silent auctions)

**Columns**:

| Column              | Type         | Constraints                                  | Description                                |
|---------------------|--------------|----------------------------------------------|--------------------------------------------|
| `id`                | UUID         | PRIMARY KEY, DEFAULT gen_random_uuid()       | Unique identifier                          |
| `event_id`          | UUID         | NOT NULL, FK → events(id) ON DELETE CASCADE  | Parent event                               |
| `bid_number`        | INTEGER      | NOT NULL, UNIQUE (event_id, bid_number)      | 3-digit number (100-999)                   |
| `title`             | VARCHAR(200) | NOT NULL                                     | Item name/title                            |
| `description`       | TEXT         | NOT NULL                                     | Rich text description (Markdown)           |
| `auction_type`      | VARCHAR(20)  | NOT NULL, CHECK IN ('live', 'silent')        | Live or silent auction                     |
| `starting_bid`      | DECIMAL(10,2)| NOT NULL, CHECK >= 0                         | Minimum opening bid (USD)                  |
| `donor_value`       | DECIMAL(10,2)| NULLABLE, CHECK >= 0                         | Fair market value                          |
| `cost`              | DECIMAL(10,2)| NULLABLE, CHECK >= 0                         | NPO's acquisition cost                     |
| `buy_now_price`     | DECIMAL(10,2)| NULLABLE, CHECK >= starting_bid              | Fixed instant purchase price               |
| `buy_now_enabled`   | BOOLEAN      | NOT NULL, DEFAULT FALSE                      | Enable buy-it-now feature                  |
| `quantity_available`| INTEGER      | NOT NULL, DEFAULT 1, CHECK >= 1              | Number of units (sold as single lot)       |
| `donated_by`        | VARCHAR(200) | NULLABLE                                     | Donor name (free text)                     |
| `sponsor_id`        | UUID         | NULLABLE, FK → sponsors(id) ON DELETE SET NULL| Sponsoring organization                    |
| `item_webpage`      | TEXT         | NULLABLE                                     | External URL for more info                 |
| `status`            | VARCHAR(20)  | NOT NULL, DEFAULT 'draft', CHECK IN (...)    | draft/published/sold/withdrawn             |
| `display_priority`  | INTEGER      | NULLABLE                                     | Sort order for featured items              |
| `created_by`        | UUID         | NOT NULL, FK → users(id)                     | User who created item                      |
| `created_at`        | TIMESTAMPTZ  | NOT NULL, DEFAULT CURRENT_TIMESTAMP          | Creation timestamp                         |
| `updated_at`        | TIMESTAMPTZ  | NOT NULL, DEFAULT CURRENT_TIMESTAMP          | Last update timestamp                      |
| `deleted_at`        | TIMESTAMPTZ  | NULLABLE                                     | Soft delete timestamp                      |

**Constraints**:

```sql
-- Primary Key
PRIMARY KEY (id)

-- Foreign Keys
FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
FOREIGN KEY (sponsor_id) REFERENCES sponsors(id) ON DELETE SET NULL
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT

-- Unique Constraints
UNIQUE (event_id, bid_number)  -- No duplicate bid numbers per event

-- Check Constraints
CHECK (auction_type IN ('live', 'silent'))
CHECK (status IN ('draft', 'published', 'sold', 'withdrawn'))
CHECK (starting_bid >= 0)
CHECK (donor_value IS NULL OR donor_value >= 0)
CHECK (cost IS NULL OR cost >= 0)
CHECK (buy_now_price IS NULL OR buy_now_price >= starting_bid)
CHECK (quantity_available >= 1)
CHECK (
    (buy_now_enabled = FALSE) OR
    (buy_now_enabled = TRUE AND buy_now_price IS NOT NULL)
)  -- If buy-now enabled, price must be set
```

**Indexes**:

```sql
CREATE INDEX idx_auction_items_event_id
  ON auction_items(event_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_auction_items_status
  ON auction_items(status)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_auction_items_auction_type
  ON auction_items(auction_type)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_auction_items_sponsor_id
  ON auction_items(sponsor_id)
  WHERE deleted_at IS NULL;

-- Composite index for common query pattern
CREATE INDEX idx_auction_items_event_status_type
  ON auction_items(event_id, status, auction_type)
  WHERE deleted_at IS NULL;

-- Bid number lookup
CREATE INDEX idx_auction_items_bid_number
  ON auction_items(event_id, bid_number)
  WHERE deleted_at IS NULL;
```

---

### 2. auction_item_media

**Purpose**: Media files (images/videos) associated with auction items

**Columns**:

| Column              | Type         | Constraints                                     | Description                           |
|---------------------|--------------|-------------------------------------------------|---------------------------------------|
| `id`                | UUID         | PRIMARY KEY, DEFAULT gen_random_uuid()          | Unique identifier                     |
| `auction_item_id`   | UUID         | NOT NULL, FK → auction_items(id) ON DELETE CASCADE | Parent auction item                   |
| `media_type`        | VARCHAR(20)  | NOT NULL, CHECK IN ('image', 'video')           | Image or video                        |
| `file_path`         | TEXT         | NOT NULL                                        | Azure Blob Storage path               |
| `file_name`         | VARCHAR(255) | NOT NULL                                        | Original filename                     |
| `file_size`         | INTEGER      | NOT NULL, CHECK > 0                             | File size in bytes                    |
| `mime_type`         | VARCHAR(100) | NOT NULL                                        | MIME type (image/jpeg, video/mp4)     |
| `display_order`     | INTEGER      | NOT NULL, DEFAULT 0                             | Order in gallery (0 = first)          |
| `thumbnail_path`    | TEXT         | NULLABLE                                        | Thumbnail blob path (images only)     |
| `video_url`         | TEXT         | NULLABLE                                        | YouTube/Vimeo URL (alternative to upload) |
| `created_at`        | TIMESTAMPTZ  | NOT NULL, DEFAULT CURRENT_TIMESTAMP             | Upload timestamp                      |

**Constraints**:

```sql
-- Primary Key
PRIMARY KEY (id)

-- Foreign Keys
FOREIGN KEY (auction_item_id) REFERENCES auction_items(id) ON DELETE CASCADE

-- Check Constraints
CHECK (media_type IN ('image', 'video'))
CHECK (file_size > 0)
CHECK (
    (media_type = 'image') OR
    (media_type = 'video' AND (file_path IS NOT NULL OR video_url IS NOT NULL))
)  -- Videos must have either file or URL
```

**Indexes**:

```sql
CREATE INDEX idx_auction_item_media_item_id
  ON auction_item_media(auction_item_id);

CREATE INDEX idx_auction_item_media_display_order
  ON auction_item_media(auction_item_id, display_order);
```

---

## Relationships

### auction_items ↔ events (Many-to-One)

- **Relationship**: Each auction item belongs to exactly one event
- **Foreign Key**: `auction_items.event_id → events.id`
- **Cascade**: ON DELETE CASCADE (delete items when event deleted)
- **Business Rule**: Items cannot be moved between events

### auction_items ↔ sponsors (Many-to-One, Optional)

- **Relationship**: Each item can have zero or one sponsor
- **Foreign Key**: `auction_items.sponsor_id → sponsors.id`
- **Cascade**: ON DELETE SET NULL (preserve item if sponsor deleted)
- **Business Rule**: Sponsor must belong to same event as item

### auction_items ↔ users (Many-to-One)

- **Relationship**: Each item created by one user
- **Foreign Key**: `auction_items.created_by → users.id`
- **Cascade**: ON DELETE RESTRICT (prevent user deletion if items exist)
- **Business Rule**: Creator must have NPO Admin/Staff role

### auction_items ↔ auction_item_media (One-to-Many)

- **Relationship**: Each item can have multiple media files
- **Foreign Key**: `auction_item_media.auction_item_id → auction_items.id`
- **Cascade**: ON DELETE CASCADE (delete media when item deleted)
- **Business Rule**: Max 20 images + 5 videos per item

---

## Validation Rules

### Field Validation

1. **title**
   - Required, non-empty
   - Max 200 characters
   - Trim whitespace
   - Sanitize HTML (prevent XSS)

2. **description**
   - Required, non-empty
   - Markdown format supported
   - Sanitize HTML output when rendering
   - Max 10,000 characters (soft limit)

3. **bid_number**
   - Auto-assigned (not user-editable after creation)
   - Range: 100-999
   - Unique within event
   - Sequential assignment order

4. **starting_bid**
   - Required
   - Decimal (10, 2) precision
   - Must be >= 0
   - Typically in range $1 - $10,000

5. **buy_now_price**
   - Optional
   - Must be >= starting_bid
   - Required if buy_now_enabled = true
   - Must be NULL if buy_now_enabled = false

6. **donated_by**
   - Optional free text
   - Max 200 characters
   - Trim whitespace

7. **item_webpage**
   - Optional
   - Must be valid HTTP/HTTPS URL
   - Max 2048 characters
   - URL validation and sanitization

8. **sponsor_id**
   - Optional
   - Must reference existing sponsor in same event
   - Cross-event sponsorship not allowed

### Business Logic Validation

1. **Buy-Now Constraints**
   ```python
   if buy_now_enabled:
       assert buy_now_price is not None
       assert buy_now_price >= starting_bid
   else:
       assert buy_now_price is None
   ```

2. **Media Count Limits**
   ```python
   image_count = count(media WHERE media_type = 'image')
   video_count = count(media WHERE media_type = 'video')
   assert image_count <= 20
   assert video_count <= 5
   ```

3. **Status Transition Rules**
   ```python
   # DRAFT → PUBLISHED: Must have at least title, description, starting_bid
   # PUBLISHED → SOLD: Only via bid winning or buy-now purchase
   # Any → WITHDRAWN: Allowed (soft delete)
   # WITHDRAWN → any: Not allowed (immutable after withdrawal)
   ```

4. **Sponsor Event Match**
   ```python
   if sponsor_id is not None:
       assert sponsor.event_id == item.event_id
   ```

---

## State Transitions

### Status State Machine

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  [CREATE]                                                   │
│     │                                                       │
│     v                                                       │
│  ┌───────┐                                                  │
│  │ DRAFT │ ◄──────────── Can edit freely                   │
│  └───┬───┘                                                  │
│      │                                                      │
│      │ publish()                                            │
│      │ - Validate required fields                           │
│      │ - At least 1 image recommended (warning)             │
│      v                                                      │
│  ┌────────────┐                                             │
│  │ PUBLISHED  │ ◄──── Visible to donors, accepts bids       │
│  └──┬─────┬───┘                                             │
│     │     │                                                 │
│     │     │ withdraw()                                      │
│     │     │ - Soft delete                                   │
│     │     │ - Preserve audit trail                          │
│     │     v                                                 │
│     │  ┌───────────┐                                        │
│     │  │ WITHDRAWN │ ◄──── Hidden, read-only               │
│     │  └───────────┘                                        │
│     │                                                       │
│     │ win_bid() OR buy_now()                                │
│     │ - Assign winner                                       │
│     │ - Close bidding                                       │
│     v                                                       │
│  ┌──────┐                                                   │
│  │ SOLD │ ◄──── Read-only, auction complete                │
│  └──────┘                                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Transition Rules

| From       | To         | Trigger              | Conditions                                    |
|------------|------------|----------------------|-----------------------------------------------|
| -          | DRAFT      | `create()`           | Always allowed                                |
| DRAFT      | PUBLISHED  | `publish()`          | title, description, starting_bid set          |
| PUBLISHED  | SOLD       | `win_bid()`          | Auction ended, highest bid wins               |
| PUBLISHED  | SOLD       | `buy_now()`          | User purchases at buy_now_price               |
| DRAFT      | WITHDRAWN  | `withdraw()`         | Always allowed                                |
| PUBLISHED  | WITHDRAWN  | `withdraw()`         | Always allowed (refund bids)                  |
| SOLD       | WITHDRAWN  | ❌ Not allowed       | -                                             |
| WITHDRAWN  | *          | ❌ Not allowed       | Terminal state (audit preservation)           |

### State-Dependent Behavior

**DRAFT**:
- ✅ Editable (all fields)
- ✅ Deletable (hard delete if no bids)
- ❌ Not visible to donors
- ❌ Cannot accept bids

**PUBLISHED**:
- ✅ Editable (show warning to coordinator)
- ✅ Deletable (soft delete, convert to WITHDRAWN)
- ✅ Visible to donors
- ✅ Accepts bids

**SOLD**:
- ❌ Not editable
- ❌ Not deletable
- ✅ Visible to donors (archive view)
- ❌ Cannot accept bids
- ℹ️ Winner information displayed

**WITHDRAWN**:
- ❌ Not editable
- ❌ Not deletable
- ❌ Not visible to donors
- ❌ Cannot accept bids
- ℹ️ Audit trail preserved

---

## Data Integrity Rules

### Referential Integrity

1. **Event Deletion Cascade**
   - When event deleted → cascade delete all auction items
   - When auction item deleted → cascade delete all media files
   - Blob storage cleanup triggered on cascade delete

2. **Sponsor Deletion**
   - When sponsor deleted → SET NULL on `auction_items.sponsor_id`
   - Item remains valid, just loses sponsor attribution

3. **User Deletion Protection**
   - Cannot delete user who created auction items (RESTRICT)
   - Must reassign or delete items first

### Transaction Boundaries

1. **Item Creation**
   ```sql
   BEGIN TRANSACTION;
     -- Assign bid number (atomic sequence increment)
     bid_number = nextval('event_{event_id}_bid_number_seq');

     -- Insert auction item
     INSERT INTO auction_items (...) VALUES (...);

     -- Log audit event
     INSERT INTO audit_logs (...) VALUES (...);
   COMMIT;
   ```

2. **Media Upload**
   ```sql
   BEGIN TRANSACTION;
     -- Upload blob (external, not in transaction)
     blob_url = upload_to_azure_blob(file);

     -- Create media record
     INSERT INTO auction_item_media (...) VALUES (...);

     -- If transaction fails, schedule blob cleanup
   COMMIT;
   ```

3. **Status Change**
   ```sql
   BEGIN TRANSACTION;
     -- Validate transition allowed
     IF NOT is_valid_transition(old_status, new_status):
       ROLLBACK;

     -- Update status
     UPDATE auction_items SET status = new_status WHERE id = item_id;

     -- Log audit event
     INSERT INTO audit_logs (...) VALUES (...);
   COMMIT;
   ```

### Concurrency Control

1. **Optimistic Locking** (Phase 2)
   - Add `version INTEGER` column
   - Increment on every UPDATE
   - Reject updates if version mismatch

2. **Bid Number Sequence**
   - PostgreSQL sequence handles concurrency
   - Gaps allowed (deleted items)
   - No manual intervention needed

3. **Buy-Now Race Condition**
   ```sql
   -- Transaction serializable isolation level
   BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
     -- Check status
     SELECT status FROM auction_items WHERE id = ? FOR UPDATE;

     -- If PUBLISHED, proceed
     UPDATE auction_items SET status = 'SOLD' WHERE id = ?;
   COMMIT;
   ```

---

## Audit Logging

### Logged Events

All auction item mutations logged to `audit_logs` table:

| Event              | Details Captured                                      |
|--------------------|-------------------------------------------------------|
| Item Created       | user_id, event_id, item_id, bid_number, title         |
| Item Updated       | user_id, item_id, changed_fields, old_values, new_values |
| Item Published     | user_id, item_id, publish_timestamp                   |
| Item Withdrawn     | user_id, item_id, reason (optional)                   |
| Item Sold          | user_id, item_id, winner_id, final_price              |
| Media Uploaded     | user_id, item_id, media_id, file_name, file_size      |
| Media Deleted      | user_id, item_id, media_id, file_name                 |
| Media Reordered    | user_id, item_id, old_order, new_order                |

### Audit Log Schema

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,  -- 'auction_item', 'auction_item_media'
    entity_id UUID NOT NULL,
    user_id UUID REFERENCES users(id),
    event_id UUID REFERENCES events(id),
    metadata JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_event ON audit_logs(event_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
```

---

## Data Model Summary

### Entities
- ✅ `auction_items`: Core entity (17 columns)
- ✅ `auction_item_media`: Media gallery (10 columns)
- ✅ Relationships to: events, sponsors, users

### Constraints
- ✅ 9 check constraints (validation)
- ✅ 3 foreign keys (referential integrity)
- ✅ 2 unique constraints (bid_number uniqueness)
- ✅ 8 indexes (query performance)

### State Machine
- ✅ 4 states (DRAFT → PUBLISHED → SOLD/WITHDRAWN)
- ✅ 6 valid transitions
- ✅ State-dependent permissions

### Validation
- ✅ Field-level rules (format, length, range)
- ✅ Business logic rules (buy-now, sponsor, media limits)
- ✅ State transition rules (immutability, terminal states)

### Audit
- ✅ All mutations logged
- ✅ Soft delete for items with bids
- ✅ Immutable audit trail

**Ready for Phase 1 continuation: API Contracts**
