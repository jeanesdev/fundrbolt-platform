# Payment Processing — First American / Deluxe Integration

**Feature ID**: 033-payment-processing
**Status**: 🔲 Planning
**Version**: 0.1
**Last Updated**: March 10, 2026

---

## Overview

Integrate First American / Deluxe Merchant Services into Fundrbolt to handle all payment flows:
ticket purchases, end-of-night auction/donation checkout, and admin-initiated charges. Deluxe
provides a **Hosted Payment Form (HPF)** that renders in an iframe so card data never touches our
servers — PCI scope is dramatically reduced.

This document covers everything that needs to be built, stub boundaries while Deluxe credentials
are still being set up, and the full target architecture once credentials are in hand.

---

## Payment Flows in Scope

| # | Flow | Actor | When |
|---|------|-------|------|
| 1 | **Ticket purchase — authenticated** | Registered donor | Before event: donor browses tickets, chooses package, pays |
| 2 | **Ticket browsing — public/unauthenticated** | Anonymous visitor | Any time: view prices, learn about event, nudge to register |
| 3 | **Payment profile setup** | Registered donor | After registration, before or at time of ticket purchase; also needed for end-of-night checkout |
| 4 | **End-of-night checkout** | Registered donor | After event ends: donor sees their auction wins + donations and pays the total |
| 5 | **Admin-initiated charge** | NPO Admin / Staff | Force a charge against a donor's saved profile (e.g. donor left without checking out) |
| 6 | **Refund / void** | NPO Admin / Staff | Full or partial refund, or void before settlement |
| 7 | **Receipt generation** | System (triggered by any paid transaction) | PDF generated and emailed automatically on successful charge |

---

## Deluxe / First American — Technical Overview

> **⚠ Stub note** — Deluxe Merchant Services requires an active merchant account and credentials
> (`merchant_id`, `api_key`, `api_secret`, and `gateway_id`) before live calls can be made. All
> service classes should be written against an abstract `PaymentGatewayPort` interface so the stub
> can be swapped for a real implementation once credentials arrive.

### Key Deluxe Concepts

| Concept | Description |
|---------|-------------|
| **Hosted Payment Form (HPF)** | An iframe-based form hosted on Deluxe's servers. Your backend gets a short-lived `session_token`; the frontend embeds `https://pay.deluxe.com/hosted-payment?token={session_token}`. Card data never arrives at your server. |
| **Payment Profile (Vault)** | A tokenized, stored card reference (`profile_id` / `customer_vault_id`). Created via HPF or direct API; used for future charges without re-entering card data. |
| **Transaction** | A single charge, authorization, void, or refund. Has a `transaction_id` and final `status` (approved / declined / voided / refunded). |
| **Webhook / IPN** | Deluxe posts a signed HTTP callback to your backend when a transaction completes. This is the authoritative completion signal. |
| **Merchant Account** | One per NPO (each NPO processes payments into their own bank account). Credentials must be stored per-NPO, encrypted at rest. |

### Deluxe HPF flow  (target)

```
Donor browser                 Fundrbolt backend              Deluxe Gateway
     │                              │                              │
     │  POST /payments/session      │                              │
     │ ─────────────────────────► │                              │
     │                              │  POST /hosted-session        │
     │                              │ ────────────────────────────►│
     │                              │◄──  { session_token }        │
     │◄─  { session_token }         │                              │
     │                              │                              │
     │  Render HPF iframe           │                              │
     │  (token in URL/param)        │                              │
     │ ─────────────────────────────────────────────────────────► │
     │◄─  (card form HTML served by Deluxe)                        │
     │                              │                              │
     │  Donor fills card, submits   │                              │
     │ ─────────────────────────────────────────────────────────► │
     │                              │  POST /ipn  (signed)         │
     │                              │◄────────────────────────────│
     │                              │  verify sig, update DB       │
     │◄─  HPF posts message/redirect│                              │
     │   (JS postMessage or redirect)                              │
     │   Fundrbolt shows result     │                              │
```

### Deluxe Stub  (while credentials are not yet available)

A `StubPaymentGateway` implementation returns fake `session_token` and `transaction_id` values,
and a fake webhook is posted to itself so the full backend flow still executes end-to-end in dev/staging.

---

## Component Inventory

### 1. Backend

#### 1.1 New Models

