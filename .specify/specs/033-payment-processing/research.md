# Phase 0 Research: Payment Processing (First American / Deluxe)

**Branch**: `033-payment-processing` | **Date**: 2026-03-10

This document resolves all technical unknowns identified before Phase 1 design starts.

---

## R-001 — Deluxe / First American HPF API: Session Token Creation

**Question**: What exact call does the backend make to obtain a short-lived HPF session token, and what is its shape?

**Status**: ⚠ PARTIALLY KNOWN — Deluxe merchant account not yet active. Documented based on Deluxe developer portal references and analogous HPF processors; must be confirmed with real credentials.

**Findings**:

Deluxe's Hosted Payment Form flow uses a backend-to-gateway session creation call:

```
POST https://api.deluxe.com/v1/hosted-session
Authorization: Basic base64(merchant_id:api_key)
Content-Type: application/json

{
  "amount": "125.00",
  "currency": "USD",
  "order_id": "txn_<uuid>",           # our internal transaction ID
  "return_url": "https://app.fundrbolt.com/api/v1/payments/hpf-return",
  "webhook_url": "https://app.fundrbolt.com/api/v1/payments/webhook",
  "save_profile": true,               # request vault creation if donor chooses to save card
  "metadata": { "user_id": "...", "event_id": "..." }
}
```

Response:
```json
{
  "session_token": "hpf_abc123...",
  "session_url": "https://pay.deluxe.com/hosted-payment?token=hpf_abc123...",
  "expires_at": "2026-03-10T02:15:00Z"
}
```

The frontend embeds `session_url` in an iframe or opens it in a new tab/drawer. Tokens expire
after ~15 minutes (exact TTL to be confirmed with Deluxe).

**Action for Phase 6**: When sandbox credentials arrive, test this call in Deluxe sandbox and
update the `DeluxePaymentGateway.create_hosted_session()` implementation accordingly.

**Stub behaviour**: `StubPaymentGateway.create_hosted_session()` returns a locally-served fake URL
(`/api/v1/payments/stub-hpf?token=stub_xxx`) that renders a simple HTML form auto-approving on
submit.

---

## R-002 — HPF Completion Signal: postMessage vs. Redirect

**Question**: After the donor completes (or cancels) the HPF iframe, how does the parent window know?

**Status**: ⚠ VERIFY WITH DELUXE — two common patterns; both must be handled.

**Findings**:

Deluxe's HPF supports two completion signalling mechanisms:

1. **postMessage** (preferred for iframe embeds): The iframe posts a structured message to the
   parent window when the card entry form is submitted or cancelled.

   Expected message shape (industry-standard pattern; confirm exact field names with Deluxe):
   ```json
   {
     "type": "DELUXE_HPF_COMPLETE",
     "status": "success",              // "success" | "declined" | "cancelled"
     "transaction_id": "deluxe_txn_...",
     "profile_id": "vault_xxx",        // present when save_profile=true
     "last4": "4242",
     "brand": "Visa",
     "expiry_month": 12,
     "expiry_year": 2028
   }
   ```

2. **Redirect** (fallback for full-page / PWA contexts): Deluxe redirects to the `return_url`
   with query params `?status=success&transaction_id=...`.

**Implementation decision**: `HostedPaymentForm.tsx` handles `window.addEventListener('message',
...)` for the postMessage path and also watches for redirect navigation. Both paths call the same
`onComplete(result)` callback prop so the rest of the checkout flow is unaffected.

**Stub behaviour**: The stub HPF page posts a synthetic `DELUXE_HPF_COMPLETE` message when the
fake form is submitted.

---

## R-003 — Deluxe IPN / Webhook Payload and HMAC Signature Scheme

**Question**: What is the exact shape of the Deluxe webhook/IPN POST, and how is the signature computed?

**Status**: ⚠ VERIFY WITH DELUXE — documented here is the standard pattern.

**Findings**:

Deluxe posts a signed JSON payload to the `webhook_url` provided at session creation time:

```
POST /api/v1/payments/webhook
Content-Type: application/json
X-Deluxe-Signature: sha256=<hex-digest>
X-Deluxe-Timestamp: 1741564800

{
  "event_type": "transaction.completed",
  "transaction_id": "deluxe_txn_abc123",
  "status": "approved",              // "approved" | "declined" | "voided" | "refunded"
  "amount": "125.00",
  "currency": "USD",
  "order_id": "txn_<our-uuid>",      // maps back to our payment_transactions.id
  "profile_id": "vault_xxx",         // present when a profile was created/used
  "card_last4": "4242",
  "card_brand": "Visa",
  "auth_code": "ABC123",
  "metadata": { "user_id": "...", "event_id": "..." },
  "timestamp": "2026-03-10T02:01:40Z"
}
```

