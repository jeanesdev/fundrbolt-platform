# Data Model: Payment Processing

**Branch**: `033-payment-processing` | **Date**: 2026-03-10

This document defines all new tables, column additions to existing tables, and the Alembic
migration plan for the payment processing feature.

---

## 1. New Tables

### 1.1 `payment_gateway_credentials`

Stores per-NPO Deluxe merchant account credentials. Sensitive fields (`merchant_id`, `api_key`,
`api_secret`) are encrypted at rest using Fernet / AES-128-CBC + HMAC before being written to
the DB. They are **never** returned in plaintext from any API endpoint.

```python
# backend/app/models/payment_gateway_credential.py

class PaymentGatewayCredential(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "payment_gateway_credentials"

    npo_id:            Mapped[uuid.UUID]    FK → npos.id, UNIQUE, NOT NULL
    gateway_name:      Mapped[str]          VARCHAR(50), default "deluxe", NOT NULL
    merchant_id_enc:   Mapped[str]          TEXT, NOT NULL          # encrypted
    api_key_enc:       Mapped[str]          TEXT, NOT NULL          # encrypted
    api_secret_enc:    Mapped[str]          TEXT, NOT NULL          # encrypted
    gateway_id:        Mapped[str | None]   VARCHAR(100)            # Deluxe terminal/gateway ID
    is_live_mode:      Mapped[bool]         BOOLEAN, default False
    is_active:         Mapped[bool]         BOOLEAN, default True
```

**Constraints**:
- UNIQUE on `npo_id` (one credential record per NPO)
- CHECK: `gateway_name IN ('deluxe', 'stub')` for initial implementation

**Indexes**:
- `npo_id` (unique)

---

### 1.2 `payment_profiles`

Tokenized saved card references ("vault tokens") held by Deluxe. Fundrbolt stores only display
metadata (last4, brand, expiry) and the opaque `gateway_profile_id`. Scoped per donor per NPO
(one NPO's vault is distinct from another's — FR-005).

```python
# backend/app/models/payment_profile.py

class PaymentProfile(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "payment_profiles"

    user_id:             Mapped[uuid.UUID]    FK → users.id, NOT NULL, index
    npo_id:              Mapped[uuid.UUID]    FK → npos.id, NOT NULL, index
    gateway_profile_id:  Mapped[str]          VARCHAR(255), NOT NULL
    card_last4:          Mapped[str]          CHAR(4), NOT NULL
    card_brand:          Mapped[str]          VARCHAR(20), NOT NULL  # "Visa"|"Mastercard"|"Amex"|"Discover"
    card_expiry_month:   Mapped[int]          SMALLINT, NOT NULL
    card_expiry_year:    Mapped[int]          SMALLINT, NOT NULL
    billing_name:        Mapped[str | None]   VARCHAR(200)
    billing_zip:         Mapped[str | None]   VARCHAR(10)
    is_default:          Mapped[bool]         BOOLEAN, default False, NOT NULL
    deleted_at:          Mapped[datetime | None]  DateTime(timezone=True)  # soft delete
```

**Constraints**:
- UNIQUE on `(user_id, npo_id, gateway_profile_id)`
- At most one `is_default = true` per `(user_id, npo_id)` — enforced at service layer (not DB
  constraint, because toggling default requires two UPDATEs; service uses a transaction)

**Indexes**:
- `(user_id, npo_id)` — primary query path for "list donor's cards"
- `gateway_profile_id` — for webhook lookup

**Soft delete**: `deleted_at` is set instead of physical deletion. The vault DELETE call to Deluxe
is made first; if it succeeds, `deleted_at` is written. Queries filter `WHERE deleted_at IS NULL`.

---

### 1.3 `payment_transactions`

Immutable audit record for every payment event: charge, authorization, void, or refund. The
`line_items` JSONB column captures the full breakdown of what was charged. `parent_transaction_id`
links refunds back to the original charge.

