# API Contracts: Donor-Facing Payment Endpoints

**Router prefix**: `/api/v1/payments`
**Auth**: JWT Bearer token (donor role) unless stated otherwise

All request/response bodies are JSON. Error responses follow the existing FastAPI `{"detail": "..."}` pattern.

---

## POST /api/v1/payments/session

Create a Hosted Payment Form session. Returns a session URL for embedding in an iframe plus a
pending transaction ID. Used for the initial card-entry / ticket-purchase flow when the donor
does not yet have a saved payment profile.

**Auth**: Donor (authenticated)

**Request**:
```json
{
  "event_id": "uuid",
  "line_items": [
    { "type": "ticket", "label": "Gala Table for 8", "amount": 800.00 }
  ],
  "save_profile": true,
  "return_url": "https://app.fundrbolt.com/events/gala-2026/tickets/checkout?step=confirm",
  "idempotency_key": "uuid"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `event_id` | UUID | yes | |
| `line_items` | array | yes | at least 1 item; see line_item schema |
| `save_profile` | bool | no | default `true` — requests vault creation |
| `return_url` | string | yes | redirect target after HPF completion |
| `idempotency_key` | UUID string | yes | caller generates; prevents duplicate sessions |

**Line item object**:
```json
{ "type": "ticket|auction_win|donation|extra_tip|fee_coverage", "label": "string", "amount": 0.00 }
```

**Response 200**:
```json
{
  "transaction_id": "uuid",
  "session_token": "hpf_abc123",
  "hpf_url": "https://pay.deluxe.com/hosted-payment?token=hpf_abc123",
  "expires_at": "2026-03-10T02:15:00Z",
  "amount_total": 800.00
}
```

**Errors**:
- `400` — `line_items` empty or amount ≤ 0
- `404` — event not found or not open for payments
- `409` — idempotency key matches an existing non-pending transaction (returns cached response)
- `422` — NPO has no active payment credentials
- `503` — gateway unavailable (stub or Deluxe unreachable)

---

## POST /api/v1/payments/webhook

Receive and process a signed IPN/webhook from the Deluxe gateway. This endpoint is **unauthenticated** but protected by HMAC-SHA256 signature verification (`X-Deluxe-Signature` header).

**Auth**: None — HMAC-verified (FR-033, R-003)

**Request headers**:
```
X-Deluxe-Signature: sha256=<hex-digest>
X-Deluxe-Timestamp: <unix-timestamp>
```

**Request body** (Deluxe IPN payload):
```json
{
  "event_type": "transaction.completed",
  "transaction_id": "deluxe_txn_abc123",
  "status": "approved",
  "amount": "800.00",
  "currency": "USD",
  "order_id": "txn_<our-uuid>",
  "profile_id": "vault_xxx",
  "card_last4": "4242",
  "card_brand": "Visa",
  "auth_code": "ABC123",
  "metadata": { "user_id": "uuid", "event_id": "uuid" },
  "timestamp": "2026-03-10T02:01:40Z"
}
```

**Response 200** (empty body — acknowledge receipt):
```json
{}
```

**Side effects on success**:
1. Verify HMAC signature — reject `400` if invalid
2. Look up `PaymentTransaction` by `order_id` — reject `404` if not found
3. Update `status`, `gateway_transaction_id`, `gateway_response` (sanitised)
4. If `profile_id` present and `save_profile=true` was requested: upsert `PaymentProfile`
5. Update linked `TicketPurchase.payment_status` if applicable
6. Enqueue `generate_and_send_receipt` background task
7. Return `200` immediately

**Errors**:
- `400` — invalid HMAC signature
- `409` — `gateway_transaction_id` already processed (duplicate webhook — idempotent no-op, return `200`)

---

## GET /api/v1/payments/transactions/{transaction_id}

Retrieve a donor's own transaction (or any transaction for an admin).

**Auth**: Donor (own transactions only) or Admin

**Path params**: `transaction_id` (UUID)

**Response 200**:
```json
{
  "id": "uuid",
  "status": "captured",
  "transaction_type": "charge",
  "amount": 838.78,
  "currency": "USD",
  "line_items": [
    { "type": "ticket",       "label": "Gala Table for 8",       "amount": 800.00 },
    { "type": "extra_tip",    "label": "Extra Donation",          "amount": 5.00   },
    { "type": "fee_coverage", "label": "Processing Fee Coverage", "amount": 33.78  }
  ],
  "card_brand": "Visa",
  "card_last4": "4242",
  "created_at": "2026-03-10T02:01:40Z",
  "receipt_url": "/api/v1/payments/transactions/{id}/receipt"
}
```

**Errors**:
- `403` — donor requesting another donor's transaction
- `404` — transaction not found

---

## GET /api/v1/payments/transactions/{transaction_id}/receipt

Download the PDF receipt for a transaction.

**Auth**: Donor (own) or Admin

**Response 200**:
- `Content-Type: application/pdf`
- Body: PDF bytes (served from Azure Blob Storage redirect or streamed)

**Errors**:
- `404` — transaction or receipt not found
- `503` — PDF not yet generated (receipt generation pending)

---

## GET /api/v1/payments/profiles

List current donor's saved payment profiles for a given NPO.

**Auth**: Donor

**Query params**:
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `npo_id` | UUID | yes | which NPO's vault to list |

**Response 200**:
```json
{
  "profiles": [
    {
      "id": "uuid",
      "card_brand": "Visa",
      "card_last4": "4242",
      "card_expiry_month": 12,
      "card_expiry_year": 2028,
      "is_default": true,
      "billing_name": "Jane Smith"
    }
  ]
}
```

---

## POST /api/v1/payments/profiles

Save a new payment profile after completing the HPF "save card" flow. Called by the frontend
after receiving the HPF completion postMessage containing the Deluxe `profile_id` and card meta.

**Auth**: Donor

**Request**:
```json
{
  "npo_id": "uuid",
  "gateway_profile_id": "vault_xxx",
  "card_last4": "4242",
  "card_brand": "Visa",
  "card_expiry_month": 12,
  "card_expiry_year": 2028,
  "billing_name": "Jane Smith",
  "billing_zip": "94102",
  "set_as_default": true
}
```

**Response 201**:
```json
{
  "id": "uuid",
  "card_brand": "Visa",
  "card_last4": "4242",
  "card_expiry_month": 12,
  "card_expiry_year": 2028,
  "is_default": true
}
```

**Errors**:
- `409` — `gateway_profile_id` already exists for this user+NPO

---

## PATCH /api/v1/payments/profiles/{profile_id}

Set a profile as the default.

**Auth**: Donor (own profiles only)

**Request**:
```json
{ "is_default": true }
```

**Response 200**:
```json
{ "id": "uuid", "is_default": true }
```

---

## DELETE /api/v1/payments/profiles/{profile_id}

Remove a saved payment profile. Calls Deluxe vault DELETE before soft-deleting the DB record.

**Auth**: Donor (own profiles only)

**Response 200**:
```json
{
  "deleted": true,
  "warning": "You have an outstanding balance for one or more events and no remaining payment method. Contact the event organizer."
}
```
*(`warning` field is only present when: the profile being deleted was the donor's last saved method
for this NPO **and** they have an outstanding balance for any active event — FR-004)*

**Errors**:
- `404` — profile not found
- `503` — Deluxe vault deletion failed (do not soft-delete if gateway call fails)

---

## POST /api/v1/payments/checkout

End-of-night self-checkout. Aggregates all outstanding items for the donor + event, adds optional
tip and/or processing fee coverage, and charges the saved default card (or the specified profile).

**Auth**: Donor

**Request**:
```json
{
  "event_id": "uuid",
  "payment_profile_id": "uuid",
  "extra_tip_amount": 25.00,
  "cover_processing_fee": true,
  "idempotency_key": "uuid"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `event_id` | UUID | yes | |
| `payment_profile_id` | UUID | yes | must belong to the requesting donor |
| `extra_tip_amount` | Decimal | no | default 0.00; FR-015a |
| `cover_processing_fee` | bool | no | default true; FR-015b |
| `idempotency_key` | UUID string | yes | |

**Preconditions checked by server**:
1. `checkout_open = true` for the event (FR-016)
2. Outstanding balance > 0 (if 0, return a special zero-balance response)
3. `payment_profile_id` belongs to the requesting donor + this NPO
4. Profile is not expired or soft-deleted

**Response 200** (charge initiated):
```json
{
  "transaction_id": "uuid",
  "status": "captured",
  "amount_charged": 838.78,
  "line_items": [
    { "type": "auction_win",  "label": "Weekend Ski Getaway",        "amount": 350.00 },
    { "type": "donation",     "label": "Paddle Raise",               "amount": 100.00 },
    { "type": "extra_tip",    "label": "Extra Donation",             "amount": 25.00  },
    { "type": "fee_coverage", "label": "Processing Fee Coverage",    "amount": 33.78  }
  ],
  "receipt_pending": true
}
```

**Response 200** (zero balance — no charge):
```json
{
  "transaction_id": null,
  "status": "zero_balance",
  "amount_charged": 0.00,
  "line_items": []
}
```

**Errors**:
- `402` — card declined (gateway declined the charge)
- `403` — `payment_profile_id` does not belong to requesting donor
- `404` — event or profile not found
- `409` — idempotency key matches an existing captured transaction (cached response)
- `422` — checkout not open for this event
- `503` — gateway unavailable

---

## GET /api/v1/payments/checkout/balance

Preview the current outstanding balance for the authenticated donor at an event. Called by the
checkout page to build the itemized summary before the donor confirms payment.

**Auth**: Donor

**Query params**:
| Param | Type | Required |
|-------|------|----------|
| `event_id` | UUID | yes |

**Response 200**:
```json
{
  "event_id": "uuid",
  "checkout_open": true,
  "outstanding_items": [
    { "type": "auction_win",  "label": "Weekend Ski Getaway",  "amount": 350.00 },
    { "type": "donation",     "label": "Paddle Raise",          "amount": 100.00 }
  ],
  "subtotal": 450.00,
  "processing_fee_if_covered": 13.40,
  "already_paid": 800.00
}
```

---

## GET /api/v1/events/{event_slug}/ticket-packages

Public endpoint — no auth required (FR-006, FR-007). Lists enabled ticket packages for the event.

**Auth**: None

**Response 200**:
```json
{
  "event_id": "uuid",
  "event_name": "Annual Gala 2026",
  "ticket_packages": [
    {
      "id": "uuid",
      "name": "Individual Seat",
      "description": "One seat at the dinner table",
      "price": 150.00,
      "quantity_remaining": 42,
      "sold_out": false
    }
  ]
}
```

*(This endpoint may already be partially served by the existing ticket management API. If so, add
`quantity_remaining` and confirm public auth bypass.)*