```
backend/app/models/
├── payment_gateway_credential.py   # Per-NPO encrypted Deluxe credentials
├── payment_profile.py              # Donor saved payment profile (vault token)
├── payment_transaction.py          # Every charge / refund record
└── payment_receipt.py              # Receipt metadata (PDF URL, email status)
```

**`payment_gateway_credential`** — one row per NPO

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `npo_id` | UUID FK → npos | unique |
| `gateway_name` | VARCHAR(50) | `"deluxe"` (extensible) |
| `merchant_id` | VARCHAR(100) | encrypted |
| `api_key` | VARCHAR(255) | encrypted via Azure Key Vault ref or `pgcrypto` |
| `api_secret` | VARCHAR(255) | encrypted |
| `gateway_id` | VARCHAR(100) | Deluxe gateway/terminal ID |
| `is_live_mode` | BOOLEAN | false = sandbox |
| `is_active` | BOOLEAN | |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

**`payment_profiles`** — one per donor per NPO (vault token allows future charges)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID FK → users | |
| `npo_id` | UUID FK → npos | Profiles are per-NPO (each NPO has own merchant account) |
| `gateway_profile_id` | VARCHAR(255) | Deluxe `customer_vault_id` |
| `card_last4` | CHAR(4) | Display only |
| `card_brand` | VARCHAR(20) | Visa / MC / Amex / Discover |
| `card_expiry_month` | SMALLINT | |
| `card_expiry_year` | SMALLINT | |
| `billing_name` | VARCHAR(200) | |
| `billing_zip` | VARCHAR(10) | |
| `is_default` | BOOLEAN | |
| `created_at` / `updated_at` | TIMESTAMPTZ | |
| **UNIQUE** (`user_id`, `npo_id`, `gateway_profile_id`) | | |

**`payment_transactions`** — every payment event

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `npo_id` | UUID FK → npos | |
| `event_id` | UUID FK → events | nullable (some charges may be NPO-level) |
| `user_id` | UUID FK → users | donor |
| `payment_profile_id` | UUID FK → payment_profiles | nullable — guest checkout or manual |
| `gateway_transaction_id` | VARCHAR(255) | Deluxe `transaction_id`; UNIQUE |
| `transaction_type` | ENUM | `charge`, `auth_only`, `capture`, `void`, `refund` |
| `status` | ENUM | `pending`, `authorized`, `captured`, `voided`, `refunded`, `declined`, `error` |
| `amount` | NUMERIC(12,2) | |
| `currency` | CHAR(3) | `USD` |
| `line_items` | JSONB | Breakdown: tickets, auction wins, donations |
| `gateway_response` | JSONB | Full raw response (sanitized, no CVV) |
| `initiated_by` | UUID FK → users | nullable — admin who triggered |
| `parent_transaction_id` | UUID FK → self | For refunds, points to original charge |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

> **Extends existing models**: `TicketPurchase.payment_status` will remain as-is. A `payment_transaction_id` FK will be added via migration to link a purchase to its Deluxe transaction.

**`payment_receipts`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `transaction_id` | UUID FK → payment_transactions | UNIQUE |
| `pdf_url` | VARCHAR(500) | Azure Blob Storage path |
| `pdf_generated_at` | TIMESTAMPTZ | |
| `email_sent_at` | TIMESTAMPTZ | nullable |
| `email_address` | VARCHAR(255) | |
| `created_at` | TIMESTAMPTZ | |

---

#### 1.2 Service Layer

```
backend/app/services/
├── payment_gateway/
│   ├── __init__.py
│   ├── port.py                  # Abstract PaymentGatewayPort (ABC)
│   ├── deluxe_gateway.py        # Real Deluxe HTTP client implementation
│   └── stub_gateway.py          # Dev/staging stub (no real network calls)
├── payment_profile_service.py   # Vault CRUD, default profile management
├── payment_transaction_service.py
│          create_session()         → calls gateway, returns HPF token
│          handle_webhook()         → verify sig, update transaction status
│          charge_profile()         → server-side charge against saved profile
│          void_transaction()
│          refund_transaction()
├── checkout_service.py          # End-of-night: aggregate auction wins +
│                                   donations + ticket balance → single charge
└── receipt_service.py           # PDF generation + email attachment dispatch
```

**`PaymentGatewayPort` (ABC)**

