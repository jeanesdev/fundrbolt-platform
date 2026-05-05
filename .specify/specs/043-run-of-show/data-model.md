# Data Model: Run-of-Show Management (043)

**Date**: 2026-05-03 | **Branch**: `043-run-of-show`

## Overview

4 new PostgreSQL tables. All follow the `UUIDMixin` + `TimestampMixin` patterns established in `backend/app/models/base.py`. Foreign keys follow existing conventions (UUID PK, `ondelete="CASCADE"` for child rows, `ondelete="RESTRICT"` for audit-trail references).

---

## Entity: `RunOfShowTemplate`

**Table**: `run_of_show_templates`
**Purpose**: Reusable named schedule blueprint scoped to an NPO (or system-wide when `npo_id=NULL`).

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | UUID PK | no | gen_random_uuid() | |
| `npo_id` | UUID FK → `npos.id` | yes | NULL | NULL = system default |
| `name` | VARCHAR(200) | no | — | Display name |
| `is_system_default` | BOOLEAN | no | false | TRUE for the seeded "3-Hour Gala" |
| `created_by` | UUID FK → `users.id` | yes | NULL | NULL for seeded/system templates |
| `created_at` | TIMESTAMPTZ | no | now() | |
| `updated_at` | TIMESTAMPTZ | no | now() | |

**Constraints**:
- `UNIQUE(npo_id, name)` — unique template names per NPO
- `CHECK(NOT is_system_default OR npo_id IS NULL)` — system defaults have no NPO owner

**Indexes**:
- `ix_run_of_show_templates_npo_id` on `(npo_id)`

---

## Entity: `RunOfShowTemplateItem`

**Table**: `run_of_show_template_items`
**Purpose**: One line item in a template; uses minute-offset from event start time.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | UUID PK | no | gen_random_uuid() | |
| `template_id` | UUID FK → `run_of_show_templates.id` ON DELETE CASCADE | no | — | |
| `title` | VARCHAR(200) | no | — | |
| `description` | TEXT | yes | NULL | |
| `offset_minutes` | INTEGER | no | — | Minutes from event start_time (≥0) |
| `donor_visible_default` | BOOLEAN | no | false | Default visibility when applied |
| `auctioneer_visible_default` | BOOLEAN | no | true | Default visibility when applied |
| `display_order` | INTEGER | no | 0 | Manual sort position |

**Constraints**:
- `CHECK(length(title) >= 1)`
- `CHECK(offset_minutes >= 0)`

**Indexes**:
- `ix_run_of_show_template_items_template_id` on `(template_id)`

---

## Entity: `RunOfShowItem`

**Table**: `run_of_show_items`
**Purpose**: Concrete scheduled program item attached to a specific event.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | UUID PK | no | gen_random_uuid() | |
| `event_id` | UUID FK → `events.id` ON DELETE CASCADE | no | — | |
| `title` | VARCHAR(200) | no | — | |
| `description` | TEXT | yes | NULL | |
| `scheduled_time` | TIMESTAMPTZ | no | — | Wall-clock absolute time |
| `donor_visible` | BOOLEAN | no | false | Whether donors see this item |
| `auctioneer_visible` | BOOLEAN | no | true | Whether auctioneer sees this item |
| `is_complete` | BOOLEAN | no | false | Marked complete during the event |
| `completed_at` | TIMESTAMPTZ | yes | NULL | Set when is_complete transitions to TRUE |
| `display_order` | INTEGER | no | 0 | Manual sort position (not auto by time) |
| `created_by` | UUID FK → `users.id` ON DELETE RESTRICT | no | — | |
| `created_at` | TIMESTAMPTZ | no | now() | |
| `updated_at` | TIMESTAMPTZ | no | now() | |

**Constraints**:
- `CHECK(length(title) >= 1)`

**Indexes**:
- `ix_run_of_show_items_event_id` on `(event_id)`
- `ix_run_of_show_items_event_scheduled_time` on `(event_id, scheduled_time)` — for "next item" queries

---

## Entity: `ScheduledRunOfShowNotification`

**Table**: `scheduled_run_of_show_notifications`
**Purpose**: Pending (or delivered/failed) notification attached to a run-of-show item. One notification per item maximum.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | UUID PK | no | gen_random_uuid() | |
| `ros_item_id` | UUID FK → `run_of_show_items.id` ON DELETE CASCADE | no | — | One-to-one (UNIQUE) |
| `message_body` | TEXT | no | — | Custom message composed by admin |
| `recipient_type` | ENUM | no | — | `checked_in_donors` / `auctioneer` / `all_checked_in` |
| `scheduled_at` | TIMESTAMPTZ | no | — | When to fire (mirrors `run_of_show_items.scheduled_time`) |
| `delivery_status` | ENUM | no | `pending` | `pending` / `delivered` / `failed` / `cancelled` |
| `celery_task_id` | VARCHAR(255) | yes | NULL | Celery task ID for revocation |
| `delivered_at` | TIMESTAMPTZ | yes | NULL | Set on successful delivery |
| `failure_reason` | TEXT | yes | NULL | Set on final delivery failure |
| `created_at` | TIMESTAMPTZ | no | now() | |
| `updated_at` | TIMESTAMPTZ | no | now() | |

