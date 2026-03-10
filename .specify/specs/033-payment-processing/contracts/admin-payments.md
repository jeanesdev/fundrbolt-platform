# API Contracts: Admin-Facing Payment Endpoints

**Router prefix**: `/api/v1/admin/payments`
**Auth**: NPO Admin or Co-Admin role unless stated otherwise (FR-019, FR-021)

All request/response bodies are JSON.

---

## GET /api/v1/admin/payments/transactions

List payment transactions for an event, with filtering. Used in the event payment dashboard and
per-donor payment history panel.

**Auth**: NPO Admin, Co-Admin, NPO Staff, Check-in Staff (all can view — FR-018)

**Query params**:
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `event_id` | UUID | yes | |
| `user_id` | UUID | no | filter to a single donor |
| `status` | string | no | comma-separated: `pending,captured,declined,voided,refunded` |
| `page` | int | no | default 1 |
| `per_page` | int | no | default 50, max 200 |

**Response 200**:
```json
{
  "items": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "donor_name": "Jane Smith",
      "donor_email": "jane@example.com",
      "transaction_type": "charge",
      "status": "captured",
      "amount": 450.00,
      "currency": "USD",
      "line_items": [ ... ],
      "card_brand": "Visa",
      "card_last4": "4242",
      "initiated_by_name": null,
      "created_at": "2026-03-10T02:01:40Z",
      "receipt_url": "/api/v1/payments/transactions/{id}/receipt"
    }
  ],
  "total": 87,
  "page": 1,
  "per_page": 50
}
```

---

## GET /api/v1/admin/payments/donors

List donors for an event with their outstanding balance and payment status. Donors with an
outstanding balance but no saved payment method on file are flagged (FR-018).

**Auth**: NPO Admin, Co-Admin, NPO Staff, Check-in Staff

**Query params**:
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `event_id` | UUID | yes | |
| `has_balance` | bool | no | filter to donors with outstanding balance > 0 |
| `no_payment_method` | bool | no | filter to donors with no saved card |
| `page` | int | no | default 1 |
| `per_page` | int | no | default 50 |

**Response 200**:
```json
{
  "items": [
    {
      "user_id": "uuid",
      "donor_name": "Jane Smith",
      "bidder_number": 42,
      "outstanding_balance": 450.00,
      "has_payment_method": false,
      "no_payment_method_flag": true,
      "last_transaction_status": "declined",
      "last_transaction_at": "2026-03-10T22:10:00Z"
    }
  ],
  "total": 15,
  "page": 1,
  "per_page": 50
}
```

*(Donors with `no_payment_method_flag: true` are visually highlighted in the admin UI.)*

---

## POST /api/v1/admin/payments/charge

Admin-initiated charge against a donor's saved payment profile. Requires `reason`. Creates an
audit log entry with the initiating admin's user ID (FR-019, FR-020).

**Auth**: NPO Admin or Co-Admin **only** (Staff cannot initiate charges)

**Request**:
```json
{
  "event_id": "uuid",
  "user_id": "uuid",
  "payment_profile_id": "uuid",
  "amount": 450.00,
  "reason": "Donor left before completing checkout",
  "idempotency_key": "uuid"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `event_id` | UUID | yes | |
| `user_id` | UUID | yes | the donor being charged |
| `payment_profile_id` | UUID | yes | must belong to `user_id` for this NPO |
| `amount` | Decimal | yes | must be > 0 |
| `reason` | string | yes | min 3, max 500 chars |
| `idempotency_key` | UUID string | yes | |

**Response 200**:
```json
{
  "transaction_id": "uuid",
  "status": "captured",
  "amount_charged": 450.00,
  "initiated_by": "uuid",
  "receipt_pending": true
}
```

**Errors**:
- `400` — amount ≤ 0 or reason missing
- `402` — card declined
- `403` — caller is NPO Staff (not Admin/Co-Admin)
- `404` — user, event, or profile not found
- `409` — idempotency key already used (cached response)
- `422` — profile does not belong to the specified user+NPO
- `503` — gateway unavailable

**Admin charge override**: If `amount` exceeds the donor's computed outstanding balance, the
server returns a `422` with `{"detail": "amount_exceeds_balance", "balance": 450.00}`. The
frontend can allow the admin to explicitly override by re-sending with `"override_balance": true`.
Re-sending with override=true charges the specified amount regardless.

---

## POST /api/v1/admin/payments/{transaction_id}/void

Void an unsettled transaction before it clears. Only valid when `status = "authorized"`.

**Auth**: NPO Admin or Co-Admin **only** (FR-021)

**Path params**: `transaction_id` (UUID)

**Request**:
```json
{ "reason": "Coordinator error — wrong amount entered" }
```

**Response 200**:
```json
{
  "transaction_id": "uuid",
  "status": "voided",
  "voided_at": "2026-03-10T02:45:00Z"
}
```

**Errors**:
- `403` — caller is not NPO Admin or Co-Admin
- `404` — transaction not found
- `409` — transaction is already settled (`status = "captured"`) — use refund instead
- `422` — transaction is not in a voidable state

---

## POST /api/v1/admin/payments/{transaction_id}/refund

Issue a full or partial refund on a settled transaction (FR-022, FR-023).

**Auth**: NPO Admin or Co-Admin **only**

**Path params**: `transaction_id` (UUID)

**Request**:
```json
{
  "amount": 150.00,
  "reason": "Auction item not delivered"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `amount` | Decimal | yes | must be > 0 and ≤ `original_amount` |
| `reason` | string | yes | required for audit log |

**Response 200**:
```json
{
  "transaction_id": "uuid",
  "refund_transaction_id": "uuid",
  "status": "refunded",
  "amount_refunded": 150.00,
  "original_amount": 450.00,
  "remaining_amount": 300.00
}
```

**Errors**:
- `400` — `amount` ≤ 0 or `reason` missing
- `403` — caller is not NPO Admin or Co-Admin
- `404` — transaction not found
- `409` — transaction is not in a refundable state (e.g., already fully refunded or voided)
- `422` — `amount` exceeds surviving transaction amount
- `503` — gateway unavailable

---

## GET /api/v1/admin/payments/checkout/status

Check whether end-of-night checkout is open or closed for an event.

**Auth**: NPO Admin, Co-Admin, Staff

**Query params**: `event_id` (UUID)

**Response 200**:
```json
{
  "event_id": "uuid",
  "checkout_open": false,
  "opened_at": null,
  "opened_by": null,
  "auto_opened": false
}
```

---

## PATCH /api/v1/admin/payments/checkout/status

Manually open or close donor checkout for an event (FR-016).

**Auth**: NPO Admin or Co-Admin

**Request**:
```json
{
  "event_id": "uuid",
  "checkout_open": true
}
```

**Response 200**:
```json
{
  "event_id": "uuid",
  "checkout_open": true,
  "opened_at": "2026-03-10T22:00:00Z",
  "opened_by": "uuid"
}
```
