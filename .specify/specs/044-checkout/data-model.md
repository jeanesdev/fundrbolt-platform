# Data Model: 044-checkout — Donor Event Checkout

**Date**: 2026-05-05 | **Branch**: `044-checkout`

---

## New Tables

### `processing_fee_configs`

Global Super Admin setting for the default processing fee rate. The current rate is always the most-recently inserted row (append-only audit table).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK, default gen_random_uuid() | |
| `rate` | NUMERIC(5,4) | NOT NULL, CHECK (rate >= 0 AND rate <= 1) | e.g. 0.0290 = 2.90% |
| `created_by` | UUID | FK → users(id), NOT NULL | Super Admin who set the rate |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | Immutable audit |

**Notes**:
- No UPDATE/DELETE — append-only. Current rate = `SELECT rate FROM processing_fee_configs ORDER BY created_at DESC LIMIT 1`
- Seed row: `rate=0.0290` on first migration
- SQLAlchemy model: `ProcessingFeeConfig` in `backend/app/models/processing_fee_config.py`

---

### `checkout_configurations`

Per-event checkout settings. One row per event. Snapshotted processing fee rate captured at the moment checkout is opened.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK, default gen_random_uuid() | |
| `event_id` | UUID | FK → events(id) ON DELETE CASCADE, UNIQUE, NOT NULL | One config per event |
| `is_open` | BOOLEAN | NOT NULL, default false | Checkout currently open |
| `donor_visible` | BOOLEAN | NOT NULL, default false | Card visible on My Event page |
| `scheduled_open_at` | TIMESTAMPTZ | nullable | Future auto-open time |
| `opened_at` | TIMESTAMPTZ | nullable | When checkout was actually opened |
| `processing_fee_rate` | NUMERIC(5,4) | nullable | Snapshotted at open time; NULL until opened |
| `cash_instructions` | TEXT | nullable | Booth instructions + NPO payee name for Cash/Check/DAF |
| `celery_task_id` | TEXT | nullable | Active scheduled-open Celery task ID (for revocation) |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default now() | |

**State transitions**:
- Created with `is_open=false`, `donor_visible=false`
- Manual open: `is_open=true`, `donor_visible=true`, `opened_at=now()`, `processing_fee_rate` snapshotted
- Scheduled open (Celery fires): same as manual open
- Admin closes: `is_open=false` (donor_visible stays true so card shows "complete")

**SQLAlchemy model**: `CheckoutConfiguration` in `backend/app/models/checkout_configuration.py`

---

### `checkout_sessions`

One row per donor per event. Created lazily when donor or admin first accesses checkout for that event.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK, default gen_random_uuid() | |
| `event_id` | UUID | FK → events(id) ON DELETE CASCADE, NOT NULL | |
| `user_id` | UUID | FK → users(id) ON DELETE CASCADE, NOT NULL | Donor |
| `status` | ENUM `checkout_status_enum` | NOT NULL, default 'not_started' | Values: `not_started`, `in_progress`, `complete` |
| `payment_method` | ENUM `checkout_payment_method_enum` | NOT NULL, default 'card' | Values: `card`, `cash`, `check`, `daf` |
| `cover_processing_fee` | BOOLEAN | NOT NULL, default true | Cover-fee checkbox checked by default per FR-003 |
| `auctioneer_tip_cents` | INTEGER | NOT NULL, default 5000 | Default $50 per spec (FR-005) |
| `platform_tip_cents` | INTEGER | NOT NULL, default 0 | Default $0 per spec (FR-006) |
| `subtotal_cents` | INTEGER | NOT NULL, default 0 | Sum of checkout_items.effective_amount_cents |
| `processing_fee_cents` | INTEGER | NOT NULL, default 0 | Computed from snapshotted rate |
| `total_cents` | INTEGER | NOT NULL, default 0 | subtotal + tips + (fee if cover_fee) |
| `completed_at` | TIMESTAMPTZ | nullable | Null until status = 'complete' |
| `receipt_url` | TEXT | nullable | Azure Blob URL for generated PDF receipt |
| `items_updated_at` | TIMESTAMPTZ | nullable | SET when admin modifies items; donor polls this |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default now() | |

**Constraints**:
- `UNIQUE (event_id, user_id)` — one session per donor per event
- `CHECK (auctioneer_tip_cents >= 0)`
- `CHECK (platform_tip_cents >= 0)`
- `CHECK (subtotal_cents >= 0)`