```python
class PaymentGatewayPort(ABC):
    async def create_hosted_session(
        self,
        amount: Decimal,
        currency: str,
        order_id: str,
        return_url: str,
        webhook_url: str,
        metadata: dict,
    ) -> HostedSessionResult: ...

    async def charge_profile(
        self,
        profile_id: str,
        amount: Decimal,
        currency: str,
        order_id: str,
        metadata: dict,
    ) -> TransactionResult: ...

    async def void_transaction(self, gateway_transaction_id: str) -> TransactionResult: ...

    async def refund_transaction(
        self, gateway_transaction_id: str, amount: Decimal
    ) -> TransactionResult: ...

    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool: ...
```

---

#### 1.3 API Endpoints (new router: `payment.py`)

```
POST   /api/v1/payments/session
       Body: { event_id, line_items[], return_url }
       Auth: donor
       → Creates PaymentTransaction(status=pending), calls gateway.create_hosted_session(),
         returns { session_token, hpf_url, transaction_id }

POST   /api/v1/payments/webhook          (no auth — HMAC-verified)
       Body: Deluxe IPN payload
       → Verify sig, update PaymentTransaction, update TicketPurchase payment_status,
         trigger receipt generation task

GET    /api/v1/payments/transactions/{transaction_id}
       Auth: donor (own) or admin
       → Transaction details + receipt URL

POST   /api/v1/payments/profiles         (internal use — called after HPF "save card" flow)
       Body: { gateway_profile_id, card_last4, card_brand, expiry_month, expiry_year, billing_name, billing_zip }
       Auth: donor
       → Stores PaymentProfile

GET    /api/v1/payments/profiles
       Auth: donor
       → List donor's saved profiles for an NPO

DELETE /api/v1/payments/profiles/{profile_id}
       Auth: donor
       → Remove saved profile

POST   /api/v1/payments/checkout         (end-of-night self-checkout)
       Body: { event_id, payment_profile_id, tip_amount? }
       Auth: donor
       → CheckoutService.aggregate_balance() → charge_profile()

# Admin endpoints (NPO Admin / Staff roles)
POST   /api/v1/admin/payments/charge     (admin-initiated charge)
       Body: { event_id, user_id, payment_profile_id, amount, reason }
       Auth: npo_admin

POST   /api/v1/admin/payments/{transaction_id}/void
       Auth: npo_admin

POST   /api/v1/admin/payments/{transaction_id}/refund
       Body: { amount }
       Auth: npo_admin

GET    /api/v1/admin/payments/transactions
       Query: event_id, user_id, status, page, per_page
       Auth: npo_admin

# NPO credential management (Super Admin only)
POST   /api/v1/admin/npos/{npo_id}/payment-credentials
PUT    /api/v1/admin/npos/{npo_id}/payment-credentials
GET    /api/v1/admin/npos/{npo_id}/payment-credentials    (masked)
DELETE /api/v1/admin/npos/{npo_id}/payment-credentials
```

---

#### 1.4 Background Tasks / Celery Workers

Currently the project uses FastAPI `BackgroundTasks` for email. Payment-related async work should follow the same pattern initially and migrate to Celery/ARQ if load demands it.

| Task | Trigger | Action |
|------|---------|--------|
| `generate_and_send_receipt` | Webhook completes a `charge` or `capture` | Generate PDF, upload to Blob, email donor |
| `retry_failed_webhook` | Webhook fails to process (DB error, etc.) | Re-queue with exponential backoff |
| `expire_pending_sessions` | Cron every 30 min | Mark `pending` transactions older than 2 hours → `error` |

---

#### 1.5 Receipt PDF Generation

Use **WeasyPrint** (pure Python, HTML → PDF) because it integrates cleanly with Jinja2 templates, which the project already uses for emails.

```
backend/app/
├── templates/
│   └── receipts/
│       ├── receipt.html.j2        # Receipt HTML template
│       └── receipt_styles.css     # Print-optimised CSS
└── services/
    └── receipt_service.py
        generate_pdf(transaction) → bytes
        upload_to_blob(pdf_bytes) → url
        send_receipt_email(transaction, pdf_bytes)
```

Receipt content:
- NPO name + logo
- Event name + date
- Donor name + email
- Itemized list (tickets, auction items won, donations, tip)
- Subtotal, processing fee (if passed through), total
- Payment method (card brand + last 4)
- Transaction ID + timestamp
- Fundrbolt footer

