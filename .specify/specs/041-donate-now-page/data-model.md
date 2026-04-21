# Data Model: Donate Now Page (041)

**Date**: 2026-04-20
**Branch**: `041-donate-now-page`

---

## Overview

Four new tables, one modified table, and two new Celery task types. All new tables use the platform-standard UUID primary keys, `created_at`/`updated_at` timestamps, and soft-delete where applicable.

---

## Modified Entities

### `npos` table (existing — modify)

Add column:

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `slug` | `VARCHAR(100)` | UNIQUE, NOT NULL (backfilled from slugified `name`) | URL-safe identifier for `/npo/$slug/donate-now` |

**Slug generation rule**: lowercase, alphanumeric + hyphens only, max 100 chars. Backfill: `re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')[:100]`. Admins can update slug through the Admin PWA (triggers a redirect from old slug, not in this feature scope).

**Migration**: `043a_add_npo_slug.py`

---

## New Entities

### `donate_now_page_configs` (new)

One row per NPO. Stores all admin-configurable settings for the Donate Now page.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | PK | |
| `npo_id` | `UUID` | FK → `npos.id`, UNIQUE, NOT NULL | One config per NPO |
| `is_enabled` | `BOOLEAN` | NOT NULL, DEFAULT false | Toggles the page on/off |
| `donate_plea_text` | `VARCHAR(500)` | NULLABLE | Headline below hero |
| `hero_media_url` | `TEXT` | NULLABLE | Blob Storage URL |
| `hero_transition_style` | `VARCHAR(50)` | NULLABLE, DEFAULT `'documentary_style'` | One of: `documentary_style`, `fade`, `swipe`, `simple` |
| `processing_fee_pct` | `NUMERIC(5,4)` | NOT NULL, DEFAULT 0.029 | e.g., 0.029 = 2.9%. Admin-configurable. |
| `npo_info_text` | `TEXT` | NULLABLE | Plain text bio/contact block |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | NOT NULL, DEFAULT now() | |
| `updated_at` | `TIMESTAMP WITH TIME ZONE` | NOT NULL, DEFAULT now() | Auto-updated |

**Relationships**:
- `npo` → `NPO` (many-to-one, back-populates `donate_now_config`)
- `donation_tiers` → `DonationTier[]` (one-to-many, cascade delete)
- `donations` → `Donation[]` (one-to-many)

---

### `donation_tiers` (new)

Ordered list of preset donation amounts configured by the NPO admin.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | PK | |
| `config_id` | `UUID` | FK → `donate_now_page_configs.id`, NOT NULL | |
| `amount_cents` | `INTEGER` | NOT NULL, CHECK > 0 | Stored in cents to avoid float issues |
| `impact_statement` | `VARCHAR(200)` | NULLABLE | e.g., "Feeds a family for a week" |
| `display_order` | `SMALLINT` | NOT NULL, DEFAULT 0 | Controls button order on the page |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | NOT NULL, DEFAULT now() | |

**Validation**: Max 10 tiers per config. Amount must be ≥ $1 (100 cents).

---

### `donations` (new)