**SQLAlchemy model**: `CheckoutSession` in `backend/app/models/checkout_session.py`

---

### `checkout_items`

Individual line items within a donor's checkout session. Source records are denormalized for performance (no joins needed to show receipt).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK, default gen_random_uuid() | |
| `session_id` | UUID | FK → checkout_sessions(id) ON DELETE CASCADE, NOT NULL | |
| `name` | VARCHAR(200) | NOT NULL | Display name (copied from source record) |
| `description` | TEXT | nullable | Optional detail line |
| `original_amount_cents` | INTEGER | NOT NULL, CHECK >= 0 | Amount at time of commitment |
| `adjusted_amount_cents` | INTEGER | nullable | Admin override; NULL = use original |
| `source_type` | ENUM `checkout_item_source_type_enum` | NOT NULL | `auction_win`, `quick_entry_bid`, `quick_entry_donation`, `ticket`, `revenue_generator`, `manual` |
| `source_id` | UUID | nullable | FK to source record (auction_bid.id, etc.) — nullable for manual items |
| `display_order` | INTEGER | NOT NULL, default 0 | Sort order in UI |
| `deleted_at` | TIMESTAMPTZ | nullable | Soft delete; NULL = active |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default now() | |

**Computed property** (Python property, not DB column):
```python
@property
def effective_amount_cents(self) -> int:
    return self.adjusted_amount_cents if self.adjusted_amount_cents is not None else self.original_amount_cents
```

**SQLAlchemy model**: `CheckoutItem` in `backend/app/models/checkout_session.py` (same file as `CheckoutSession`)

---

### `checkout_audit_logs`

Immutable audit trail for all admin modifications to checkout sessions. Append-only.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK, default gen_random_uuid() | |
| `session_id` | UUID | FK → checkout_sessions(id) ON DELETE CASCADE, NOT NULL | |
| `admin_user_id` | UUID | FK → users(id), NOT NULL | Admin who made the change |
| `action` | ENUM `checkout_audit_action_enum` | NOT NULL | `item_added`, `item_removed`, `item_repriced` |
| `item_id` | UUID | FK → checkout_items(id), NOT NULL | Item affected |
| `field_changed` | VARCHAR(50) | nullable | e.g. `adjusted_amount_cents` |
| `before_value` | TEXT | nullable | String repr of old value |
| `after_value` | TEXT | nullable | String repr of new value |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | Immutable |

**No UPDATE/DELETE on this table** — enforced at ORM layer (no service methods for mutation).

**SQLAlchemy model**: `CheckoutAuditLog` in `backend/app/models/checkout_session.py`

---

## New PostgreSQL Enums

```sql
CREATE TYPE checkout_status_enum AS ENUM ('not_started', 'in_progress', 'complete');
CREATE TYPE checkout_payment_method_enum AS ENUM ('card', 'cash', 'check', 'daf');
CREATE TYPE checkout_item_source_type_enum AS ENUM (
  'auction_win', 'quick_entry_bid', 'quick_entry_donation', 'ticket', 'revenue_generator', 'manual'
); -- revenue_generator: entries from RevenueGeneratorEntry; manual: admin-added items
CREATE TYPE checkout_audit_action_enum AS ENUM ('item_added', 'item_removed', 'item_repriced');
```

---

## Relationships

```
processing_fee_configs (N rows, latest = current rate)

events ─── 1:1 ──► checkout_configurations
events ─── 1:N ──► checkout_sessions
users  ─── 1:N ──► checkout_sessions
checkout_sessions ── 1:N ──► checkout_items
checkout_sessions ── 1:N ──► checkout_audit_logs
checkout_items    ── N:1 ──► checkout_audit_logs (item_id FK)
users             ── N:1 ──► checkout_audit_logs (admin_user_id FK)
```

---

## Alembic Migration Strategy

Single migration file: `backend/alembic/versions/xxxx_add_checkout_tables.py`

1. Create 4 new ENUM types
2. Create `processing_fee_configs` table + seed row (rate=0.0290)
3. Create `checkout_configurations` table
4. Create `checkout_sessions` table
5. Create `checkout_items` table
6. Create `checkout_audit_logs` table

No changes to `events` table (checkout configuration stored separately).