```python
# backend/app/models/payment_transaction.py

class TransactionType(str, enum.Enum):
    CHARGE    = "charge"
    AUTH_ONLY = "auth_only"
    CAPTURE   = "capture"
    VOID      = "void"
    REFUND    = "refund"

class TransactionStatus(str, enum.Enum):
    PENDING    = "pending"
    AUTHORIZED = "authorized"
    CAPTURED   = "captured"
    VOIDED     = "voided"
    REFUNDED   = "refunded"
    DECLINED   = "declined"
    ERROR      = "error"

class PaymentTransaction(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "payment_transactions"

    npo_id:                  Mapped[uuid.UUID]        FK → npos.id, NOT NULL, index
    event_id:                Mapped[uuid.UUID | None]  FK → events.id, index
    user_id:                 Mapped[uuid.UUID]         FK → users.id, NOT NULL, index
    payment_profile_id:      Mapped[uuid.UUID | None] FK → payment_profiles.id
    gateway_transaction_id:  Mapped[str | None]        VARCHAR(255), UNIQUE  # Deluxe txn_id
    idempotency_key:         Mapped[str | None]        VARCHAR(64), UNIQUE   # client-supplied
    transaction_type:        Mapped[TransactionType]   SQLEnum, NOT NULL
    status:                  Mapped[TransactionStatus] SQLEnum, NOT NULL, default "pending"
    amount:                  Mapped[Decimal]           NUMERIC(12,2), NOT NULL
    currency:                Mapped[str]               CHAR(3), default "USD", NOT NULL
    line_items:              Mapped[dict | None]       JSONB  # see schema below
    gateway_response:        Mapped[dict | None]       JSONB  # sanitised raw response
    initiated_by:            Mapped[uuid.UUID | None]  FK → users.id  # admin actor
    parent_transaction_id:   Mapped[uuid.UUID | None]  FK → self (payment_transactions.id)
    session_created_at:      Mapped[datetime | None]   DateTime(timezone=True)  # for polling fallback
    reason:                  Mapped[str | None]         TEXT    # admin-initiated charge/void/refund reason
```

**`line_items` JSONB schema** (each element in the array):
```json
[
  { "type": "ticket",       "label": "Gala Table for 8",          "amount": 800.00 },
  { "type": "auction_win",  "label": "Weekend Ski Getaway",        "amount": 350.00 },
  { "type": "donation",     "label": "Paddle Raise",               "amount": 100.00 },
  { "type": "extra_tip",    "label": "Extra Donation",             "amount": 25.00  },
  { "type": "fee_coverage", "label": "Processing Fee Coverage",    "amount": 38.78  }
]
```

**Constraints**:
- UNIQUE on `gateway_transaction_id` (deduplicates webhooks)
- UNIQUE on `idempotency_key` (prevents double-submit)
- CHECK: `amount >= 0`

**Indexes**:
- `(user_id, event_id)` — donor's transactions for an event
- `(event_id, status)` — admin dashboard filter
- `(npo_id, created_at)` — NPO revenue reporting
- `(status, session_created_at)` WHERE `status = 'pending'` — partial index for polling cron

---

### 1.4 `payment_receipts`

Metadata record for the generated PDF receipt. Linked 1:1 to a `payment_transaction`. The actual
PDF bytes live in Azure Blob Storage; this table tracks the URL and delivery status.

```python
# backend/app/models/payment_receipt.py

class PaymentReceipt(Base, UUIDMixin):
    __tablename__ = "payment_receipts"

    transaction_id:    Mapped[uuid.UUID]      FK → payment_transactions.id, UNIQUE, NOT NULL
    pdf_url:           Mapped[str | None]     VARCHAR(500)      # Blob Storage URL
    pdf_generated_at:  Mapped[datetime | None] DateTime(timezone=True)
    email_address:     Mapped[str]            VARCHAR(255), NOT NULL
    email_sent_at:     Mapped[datetime | None] DateTime(timezone=True)  # NULL = not sent
    email_attempts:    Mapped[int]            INTEGER, default 0, NOT NULL
    created_at:        Mapped[datetime]       DateTime(timezone=True), server_default=func.now()
```

**No `TimestampMixin`**: receipts are immutable after creation. `created_at` is append-only.

**Indexes**:
- `transaction_id` (unique)
- `(email_sent_at, email_attempts)` WHERE `email_sent_at IS NULL` — partial index for retry cron

---

## 2. Column Additions to Existing Tables

### 2.1 `ticket_purchases` — add `payment_transaction_id`

Links a ticket purchase to the Deluxe transaction that paid for it. Nullable until payment is
completed.

```sql
ALTER TABLE ticket_purchases
  ADD COLUMN payment_transaction_id UUID
    REFERENCES payment_transactions(id) ON DELETE SET NULL;

CREATE INDEX idx_ticket_purchases_payment_transaction_id
  ON ticket_purchases(payment_transaction_id);
```