**Signature verification** (HMAC-SHA256):
```python
import hmac, hashlib

def verify_webhook_signature(payload: bytes, signature: str, secret: str) -> bool:
    expected = "sha256=" + hmac.new(
        secret.encode(), payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)  # timing-safe
```

The `DELUXE_WEBHOOK_SECRET` env var holds the HMAC key issued in the Deluxe dashboard.

**Idempotency**: `payment_transactions.gateway_transaction_id` has a UNIQUE DB constraint.
Duplicate webhook deliveries for the same `transaction_id` will silently no-op after the first
successful update.

---

## R-004 — Deluxe Vault / Profile API: Create, Retrieve, Delete

**Question**: How does the backend store, retrieve, and delete a saved card profile in the Deluxe vault?

**Status**: ⚠ VERIFY WITH DELUXE.

**Findings**:

When `save_profile=true` is requested in the session, Deluxe creates a vault profile automatically
and returns the `profile_id` in both the postMessage/redirect completion event and the webhook
payload. No separate "create profile" API call is needed for the initial card save via HPF.

Subsequent operations:

**Charge against saved profile**:
```
POST https://api.deluxe.com/v1/transactions
{
  "type": "charge",
  "profile_id": "vault_xxx",
  "amount": "250.00",
  "currency": "USD",
  "order_id": "txn_<uuid>",
  "merchant_id": "<npo-merchant-id>"
}
```

**Delete profile** (trigger on FR-004 card deletion; also on GDPR account deletion):
```
DELETE https://api.deluxe.com/v1/profiles/{profile_id}
Authorization: Basic base64(merchant_id:api_key)
```

**List profiles for a customer** (optional — FundrBolt keeps its own `payment_profiles` table, so
this call is only needed for reconciliation or audit):
```
GET https://api.deluxe.com/v1/profiles?customer_reference=user_{user_id}
```

---

## R-005 — Deluxe Transaction Status Polling API (Webhook Fallback)

**Question**: If the webhook/IPN is not received within the configured timeout, how do we poll for transaction status? (FR-034)

**Status**: ⚠ VERIFY WITH DELUXE.

**Findings**:

```
GET https://api.deluxe.com/v1/transactions/{gateway_transaction_id}
Authorization: Basic base64(merchant_id:api_key)
```

Response contains the same `status` field as the webhook payload. The polling loop:

1. `POST /payments/session` creates a `PaymentTransaction(status="pending")` with a
   `session_created_at` timestamp.
2. A background task (`expire_pending_sessions`) runs on a cron every 30 minutes.
3. For each `pending` transaction older than `PAYMENT_WEBHOOK_TIMEOUT_MINUTES` (default: 10),
   the task calls `gateway.get_transaction_status(gateway_transaction_id)` and updates the DB.
4. Transactions still `pending` after 2 hours are marked `error` and flagged for manual review.

**Configuration** (settable per environment):
```bash
PAYMENT_WEBHOOK_TIMEOUT_MINUTES=10      # wait before polling
PAYMENT_PENDING_EXPIRY_HOURS=2          # mark as error after this long
```

---

## R-006 — WeasyPrint PDF Generation in Async FastAPI

**Question**: WeasyPrint's `HTML.write_pdf()` is synchronous. How do we use it in an async FastAPI context without blocking the event loop?

**Status**: ✅ RESOLVED.

**Findings**:

Use `asyncio.get_event_loop().run_in_executor(None, fn)` (or `anyio.to_thread.run_sync`) to run
the synchronous WeasyPrint call in the default thread pool:

```python
import asyncio
from weasyprint import HTML

async def generate_pdf(html_content: str) -> bytes:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None,
        lambda: HTML(string=html_content).write_pdf()
    )
```

This keeps the async worker free while WeasyPrint renders. For receipt volume (at most a few
hundred per event), the thread pool default size is sufficient.