One row per submitted donation (one-time or recurring). Linked to the platform's existing `payment_transactions` for the actual charge record.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | PK | |
| `config_id` | `UUID` | FK → `donate_now_page_configs.id`, NOT NULL | Which NPO donate page |
| `npo_id` | `UUID` | FK → `npos.id`, NOT NULL | Denormalized for query efficiency |
| `donor_user_id` | `UUID` | FK → `users.id`, NULLABLE | NULL if anonymous display (but auth required — stores real user; display controlled by `is_anonymous`) |
| `amount_cents` | `INTEGER` | NOT NULL, CHECK > 0 | Donation amount |
| `covers_processing_fee` | `BOOLEAN` | NOT NULL, DEFAULT false | Donor opted to cover fees |
| `processing_fee_cents` | `INTEGER` | NOT NULL, DEFAULT 0 | Calculated fee amount in cents |
| `total_charged_cents` | `INTEGER` | NOT NULL | `amount_cents + processing_fee_cents` |
| `is_monthly` | `BOOLEAN` | NOT NULL, DEFAULT false | Recurring monthly flag |
| `recurrence_start` | `DATE` | NULLABLE | For monthly: start date |
| `recurrence_end` | `DATE` | NULLABLE | For monthly: end date (NULL = open-ended) |
| `recurrence_status` | `VARCHAR(20)` | NULLABLE | `active`, `cancelled`, `completed`. NULL for one-time. |
| `next_charge_date` | `DATE` | NULLABLE | Next Celery charge date for recurring |
| `payment_profile_id` | `UUID` | FK → `payment_profiles.id`, NULLABLE | Vault profile used for recurring charges |
| `payment_transaction_id` | `UUID` | FK → `payment_transactions.id`, NULLABLE | Initial charge transaction |
| `status` | `VARCHAR(20)` | NOT NULL, DEFAULT `'pending'` | `pending`, `captured`, `declined`, `cancelled` |
| `idempotency_key` | `VARCHAR(100)` | UNIQUE, NOT NULL | Prevents double-submission |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | NOT NULL, DEFAULT now() | |
| `updated_at` | `TIMESTAMP WITH TIME ZONE` | NOT NULL, DEFAULT now() | |

**State transitions**:
```
pending → captured  (payment succeeds)
pending → declined  (payment processor declines)
captured → cancelled (donor cancels recurring, or recurrence_end reached)
```

**Indexes**: `(npo_id, status)`, `(donor_user_id)`, `(next_charge_date)` (for Celery task query), `(idempotency_key)` unique.

---

### `support_wall_entries` (new)

One row per donor who submitted a message with their donation.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | PK | |
| `donation_id` | `UUID` | FK → `donations.id`, UNIQUE, NOT NULL | One entry per donation |
| `npo_id` | `UUID` | FK → `npos.id`, NOT NULL | Denormalized for efficient wall queries |
| `display_name` | `VARCHAR(255)` | NULLABLE | Derived from user if not anonymous; NULL = "Anonymous" |
| `is_anonymous` | `BOOLEAN` | NOT NULL, DEFAULT false | If true, show "Anonymous" regardless of `display_name` |
| `show_amount` | `BOOLEAN` | NOT NULL, DEFAULT true | If false, hide donation amount on wall |
| `message` | `VARCHAR(200)` | NULLABLE | Donor's wall message |
| `is_hidden` | `BOOLEAN` | NOT NULL, DEFAULT false | Admin moderation: hide from wall |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | NOT NULL, DEFAULT now() | |

**Indexes**: `(npo_id, is_hidden, created_at DESC)` — primary query index for the paginated wall.

---

## Celery Tasks

### `process_monthly_donations` (new periodic task)

- **Schedule**: Daily at 06:00 UTC (Celery beat)
- **Logic**: Query `donations` WHERE `is_monthly=true AND recurrence_status='active' AND next_charge_date <= today`
- For each: charge `payment_profile_id` via existing `DeluxePaymentGateway`; on success create new `PaymentTransaction`, update `next_charge_date += 1 month`, insert new `donations` row for the charge record; on failure log and notify NPO admin (email).
- **Idempotency**: Each charge attempt generates a unique `idempotency_key` = `f"monthly-{donation_id}-{next_charge_date}"`.

---

## Entity Relationship Summary

```
npos (modified)
  └─ donate_now_page_configs (1:1)
       ├─ donation_tiers[] (1:N)
       └─ donations[] (1:N)
            ├─ payment_transactions (N:1, existing)
            ├─ payment_profiles (N:1, existing)
            └─ support_wall_entries (1:1)
```

---

## Migration Plan

| Migration | Contents |
|-----------|----------|
| `043a_add_npo_slug.py` | ADD COLUMN `slug VARCHAR(100)` to `npos`; backfill; ADD UNIQUE constraint |
| `043b_add_donate_now_tables.py` | CREATE `donate_now_page_configs`, `donation_tiers`, `donations`, `support_wall_entries`; foreign keys; indexes |