### 2.2 `events` — add `checkout_open`

Controls whether end-of-night self-checkout is accessible to donors. Auto-set to `true` when
event status transitions to `"closed"`; can also be toggled manually by a coordinator (FR-016).

```sql
ALTER TABLE events
  ADD COLUMN checkout_open BOOLEAN NOT NULL DEFAULT FALSE;
```

---

## 3. Alembic Migration Plan

All changes land in a single migration file to keep the atomic set of schema changes together:

**Migration**: `alembic/versions/[hash]_add_payment_processing_tables.py`

| Step | Operation | Description |
|------|-----------|-------------|
| M1 | `CREATE TABLE payment_gateway_credentials` | New table, see §1.1 |
| M2 | `CREATE TABLE payment_profiles` + indexes | New table, see §1.2 |
| M3 | `CREATE TABLE payment_transactions` + indexes | New table, see §1.3 |
| M4 | `CREATE TABLE payment_receipts` + indexes | New table, see §1.4 |
| M5 | `ALTER TABLE ticket_purchases ADD COLUMN payment_transaction_id` | FK to transactions |
| M6 | `ALTER TABLE events ADD COLUMN checkout_open BOOLEAN DEFAULT FALSE` | Checkout gate |
| M7 | Additional indexes (see §3.1 below) | Query optimisation |

The migration is reversible: the `downgrade()` function drops tables in reverse dependency order.

### 3.1 Additional Standalone Indexes (M7)

```sql
-- Partial index for the pending-transaction polling cron (R-005)
CREATE INDEX idx_payment_transactions_pending_created
  ON payment_transactions(session_created_at)
  WHERE status = 'pending';

-- Partial index for receipt email retry (R-012)
CREATE INDEX idx_payment_receipts_pending_email
  ON payment_receipts(email_attempts)
  WHERE email_sent_at IS NULL;
```

---

## 4. Entity Relationships (ERD Summary)

```
npos
 ├── payment_gateway_credentials   (1:1)
 ├── payment_profiles              (1:N via user_id+npo_id)
 └── payment_transactions          (1:N)

users
 ├── payment_profiles              (1:N per npo_id)
 └── payment_transactions          (1:N as user_id; also 1:N as initiated_by)

events
 ├── payment_transactions          (1:N)
 └── checkout_open                 (column on events)

payment_transactions
 ├── payment_receipts              (1:1)
 ├── payment_profiles              (N:1 — profile used for charge)
 └── payment_transactions (self)   (parent_transaction_id for refunds)

ticket_purchases
 └── payment_transactions          (N:1 — which transaction paid for this purchase)
```

---

## 5. SQLAlchemy Enum Registration

New Python enums that must be registered in `backend/app/models/__init__.py` and referenced in
Alembic's `env.py` so autogenerate tracks them correctly:

- `TransactionType` → `transaction_type_enum` PostgreSQL type
- `TransactionStatus` → `transaction_status_enum` PostgreSQL type

---

## 6. `__init__.py` Additions

Add to `backend/app/models/__init__.py`:

```python
from app.models.payment_gateway_credential import PaymentGatewayCredential
from app.models.payment_profile import PaymentProfile
from app.models.payment_transaction import PaymentTransaction, TransactionType, TransactionStatus
from app.models.payment_receipt import PaymentReceipt
```

And add each to `__all__`.

---

## 7. Design Decisions

| Decision | Rationale |
|----------|-----------|
| Soft delete on `payment_profiles` | Preserves receipt/audit trail linkage; actual vault deletion is done before soft-delete so Deluxe purges the card data |
| JSONB for `line_items` | Receipt line items are flexible (ticket vs. auction vs. tip vs. fee) and do not need foreign-key integrity; JSONB allows any breakdown without schema migration |
| JSONB for `gateway_response` | Stores full sanitised raw gateway response for debugging without hard-coding gateway-specific columns |
| Single migration file | All 6 DDL steps are interdependent (FK constraints); atomic migration is safer than phased |
| `idempotency_key` UNIQUE nullable | Client provides the key only for checkout calls; admin-initiated charges use a server-generated UUID as key |
| `checkout_open` default FALSE | Prevents donors from accessing checkout before coordinator is ready; auto-opens on event close via application logic (not DB trigger) |