Add `WeasyPrint` to `pyproject.toml`:
```
weasyprint = "^62.0"
```

---

### 2. Frontend — Donor PWA

#### 2.1 Public / Unauthenticated Ticket Browsing Page

**Route**: `/events/:slug/tickets` (no auth required)

**Purpose**: Prospective attendees who haven't registered yet can browse ticket packages, see prices, and be funnelled into the registration flow.

**What it shows**:
- Event header (name, date, venue, hero image)
- Ticket package cards (name, description, price, seats)
- "Buy Tickets" CTA on each card → if not authenticated, redirect to `/register?redirect=/events/:slug/tickets/checkout&package=:packageId`
- "Already registered? Sign in" link
- Sponsors carousel (existing component)

**What it does NOT show**: Any payment form. It is purely informational.

**Backend needed**: `GET /api/v1/events/:slug/public-ticket-packages` (already mostly available via existing ticket endpoints — confirm public access)

---

#### 2.2 Ticket Purchase Page (Authenticated)

**Route**: `/events/:slug/tickets/checkout`

**Purpose**: Registered, logged-in donors select a package, apply a promo code, add a payment method (or use saved), and complete purchase.

**Flow (multi-step)**:

```
Step 1 — Select Package
   List of enabled TicketPackages for the event
   → Choose package + quantity
   → Apply promo code (optional)
   → Show price breakdown

Step 2 — Payment Method
   a) If donor has a saved PaymentProfile for this NPO's account:
      - Show saved cards, let them pick default or add new
   b) If no saved profile:
      - "Add payment method" → opens HPF modal/drawer

Step 3 — HPF (when adding new card)
   - Modal containing an <iframe> loaded with the Deluxe HPF session URL
   - Options: "Save this card for future use" checkbox
   - On HPF completion: postMessage from iframe → parent saves profile via API → continue

Step 4 — Confirm & Pay
   - Final price breakdown
   - "Pay $XX.XX" button
   - On confirm: POST /api/v1/payments/session → receive HPF token (if not saved profile)
     OR POST /api/v1/payments/checkout (if using saved profile)

Step 5 — Success
   - Confirmation message
   - Summary of what was purchased
   - "Receipt will be emailed to you"
   - "Register for event" CTA (if not yet registered)
```

**Components needed**:
```
frontend/donor-pwa/src/
├── routes/
│   ├── events.$slug.tickets.tsx            (public browse)
│   └── events.$slug.tickets.checkout.tsx   (authenticated purchase)
├── components/
│   ├── TicketPackageCard.tsx
│   ├── PromoCodeInput.tsx                  (reuse existing if any)
│   ├── PaymentMethodSelector.tsx           (list saved cards + add new)
│   ├── HostedPaymentForm.tsx               (iframe wrapper + postMessage handler)
│   ├── PaymentSummary.tsx                  (price breakdown)
│   └── CheckoutSuccess.tsx
└── lib/api/
    ├── payments.ts                          (API calls: sessions, profiles, checkout)
    └── tickets.ts                           (public ticket packages)
```

---

#### 2.3 Payment Profile Management Page

**Route**: `/settings/payment-methods`

Donor can:
- View saved cards (brand + last 4 + expiry)
- Set a default card
- Delete a card
- Add a new card (opens HPF)

---

#### 2.4 End-of-Night Checkout Page

**Route**: `/events/:slug/checkout`

Available only after event ends (or when coordinator opens checkout).

**What it shows**:
- "Your balance tonight" panel
- Itemized: auction wins (item names + amounts), paddle-raise, donations, ticket balance (if unpaid)
- Total amount due
- Select payment method (saved profiles)
- "Pay Now" CTA → POST /api/v1/payments/checkout
- If no saved profile: prompt to add card first (opens HPF)

**Access control**: Available from `event.status == "closed"` or a coordinator-flipped `checkout_open` flag (add this field to `events` table via migration, default `false`).

---

### 3. Frontend — Admin PWA

#### 3.1 NPO Payment Credentials Page

**Route**: `/settings/payment` (NPO context)
**Auth**: Super Admin only

Form to enter / update Deluxe credentials:
- Merchant ID
- API Key + API Secret (masked input, never shown in plaintext after save)
- Gateway ID
- Live mode toggle (sandbox vs production)
- Test Connection button (calls stub or live, depending on mode)

---

#### 3.2 Donor Payment Status Panel