**WeasyPrint system dependencies on Azure App Service (Linux)**:
WeasyPrint requires `libpango`, `libcairo`, and `libgdk-pixbuf2.0` to be installed at the system
level. Add the following to the Docker image:
```dockerfile
RUN apt-get install -y libpango-1.0-0 libpangocairo-1.0-0 libcairo2 libgdk-pixbuf2.0-0 libffi-dev
```
Or, if using Azure App Service startup command rather than Docker, add a `startup.sh` that
installs these via `apt-get` on first run (less reliable — prefer Docker).

**Testing receipts offline**: Render to a temp file with `HTML(string=html).write_pdf(target='/tmp/receipt.pdf')` and inspect visually during development.

---

## R-007 — Idempotency Key Pattern for Payment API Calls

**Question**: How do we prevent duplicate charges from double-submit or retry scenarios? (SC-004)

**Status**: ✅ RESOLVED.

**Findings**:

Two-layer idempotency:

1. **Frontend**: Disable the "Pay" button immediately on first click, show a loading state; re-enable only on error response. This prevents accidental double-submit in the normal case.

2. **Backend (idempotency key header)**: The client generates a `UUID` per checkout attempt and
   sends it as `Idempotency-Key: <uuid>` on the `POST /payments/checkout` and
   `POST /payments/session` requests. The backend checks for an existing `PaymentTransaction` with
   `idempotency_key = <key>` and `status != pending`. If found, it returns the cached response
   without re-calling the gateway.

   ```sql
   -- Add to payment_transactions:
   idempotency_key  VARCHAR(64)  UNIQUE NULLABLE
   ```

3. **Webhook deduplication**: `gateway_transaction_id` UNIQUE constraint in DB; duplicate webhook
   events are silently ignored on `ON CONFLICT DO NOTHING`.

**Note**: The idempotency key column can be added as part of the main migration (M3).

---

## R-008 — Processing Fee Calculation (FR-015b)

**Question**: How is the processing fee amount calculated before confirming checkout?

**Status**: ✅ RESOLVED (business decision embedded in spec).

**Findings**:

The processing fee percentage varies by processor and card type. For the implementation:

- A configurable `PAYMENT_PROCESSING_FEE_PCT` env var (default `2.9`) and
  `PAYMENT_PROCESSING_FEE_FLAT_CENTS` (default `30`) mirror Stripe-style pass-through pricing as
  a reasonable default until Deluxe quotes actual rates.
- Formula: `fee = (subtotal × pct / 100) + flat_cents_in_dollars`
- The fee is shown to the donor before confirmation; if they leave the checkbox checked, it is
  added to the final charge amount.
- Both the subtotal and the fee coverage amount appear as separate `line_items` JSONB entries in
  `payment_transactions`.

```bash
PAYMENT_PROCESSING_FEE_PCT=2.9
PAYMENT_PROCESSING_FEE_FLAT_CENTS=30   # in cents
```

---

## R-009 — Per-NPO Credential Encryption Strategy

**Question**: How exactly are Deluxe credentials encrypted at rest? Azure Key Vault ref vs `pgcrypto`?

**Status**: ✅ RESOLVED.

**Findings**:

Use a **two-layer approach** that does not depend on Azure Key Vault being available locally:

1. A single **encryption key** (`CREDENTIAL_ENCRYPTION_KEY`) is stored as an Azure Key Vault
   secret in production; in dev/staging it is set as a plain env var.

2. At write time, the service encrypts `api_key`, `api_secret`, and `merchant_id` using
   AES-256-GCM via Python's `cryptography` library before storing them in the DB:

   ```python
   from cryptography.fernet import Fernet

   def encrypt_credential(value: str, key: bytes) -> str:
       return Fernet(key).encrypt(value.encode()).decode()

   def decrypt_credential(ciphertext: str, key: bytes) -> str:
       return Fernet(key).decrypt(ciphertext.encode()).decode()
   ```

3. The encrypted values are stored as `TEXT` in the DB. The plaintext is **never**:
   - Returned in any API response (GET returns masked versions only)
   - Written to any application log

**Key rotation**: Generate a new `CREDENTIAL_ENCRYPTION_KEY`, decrypt all existing credentials
with the old key and re-encrypt with the new key as a one-off migration script. Document in
`/docs/operations/` runbook.

---

## R-010 — Existing Codebase Integration Points

**Question**: Which existing models and services does this feature integrate with?

**Status**: ✅ RESOLVED (from codebase exploration).

**Findings**:

