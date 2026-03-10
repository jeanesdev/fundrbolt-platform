# Quickstart: Payment Processing (Stub Mode)

**Branch**: `033-payment-processing` | **Date**: 2026-03-10

This guide gets the full payment flow running locally using the **stub gateway** — no Deluxe
merchant account or real credentials are needed. All charges, voids, refunds, and webhooks are
simulated automatically.

---

## Prerequisites

- Docker running with `make docker-up` (PostgreSQL + Redis)
- Backend Python dependencies installed: `make install-backend`
- Frontend dependencies installed: `make install-frontend`
- Existing `.env` file in `backend/` (see `backend/.env.example`)

---

## Step 1 — Add Payment Env Vars to `backend/.env`

Append the following to your `backend/.env`:

```bash
# ── Payment Processing ──────────────────────────────────────────
# "stub" uses the built-in stub gateway (no real credentials needed)
# "deluxe" uses the real Deluxe/First American gateway (Phase 6+)
PAYMENT_GATEWAY_BACKEND=stub

# Encryption key for NPO payment credentials stored in the DB.
# Must be a 32-byte URL-safe base64 string.
# Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
CREDENTIAL_ENCRYPTION_KEY=your-generated-fernet-key-here

# Processing fee pass-through calculation (adjust to Deluxe's actual rates later)
PAYMENT_PROCESSING_FEE_PCT=2.9
PAYMENT_PROCESSING_FEE_FLAT_CENTS=30

# Webhook resolution:
# How long to wait (minutes) before polling if no webhook arrives
PAYMENT_WEBHOOK_TIMEOUT_MINUTES=10
# How long (hours) before a stuck "pending" transaction is marked "error"
PAYMENT_PENDING_EXPIRY_HOURS=2

# Azure Blob Storage container for receipt PDFs
# (Uses the existing AZURE_STORAGE_CONNECTION_STRING / AZURE_STORAGE_ACCOUNT_NAME)
RECEIPTS_BLOB_CONTAINER=receipts

# Stub gateway: base URL where the stub HPF page is served (backend itself)
# Leave as-is for local development
STUB_HPF_BASE_URL=http://localhost:8000
```

**Generate your Fernet key** (run once, save the output):
```bash
cd backend && poetry run python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

---

## Step 2 — Add `cryptography` to Backend Dependencies

```bash
cd backend && poetry add cryptography
```

*(WeasyPrint for PDF generation will be added separately once the receipt template is ready.)*

---

## Step 3 — Run the Database Migration

```bash
make migrate
# or: cd backend && poetry run alembic upgrade head
```

This applies the migration `add_payment_processing_tables` which creates:
- `payment_gateway_credentials`
- `payment_profiles`
- `payment_transactions`
- `payment_receipts`
- Adds `payment_transaction_id` to `ticket_purchases`
- Adds `checkout_open` to `events`

Verify:
```bash
cd backend && poetry run python -c "
from app.core.database import engine
from sqlalchemy import inspect
insp = inspect(engine.sync_engine)
tables = insp.get_table_names()
for t in ['payment_gateway_credentials','payment_profiles','payment_transactions','payment_receipts']:
    print(t, '✓' if t in tables else '✗ MISSING')
"
```

---

## Step 4 — Start the Backend

```bash
make dev-backend
# or: make b
```

The API is now available at `http://localhost:8000`.

---

## Step 5 — Verify the Stub Gateway

Open the OpenAPI docs at `http://localhost:8000/docs` and confirm the new payment endpoints are
listed under the `payments` and `admin/payments` tags.

Quick smoke-test via curl (replace `TOKEN` with a valid JWT obtained via `/api/v1/auth/login`):

```bash
# Check donor balance (should return 0.00 on fresh event)
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:8000/api/v1/payments/checkout/balance?event_id=UUID"
```

---

## Step 6 — Run the Backend Tests

```bash
cd backend && poetry run pytest app/tests/test_payments/ -v
```

Expected: all stub-gateway tests pass. Tests cover:
- `PaymentGatewayPort` interface contract
- `StubPaymentGateway` — session creation, charge, void, refund, webhook dispatch
- `PaymentProfileService` — CRUD, default toggle, soft-delete with warning
- `PaymentTransactionService` — idempotency, webhook handling, polling fallback
- `CheckoutService` — balance aggregation, zero-balance path, tip + fee calculation
- API endpoint auth guards (donor vs. admin vs. super-admin)