**Route**: within `/events/:eventId/donors/:userId`

Shows for a single donor:
- Saved payment profiles (last4, brand)
- Payment history for this event (transaction list)
- "Charge Now" button (admin-initiated charge)
- Per-transaction: Void / Refund actions

---

#### 3.3 Event Payment Dashboard

**Route**: `/events/:eventId/payments`

- Summary: total collected, pending, failed tickets
- Filterable transaction list (export to CSV)
- Bulk actions: send checkout reminders, trigger outstanding charges

---

#### 3.4 Admin Donor Checkout (manual override)

Admins can select a donor's profile and trigger a charge for their outstanding balance, filling in a reason. This is the "end-of-night cleanup" flow for donors who left without paying.

---

## Database Migrations Required

| # | Description |
|---|-------------|
| M1 | Add `payment_gateway_credentials` table |
| M2 | Add `payment_profiles` table |
| M3 | Add `payment_transactions` table |
| M4 | Add `payment_receipts` table |
| M5 | Add `payment_transaction_id` FK column to `ticket_purchases` |
| M6 | Add `checkout_open` boolean column to `events` (default `false`) |
| M7 | Add index on `payment_transactions(user_id, event_id, status)` |

---

## Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Storing merchant credentials | Encrypt at rest: use Azure Key Vault for key encryption, or `pgcrypto` AES-256 column encryption. Never log credential values. |
| PCI scope | Deluxe HPF means card data never touches our servers. We handle only tokens. Maintain SAQ-A compliance. |
| Webhook authenticity | Verify HMAC-SHA256 signature on every IPN from Deluxe before processing. Use timing-safe comparison. |
| Idempotency | `gateway_transaction_id` has a UNIQUE constraint. Duplicate webhooks for the same transaction are ignored. |
| Admin charge abuse | Admin-initiated charges write audit log with `initiated_by` user ID. Charge reason is required. |
| GDPR | Payment profile deletion must cascade to Deluxe vault (call `delete_profile` on gateway). |

---

## Environment Variables / Config Required

```bash
# Per-NPO credentials are stored in DB (encrypted).
# These are service-level configuration values:

DELUXE_WEBHOOK_SECRET=<hmac-secret-from-deluxe-dashboard>
DELUXE_API_BASE_URL=https://api.deluxe.com/v1           # or sandbox URL
DELUXE_HPF_BASE_URL=https://pay.deluxe.com/hosted-payment
PAYMENT_GATEWAY_BACKEND=deluxe                          # or "stub"

# PDF receipts stored in Blob
RECEIPTS_BLOB_CONTAINER=receipts
```

---

## Stub / Offline Mode Design

Since Deluxe credentials are not yet active, everything should work with `PAYMENT_GATEWAY_BACKEND=stub`.

`StubPaymentGateway`:
- `create_hosted_session()` → returns a fake token, renders a fake local HPF page (simple form that auto-approves)
- `charge_profile()` → always returns `approved` with a random `gateway_transaction_id`
- `void_transaction()` / `refund_transaction()` → always succeeds
- `verify_webhook_signature()` → always returns `True` in stub mode
- After simulating a "payment", the stub calls `POST /api/v1/payments/webhook` internally with a fake payload so the whole backend pipeline (DB update, receipt generation) executes

---

## Implementation Phases

### Phase 1 — Foundation (Backend)
_Can be done immediately, no Deluxe credentials needed_

- [ ] Write `PaymentGatewayPort` ABC
- [ ] Implement `StubPaymentGateway`
- [ ] Add all 4 new DB models + Alembic migrations M1–M7
- [ ] Implement `PaymentProfileService`
- [ ] Implement `PaymentTransactionService` (session, webhook handler, charge)
- [ ] Implement `ReceiptService` (WeasyPrint PDF + Blob upload + email)
- [ ] Wire up API endpoints
- [ ] Unit tests with stub gateway

### Phase 2 — Frontend: Public Browsing + Profile Setup
_Unlocks ticket flow; no live Deluxe HPF yet_

- [ ] `/events/:slug/tickets` public browse page
- [ ] Payment method management page (`/settings/payment-methods`)
- [ ] `HostedPaymentForm` iframe component (pointed at stub HPF endpoint)
- [ ] Connect `PaymentMethodSelector` in checkout flow

### Phase 3 — Frontend: Ticket Checkout
_Full purchase flow using stub gateway_