| Existing file | Integration |
|--------------|-------------|
| `backend/app/models/ticket_management.py` | `TicketPurchase` gets a new `payment_transaction_id UUID FK` column (migration M5); `PaymentStatus` enum already exists and will be reused |
| `backend/app/models/event.py` | `Event` gets a `checkout_open BOOLEAN DEFAULT FALSE` column (migration M6) |
| `backend/app/models/user.py` | `User` referenced via FK in `payment_profiles.user_id` and `payment_transactions.user_id` |
| `backend/app/models/npo.py` | `NPO` referenced via FK in `payment_gateway_credentials.npo_id` and `payment_profiles.npo_id` |
| `backend/app/services/event_registration_service.py` | `CheckoutService` calls into this to enumerate all auction wins / donations / ticket balances for a donor |
| `backend/app/api/v1/registrations.py` | No direct changes, but the checkout endpoint returns `payment_transaction_id` after charge |
| `frontend/donor-pwa/src/routes/events.$slug.register.tsx` | The post-registration redirect should chain into payment-method setup if no profile exists |

---

## R-011 — HPF iframe in Mobile PWA (iOS/Android WebView)

**Question**: Are there known issues with Deluxe HPF iframes in iOS/Android WebView contexts? (From design doc open items)

**Status**: ⚠ RISK — must be validated with Deluxe sandbox.

**Findings**:

Known general HPF-in-iframe issues in mobile WebViews:
- **Third-party cookies blocked** in iOS Safari 17+ and Chrome on Android — affects some HPF
  implementations that rely on cookies for session state. Deluxe may use URL-token only (no
  cookies), which avoids this.
- **iframe sizing** — some payment form iframes resize dynamically and can overflow or be
  clipped on small screens. Use `allow="payment"` and `sandbox="allow-scripts allow-same-origin
  allow-forms"` attributes.
- **postMessage origin validation** — `HostedPaymentForm.tsx` must validate `event.origin ===
  "https://pay.deluxe.com"` before processing any postMessage.

**Mitigation**: `HostedPaymentForm.tsx` implements a redirect fallback: if the iframe fails to
load (detected via `iframe.onerror` or 30-second timeout), the component offers a "Continue in
browser" button that opens the `session_url` in a new tab, completing via the `return_url`
redirect path instead of postMessage.

---

## R-012 — Receipt Email: Current Email Service Pattern

**Question**: How does the existing codebase send emails, and how should receipt email fit in?

**Status**: ✅ RESOLVED (from codebase exploration).

**Findings**:

The project uses **Azure Communication Services** (ACS) for transactional email, via a `EmailService`
or similar wrapper in `backend/app/services/`. Receipt emails follow the same pattern:

1. `ReceiptService.send_receipt_email(transaction, pdf_bytes)` constructs the email with:
   - Subject: `Your receipt from [NPO Name] — [Event Name]`
   - Body: HTML summary of the transaction
   - Attachment: the generated PDF (named `receipt-<transaction_id>.pdf`)
2. On email delivery failure, `payment_receipts.email_sent_at` remains `NULL` — FR-027 is
   satisfied because the PDF is already stored in Blob Storage and accessible via
   `GET /api/v1/payments/transactions/{id}/receipt`.
3. A background retry task retries failed email deliveries up to 3 times with exponential backoff.

---

## Summary of Technical Decisions

| Decision | Chosen Approach |
|----------|----------------|
| Gateway abstraction | `PaymentGatewayPort` ABC; `StubPaymentGateway` now, `DeluxePaymentGateway` Phase 6 |
| HPF signal | postMessage primary; redirect fallback for mobile/new-tab |
| Webhook dedup | UNIQUE `gateway_transaction_id` constraint; `ON CONFLICT DO NOTHING` |
| Pending resolution | Background cron polls after configurable timeout (default 10 min); error after 2 h |
| Credential encryption | Fernet (AES-128-CBC + HMAC) using `CREDENTIAL_ENCRYPTION_KEY` env var |
| PDF generation | WeasyPrint in thread pool executor; Docker image includes libpango/libcairo |
| Fee calculation | Configurable flat + percentage; shown to donor before confirm |
| Idempotency | `Idempotency-Key` header + DB unique constraint |
| Admin charge | NPO Admin + Co-Admin only; mandatory reason; full audit log |
| Partial refund | Arbitrary dollar amount (no line-item mapping) |