---

## Step 7 — Full End-to-End Flow (Stub)

The stub gateway auto-approves all charges. Here is the happy path to verify end-to-end:

### 7a — As Super Admin: configure "stub" credentials for your test NPO

```bash
# POST credentials (stub gateway ignores the actual values but requires the record to exist)
curl -X POST -H "Authorization: Bearer SUPERADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"gateway_name":"stub","merchant_id":"stub-mid","api_key":"stub-key","api_secret":"stub-secret"}' \
  http://localhost:8000/api/v1/admin/npos/NPO_UUID/payment-credentials

# Test connection (should return success:true)
curl -X POST -H "Authorization: Bearer SUPERADMIN_TOKEN" \
  http://localhost:8000/api/v1/admin/npos/NPO_UUID/payment-credentials/test
```

### 7b — As Donor: create a payment session (save card)

```bash
curl -X POST -H "Authorization: Bearer DONOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "EVENT_UUID",
    "line_items": [{"type":"ticket","label":"Test Ticket","amount":100.00}],
    "save_profile": true,
    "return_url": "http://localhost:5174/done",
    "idempotency_key": "550e8400-e29b-41d4-a716-446655440000"
  }' \
  http://localhost:8000/api/v1/payments/session
```

Response includes `hpf_url`. In stub mode this is a local URL that auto-approves and fires a
webhook back to the backend. The transaction status will transition `pending → captured` within
seconds.

### 7c — As Donor: check saved profiles

```bash
curl -H "Authorization: Bearer DONOR_TOKEN" \
  "http://localhost:8000/api/v1/payments/profiles?npo_id=NPO_UUID"
```

### 7d — As Donor: end-of-night checkout

```bash
curl -X POST -H "Authorization: Bearer DONOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "EVENT_UUID",
    "payment_profile_id": "PROFILE_UUID",
    "extra_tip_amount": 10.00,
    "cover_processing_fee": true,
    "idempotency_key": "650e8400-e29b-41d4-a716-446655440001"
  }' \
  http://localhost:8000/api/v1/payments/checkout
```

---

## Step 8 — Start the Frontend

```bash
make dev-frontend      # admin PWA at http://localhost:5173
make start-donor-pwa   # donor PWA at http://localhost:5174
```

Navigate to the donor PWA event page → "Checkout" to see the frontend checkout flow (requires the
HPF iframe component to be implemented in Phase 2).

---

## Switching to Real Deluxe (Phase 6)

When Deluxe sandbox credentials arrive:

1. Set `PAYMENT_GATEWAY_BACKEND=deluxe` in `backend/.env`
2. Update NPO credentials via the admin API or UI (enter real `merchant_id`, `api_key`, etc.)
3. Configure the Deluxe dashboard to send webhooks to:
   - Local: use ngrok — `./scripts/ngrok-backend.sh` then set URL in Deluxe dashboard
   - Staging/Prod: `https://api.fundrbolt.com/api/v1/payments/webhook`
4. Set `DELUXE_WEBHOOK_SECRET` to the HMAC secret from the Deluxe dashboard
5. Run the Test Connection step in the admin UI to verify

```bash
# Extra env vars needed for Deluxe mode:
DELUXE_API_BASE_URL=https://api.demo.deluxe.com/v1    # sandbox
DELUXE_HPF_BASE_URL=https://pay.demo.deluxe.com/hosted-payment
DELUXE_WEBHOOK_SECRET=your-webhook-secret-from-deluxe-dashboard
```

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `422 NPO has no active payment credentials` | Stub credentials not created | Run Step 7a |
| Migration fails with "relation already exists" | Partial migration applied | `alembic downgrade -1` then `upgrade head` |
| `500 CREDENTIAL_ENCRYPTION_KEY not set` | Missing env var | Add to `backend/.env` (Step 1) |
| Transaction stuck in `pending` | Stub webhook did not fire | Check backend logs for `generate_stub_webhook` errors |
| PDF receipt missing after charge | `AZURE_STORAGE_CONNECTION_STRING` not set or `receipts` container not created | Create the blob container or check Azure Storage config |
| `WeasyPrint: libpango not found` | Missing system libs | In Docker: rebuild image with `apt-get install -y libpango-1.0-0 libpangocairo-1.0-0 libcairo2` |