- [ ] `TicketPackageCard`, `PromoCodeInput`, `PaymentSummary` components
- [ ] `/events/:slug/tickets/checkout` multi-step checkout page
- [ ] `CheckoutSuccess` with receipt email notification

### Phase 4 — Frontend: End-of-Night Checkout

- [ ] `/events/:slug/checkout` donor checkout page
- [ ] Admin manual charge panel
- [ ] Event payment dashboard

### Phase 5 — Admin Credential Management

- [ ] NPO payment credentials form (Super Admin)
- [ ] Test Connection feature

### Phase 6 — Real Deluxe Integration
_Requires active Deluxe merchant account_

- [ ] Implement `DeluxePaymentGateway` against real API
- [ ] Wire via `PAYMENT_GATEWAY_BACKEND=deluxe`
- [ ] Test in Deluxe sandbox
- [ ] Pen-test webhook endpoint
- [ ] Go live

---

## Key Questions / Open Items

1. **NPO per-merchant or shared merchant?** Does each NPO get their own Deluxe merchant account, or does Fundrbolt run a single merchant and distribute funds? This affects the credential model above (currently assumes per-NPO).

2. **Processing fee pass-through?** Are processing fees absorbed by the NPO or passed to the donor? Affects the `PaymentSummary` display and receipt line items.

3. **Checkout timing?** Can donors self-checkout during the event, or only after coordinator flips `checkout_open`? The `checkout_open` event flag handles this, but the UX decision needs confirmation.

4. **Auth-only vs. immediate capture?** Should ticket purchases be immediate captures, or authorize-and-capture-later (useful for hold scenarios)? Currently defaults to immediate capture.

5. **Deluxe HPF postMessage contract?** Once credentials arrive, verify exact postMessage event shape from the HPF iframe so `HostedPaymentForm.tsx` can handle it correctly.

6. **Mobile PWA and iframes?** Deluxe HPF in an iframe may have issues in some iOS/Android WebView configurations. Confirm with Deluxe whether a redirect-based flow is available as fallback.

---

## Dependencies to Add

**Backend**:
```toml
weasyprint = "^62.0"             # PDF generation
httpx = "*"                       # Already present — used for Deluxe API calls
```

**Frontend (donor-pwa)**:
No new dependencies expected — standard React patterns cover the checkout UI.

---

## File Map Summary

```
backend/app/
├── models/
│   ├── payment_gateway_credential.py   NEW
│   ├── payment_profile.py              NEW
│   ├── payment_transaction.py          NEW
│   └── payment_receipt.py              NEW
├── services/
│   ├── payment_gateway/
│   │   ├── port.py                     NEW
│   │   ├── deluxe_gateway.py           NEW (stub-only until Phase 6)
│   │   └── stub_gateway.py             NEW
│   ├── payment_profile_service.py      NEW
│   ├── payment_transaction_service.py  NEW
│   ├── checkout_service.py             NEW
│   └── receipt_service.py              NEW
├── api/v1/
│   └── payments.py                     NEW
├── templates/receipts/
│   ├── receipt.html.j2                 NEW
│   └── receipt_styles.css              NEW
└── tests/
    └── test_payments/
        ├── test_payment_service.py      NEW
        ├── test_checkout_service.py     NEW
        └── test_receipt_service.py      NEW

alembic/versions/
└── xxxx_add_payment_tables.py          NEW

frontend/donor-pwa/src/
├── routes/
│   ├── events.$slug.tickets.tsx               NEW
│   ├── events.$slug.tickets.checkout.tsx      NEW
│   ├── events.$slug.checkout.tsx              NEW
│   └── settings.payment-methods.tsx           NEW
├── components/
│   ├── TicketPackageCard.tsx                   NEW
│   ├── PromoCodeInput.tsx                      NEW
│   ├── PaymentMethodSelector.tsx               NEW
│   ├── HostedPaymentForm.tsx                   NEW
│   └── PaymentSummary.tsx                      NEW
└── lib/api/
    ├── payments.ts                             NEW
    └── tickets-public.ts                       NEW

frontend/fundrbolt-admin/src/
├── routes/
│   ├── npos.$npoId.payment-credentials.tsx    NEW
│   └── events.$eventId.payments.tsx           NEW
└── components/
    ├── DonorPaymentPanel.tsx                   NEW
    └── AdminChargeForm.tsx                     NEW
```