**Enums**:
```sql
CREATE TYPE ros_notification_recipient_type_enum AS ENUM (
  'checked_in_donors',
  'auctioneer',
  'all_checked_in'
);

CREATE TYPE ros_notification_delivery_status_enum AS ENUM (
  'pending',
  'delivered',
  'failed',
  'cancelled'
);
```

**Constraints**:
- `UNIQUE(ros_item_id)` — at most one notification per RoS item

**Indexes**:
- `ix_scheduled_ros_notifications_ros_item_id` on `(ros_item_id)`
- `ix_scheduled_ros_notifications_delivery_status` on `(delivery_status)` — for cancellation queries

---

## Entity Relationship Diagram (text)

```
npos ──────────────────────────────┐
   │                               │
   │ 1:N                          │ 1:N
   ▼                               ▼
run_of_show_templates         events
   │                               │
   │ 1:N                          │ 1:N
   ▼                               ▼
run_of_show_template_items   run_of_show_items
                                   │
                                   │ 1:0..1
                                   ▼
                         scheduled_run_of_show_notifications
```

---

## Migration Strategy

**Migration file**: `backend/alembic/versions/ros_001_add_run_of_show_tables.py`

Order of operations in `upgrade()`:
1. Create ENUMs: `ros_notification_recipient_type_enum`, `ros_notification_delivery_status_enum`
2. Create `run_of_show_templates`
3. Create `run_of_show_template_items`
4. Create `run_of_show_items`
5. Create `scheduled_run_of_show_notifications`
6. Seed the "3-Hour Gala" system default template (14 items from FR-008)

**Seed data** (template items — `npo_id=NULL, is_system_default=TRUE, name="3-Hour Gala"`):

| Title | offset_minutes | donor_visible_default | auctioneer_visible_default |
|-------|----------------|-----------------------|---------------------------|
| Doors Open | 0 | true | true |
| Welcome Reception / Cocktail Hour | 15 | true | true |
| Guests Take Seats | 60 | true | true |
| Opening Remarks | 70 | true | true |
| Sponsor Recognition | 80 | true | true |
| Dinner Service Begins | 90 | true | true |
| Silent Auction Closes | 95 | false | true |
| Live Auction Begins | 100 | true | true |
| Fund-a-Need / Paddle Raise | 120 | true | true |
| Live Auction Closes | 150 | false | true |
| Award Presentation / Mission Moment | 155 | true | true |
| Closing Remarks | 165 | true | true |
| Checkout Opens | 170 | true | true |
| Event Concludes | 180 | true | true |

---

## SQLAlchemy Model Summary

```python
# backend/app/models/run_of_show.py

class RosRecipientTypeEnum(str, enum.Enum):
    CHECKED_IN_DONORS = "checked_in_donors"
    AUCTIONEER = "auctioneer"
    ALL_CHECKED_IN = "all_checked_in"

class RosDeliveryStatusEnum(str, enum.Enum):
    PENDING = "pending"
    DELIVERED = "delivered"
    FAILED = "failed"
    CANCELLED = "cancelled"

class RunOfShowTemplate(Base, UUIDMixin, TimestampMixin): ...
class RunOfShowTemplateItem(Base, UUIDMixin): ...
class RunOfShowItem(Base, UUIDMixin, TimestampMixin): ...
class ScheduledRunOfShowNotification(Base, UUIDMixin, TimestampMixin): ...
```

---

## Notes on Differences from Checklist

| Aspect | Checklist | Run-of-Show |
|--------|-----------|-------------|
| Time unit | `offset_days` (integer, relative to event date) | `scheduled_time` (TIMESTAMPTZ, absolute); template uses `offset_minutes` |
| Visibility flags | None | `donor_visible` + `auctioneer_visible` |
| Completion | 3-state enum (`not_complete`/`in_progress`/`complete`) | Boolean `is_complete` |
| Notifications | None | `ScheduledRunOfShowNotification` → Celery |
| Template scope | NPO + system | NPO + system (same pattern) |
| Template item offset | `offset_days` (can be negative) | `offset_minutes` (≥0, from event start) |
