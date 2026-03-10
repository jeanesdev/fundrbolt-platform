# Tasks: Payment Processing (First American / Deluxe)

**Input**: Design documents from `.specify/specs/033-payment-processing/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Included — Phase 12 (T061–T070) covers unit tests for all payment services and integration tests for the full donor flow, admin charge/refund, and webhook polling fallback. Target: `--cov-fail-under=80` on all payment modules.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no incomplete dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2...)
- All file paths are repo-relative

---

## Phase 1: Setup

**Purpose**: Install new dependencies and create skeleton files / templates that everything else builds on.

- [ ] T001 Install `cryptography`, `weasyprint`, and `celery[redis]` backend dependencies in `backend/pyproject.toml` via `poetry add`
- [ ] T002 [P] Create receipt Jinja2 template skeleton files `backend/app/templates/receipts/receipt.html.j2` and `backend/app/templates/receipts/receipt_styles.css` (placeholder content, final content in Phase 7)
- [ ] T003 [P] Add all payment processing env vars to `backend/.env.example` (PAYMENT_GATEWAY_BACKEND, CREDENTIAL_ENCRYPTION_KEY, PAYMENT_PROCESSING_FEE_PCT, PAYMENT_PROCESSING_FEE_FLAT_CENTS, PAYMENT_WEBHOOK_TIMEOUT_MINUTES, PAYMENT_PENDING_EXPIRY_HOURS, RECEIPTS_BLOB_CONTAINER, STUB_HPF_BASE_URL, CELERY_BROKER_URL)
- [ ] T004 [P] Create `backend/app/services/payment_gateway/` subpackage with `__init__.py` exporting `PaymentGatewayPort`, `StubPaymentGateway`, `DeluxePaymentGateway`
- [ ] T004a [P] Create Celery application instance in `backend/app/core/celery_app.py` — configure broker URL from `CELERY_BROKER_URL` env var (defaults to Redis URL), result backend pointing to same Redis instance, `autodiscover_tasks` from `["app.tasks"]`; expose `celery_app` as importable singleton; register beat schedule entries for `expire_pending_transactions` (every 5 min) and `retry_failed_receipts` (every 10 min)

**Checkpoint**: Dependencies installed, skeleton files exist, Celery app configured — Phase 2 can start

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: DB models, Alembic migration, gateway abstraction, Pydantic schemas, and router skeletons that ALL user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Models (T005–T008 are fully parallel — different files)

- [ ] T005 [P] Create `PaymentGatewayCredential` SQLAlchemy model in `backend/app/models/payment_gateway_credential.py` — columns: id (UUID PK), npo_id (FK, UNIQUE), gateway_name, merchant_id_enc, api_key_enc, api_secret_enc, gateway_id, is_live_mode, is_active, created_at, updated_at (see data-model.md §1.1)
- [ ] T006 [P] Create `PaymentProfile` SQLAlchemy model in `backend/app/models/payment_profile.py` — columns: id, user_id (FK), npo_id (FK), gateway_profile_id, card_last4, card_brand, card_expiry_month, card_expiry_year, billing_name, billing_zip, is_default, deleted_at; UNIQUE(user_id, npo_id, gateway_profile_id) (see data-model.md §1.2)
- [ ] T007 [P] Create `PaymentTransaction` SQLAlchemy model with `TransactionType` and `TransactionStatus` enums in `backend/app/models/payment_transaction.py` — all columns including gateway_transaction_id (UNIQUE), idempotency_key (UNIQUE), line_items (JSONB), gateway_response (JSONB), initiated_by (FK→users), parent_transaction_id (self-FK), session_created_at, reason (see data-model.md §1.3)
- [ ] T008 [P] Create `PaymentReceipt` SQLAlchemy model in `backend/app/models/payment_receipt.py` — columns: id, transaction_id (FK, UNIQUE), pdf_url, pdf_generated_at, email_address, email_sent_at, email_attempts, created_at (no updated_at — append-only) (see data-model.md §1.4)
- [ ] T009 Register all 4 new models and `TransactionType`/`TransactionStatus` enums in `backend/app/models/__init__.py` imports + `__all__` list

### Migration

- [ ] T010 Write Alembic migration `backend/alembic/versions/[hash]_add_payment_processing_tables.py` — M1 payment_gateway_credentials table, M2 payment_profiles table + indexes, M3 payment_transactions table + indexes, M4 payment_receipts table + indexes, M5 payment_transaction_id FK on ticket_purchases, M6 checkout_open BOOLEAN on events, M7 partial indexes for pending poll + email retry (see data-model.md §3)

### Gateway Abstraction (T011 then T012/T013 in parallel)

- [ ] T011 Create `PaymentGatewayPort` ABC in `backend/app/services/payment_gateway/port.py` — abstract methods: `create_hosted_session()`, `charge_profile()`, `void_transaction()`, `refund_transaction()`, `verify_webhook_signature()`, `get_transaction_status()` with typed return dataclasses `HostedSessionResult` and `TransactionResult` (see research.md R-001, R-003, R-005)
- [ ] T012 [P] Implement `StubPaymentGateway` in `backend/app/services/payment_gateway/stub_gateway.py` — auto-approves all operations; `create_hosted_session()` returns stub token pointing to `/api/v1/payments/stub-hpf`; `charge_profile()` returns `approved`; `verify_webhook_signature()` always returns `True`; after simulating payment, asynchronously calls the webhook endpoint internally (see research.md R-001; docs/features/033-payment-processing.md Stub design)
- [ ] T013 [P] Create `DeluxePaymentGateway` skeleton in `backend/app/services/payment_gateway/deluxe_gateway.py` — all methods raise `NotImplementedError` with docstrings citing the Deluxe API docs from research.md R-001 through R-005; holds merchant credential fields in `__init__` for future implementation

### Cross-Cutting Utilities (all parallel — different files)

- [ ] T014 [P] Create Fernet encryption helper functions `encrypt_credential()` / `decrypt_credential()` in `backend/app/core/encryption.py` — reads `CREDENTIAL_ENCRYPTION_KEY` env var, uses `cryptography.fernet.Fernet` (see research.md R-009)
- [ ] T015 [P] Create all Pydantic v2 request/response schemas in `backend/app/schemas/payment.py` — `PaymentSessionRequest`, `PaymentSessionResponse`, `PaymentProfileCreate`, `PaymentProfileRead`, `CheckoutRequest`, `CheckoutResponse`, `CheckoutBalanceResponse`, `AdminChargeRequest`, `AdminChargeResponse`, `VoidRequest`, `RefundRequest`, `RefundResponse`, `CredentialCreate`, `CredentialRead` (masked), `CredentialTestResponse`, `LineItemSchema` (see contracts/ for all field definitions)
- [ ] T016 [P] Create gateway factory dependency in `backend/app/core/payment_deps.py` — reads `PAYMENT_GATEWAY_BACKEND` env var (`"stub"` or `"deluxe"`), returns the correct `PaymentGatewayPort` instance via FastAPI `Depends`; raises `RuntimeError` for unknown backends

### Router Skeletons (T017–T019 parallel — different files)

- [ ] T017 [P] Create donor payments router skeleton in `backend/app/api/v1/payments.py` — empty `APIRouter(prefix="/payments", tags=["payments"])`; no endpoints yet
- [ ] T018 [P] Create admin payments router skeleton in `backend/app/api/v1/admin_payments.py` — empty `APIRouter(prefix="/admin/payments", tags=["admin-payments"])`; no endpoints yet
- [ ] T019 [P] Create admin NPO credentials router skeleton in `backend/app/api/v1/admin_npo_credentials.py` — empty `APIRouter(prefix="/admin/npos", tags=["admin-npo-credentials"])`; no endpoints yet
- [ ] T020 Register `payments`, `admin_payments`, and `admin_npo_credentials` routers in `backend/app/api/v1/__init__.py` alongside existing routers

**Checkpoint**: Foundation complete — all user story phases can now proceed (in priority order or in parallel with separate developers)

---

## Phase 3: User Story 1 — NPO Configures Payment Account (Priority: P1) 🎯 MVP

**Goal**: A super admin can enter, update, delete, and test-connect Deluxe credentials for an NPO so the NPO is enabled for payment collection.

**Independent Test**: As super admin POST credentials, GET (confirm masked), POST /test (confirm success response), DELETE, GET (confirm `"configured": false`).

### Implementation for User Story 1

- [ ] T021 [US1] Implement `PaymentGatewayCredentialService` in `backend/app/services/payment_gateway_credential_service.py` — `create()`, `update()`, `delete()`, `get_masked()` (masks all but last 4 chars), `test_connection()` (calls `gateway.create_hosted_session()` with $0 amount to verify creds, returns success/failure)
- [ ] T022 [US1] Add GET `/admin/npos/{npo_id}/payment-credentials`, POST (create), PUT (replace), DELETE, and POST `.../test` endpoints to `backend/app/api/v1/admin_npo_credentials.py` — all guarded by `require_role(UserRole.SUPER_ADMIN)`; GET returns masked `CredentialRead`; credentials encrypted via T014 before storage (see contracts/npo-credentials.md)
- [ ] T023 [P] [US1] Create `NpoCredentialForm.tsx` admin component in `frontend/fundrbolt-admin/src/components/payments/NpoCredentialForm.tsx` — masked password inputs for merchant ID / API key / secret, live-mode toggle, "Test Connection" button that calls POST `.../test` and shows inline success/error (see contracts/npo-credentials.md Test endpoint)
- [ ] T024 [US1] Create admin NPO payment settings route in `frontend/fundrbolt-admin/src/routes/npos.$npoId.payment-settings.tsx` — fetches existing masked credentials, renders `NpoCredentialForm`, handles create/update/delete with optimistic UI

**Checkpoint**: Super admin can configure and validate NPO credentials end-to-end with stub gateway

---

## Phase 4: User Story 2 — Donor Sets Up a Payment Method (Priority: P1)

**Goal**: A registered donor can save their card through the Deluxe HPF iframe, view their saved cards (masked), set a default, and delete cards (with outstanding-balance warning if last card).

**Independent Test**: Log in as donor, POST `/payments/session` → open HPF URL → stub auto-approves → POST `/payments/profiles` with returned profile data → GET `/payments/profiles` confirms masked card appears → DELETE the profile.

### Implementation for User Story 2

- [ ] T025 [US2] Implement `PaymentProfileService` in `backend/app/services/payment_profile_service.py` — `list_profiles(user_id, npo_id)`, `create_profile()`, `set_default()` (transaction: clear existing default then set new), `soft_delete()` (calls gateway to delete vault before writing `deleted_at`; checks outstanding balance and returns warning flag per FR-004)
- [ ] T026 [US2] Implement `PaymentTransactionService.create_hosted_session()` in `backend/app/services/payment_transaction_service.py` — idempotency check on `idempotency_key`, create `PaymentTransaction(status=pending, session_created_at=now())`, call `gateway.create_hosted_session()`, return `PaymentSessionResponse`
- [ ] T027 [US2] Add profile CRUD endpoints + POST `/payments/session` + GET `/payments/stub-hpf` (simple auto-approve HTML page with fake postMessage dispatch) to `backend/app/api/v1/payments.py` — donor-auth guarded; DELETE returns 200 with optional `warning` field per FR-004 (see contracts/donor-payments.md profiles section)
- [ ] T028 [P] [US2] Create `HpfIframe.tsx` component in `frontend/donor-pwa/src/components/payments/HpfIframe.tsx` — renders iframe with `session_url`; listens for `postMessage` events validating `event.origin`; implements 30-second timeout → "Continue in browser" fallback button per research.md R-002; calls `onComplete(result)` prop
- [ ] T029 [P] [US2] Create `SavedCardList.tsx` component in `frontend/donor-pwa/src/components/payments/SavedCardList.tsx` — lists masked cards (brand + last4 + expiry), default star badge, expiry-warning for expired cards, delete button with inline "last card + balance warning" confirmation, "Add card" button
- [ ] T030 [P] [US2] Create typed payment API client module in `frontend/donor-pwa/src/api/payments.ts` — typed fetch helpers for all `/payments/*` endpoints matching `PaymentSessionResponse`, `PaymentProfileRead`, `CheckoutBalanceResponse`, `CheckoutResponse` shapes
- [ ] T031 [US2] Create payment methods settings route in `frontend/donor-pwa/src/routes/settings.payment-methods.tsx` — sections: "Your saved cards" (`SavedCardList`) and "Add a card" (`HpfIframe` in drawer/modal); wires postMessage → `POST /payments/profiles` to persist after HPF completion

**Checkpoint**: Donor can add, view, set-default, and delete a saved card end-to-end through stub HPF

---

## Phase 5: User Story 3 — Public Visitor Browses Ticket Prices (Priority: P2)

**Goal**: An anonymous visitor can view ticket packages (name, description, price, availability) without logging in and is redirected to register when they click "Buy Tickets", returning to the ticket page after auth.

**Independent Test**: `curl http://localhost:8000/api/v1/public/events/{slug}/ticket-packages` (no auth header) returns packages. Donor PWA ticket page renders without JWT cookie.

### Implementation for User Story 3

- [ ] T032 [US3] Add `GET /public/events/{event_slug}/ticket-packages` endpoint to `backend/app/api/v1/public/events.py` — no authentication required; returns enabled `TicketPackage` records for the event with `id`, `name`, `description`, `price`, `quantity_remaining` (calculated from `quantity_total - sold_count`), `sold_out` bool (FR-006, FR-007)
- [ ] T033 [US3] Create public ticket browse route in `frontend/donor-pwa/src/routes/events.$slug.tickets.tsx` — event header with name/date, ticket package cards with price + availability; "Buy Tickets" → redirect to `/register?redirect=...&package={id}` if not authenticated; "Sign in" link; "Tickets not available" empty state for events with no enabled packages (FR-006, FR-007, FR-008)

**Checkpoint**: Unauthenticated visitor sees ticket prices; clicking "Buy Tickets" redirects to registration

---

## Phase 6: User Story 4 — Registered Donor Purchases Tickets (Priority: P2)

**Goal**: A logged-in donor can select a ticket package, apply a promo code, pay using a saved card (or add one via HPF), and receive confirmation. Failed payments allow retry without duplicate charges.

**Independent Test**: Log in as donor, navigate to ticket checkout, pick a package, submit checkout with stub profile — confirm transaction status is `captured` and `TicketPurchase.payment_transaction_id` is set.

### Implementation for User Story 4

- [ ] T034 [US4] Implement `PaymentTransactionService.handle_webhook()` in `backend/app/services/payment_transaction_service.py` — verify HMAC signature (stub gateway always passes), look up `PaymentTransaction` by `order_id`, update `status` + `gateway_transaction_id` + `gateway_response`, upsert `PaymentProfile` if `profile_id` present, update linked `TicketPurchase.payment_status` + `payment_transaction_id`, enqueue receipt as Celery task via `generate_and_send_receipt.delay(str(transaction_id))` (FR-033; research.md R-003, R-007)
- [ ] T035 [US4] Add `POST /payments/webhook`, `GET /payments/transactions/{transaction_id}`, and `GET /payments/transactions/{transaction_id}/receipt` endpoints to `backend/app/api/v1/payments.py` — webhook is unauthenticated (HMAC-only); transaction GET is donor-own or admin; receipt GET proxies Azure Blob URL or streams PDF bytes (see contracts/donor-payments.md)
- [ ] T036 [P] [US4] Create `PaymentMethodSelector.tsx` component in `frontend/donor-pwa/src/components/payments/PaymentMethodSelector.tsx` — displays saved cards for the NPO (radio group), "Add a new card" option that opens `HpfIframe` in a drawer, selected profile ID is lifted to parent
- [ ] T037 [P] [US4] Create `CheckoutSummary.tsx` component in `frontend/donor-pwa/src/components/payments/CheckoutSummary.tsx` — itemized line items table, promo discount row (if applied), total row; receives `line_items[]` and `total` props; reusable for ticket checkout and end-of-night checkout
- [ ] T038 [US4] Create multi-step ticket checkout route in `frontend/donor-pwa/src/routes/events.$slug.tickets.checkout.tsx` — Step 1: package selection with promo code field (validates via existing `POST /promo-codes/validate`); Step 2: payment method (`PaymentMethodSelector`); Step 3: confirm with `CheckoutSummary`; calls `POST /payments/session` → opens `HpfIframe` for new card or calls `POST /payments/checkout` for saved profile; Step 4: success with receipt-email notice; handles card-declined retry path (FR-009–FR-013)

**Checkpoint**: Donor completes ticket purchase end-to-end with stub; `TicketPurchase.payment_transaction_id` is populated

---

## Phase 7: User Story 8 — Donor Receives PDF Receipt by Email (Priority: P2)

**Goal**: Every successful charge automatically generates a PDF receipt and emails it. If email fails, the receipt is accessible in-app via the donor's transaction history.

**Independent Test**: Trigger a stub checkout → confirm `PaymentReceipt` row exists with `pdf_url` set → GET `/payments/transactions/{id}/receipt` returns a PDF; simulate email failure by pointing to bad SMTP — confirm `email_sent_at` stays NULL but receipt is still accessible.

### Implementation for User Story 8

- [ ] T039 [US8] Complete receipt HTML + CSS in `backend/app/templates/receipts/receipt.html.j2` and `backend/app/templates/receipts/receipt_styles.css` — include: NPO logo (from blob URL), event name + date, donor name, itemized line items (each with label + amount), total paid, card brand + last4, transaction ID, timestamp, Fundrbolt footer; print-optimised CSS; Jinja2 template variables matching `PaymentTransaction.line_items` schema (FR-025)
- [ ] T040 [US8] Implement `ReceiptService` in `backend/app/services/receipt_service.py` — `generate_pdf(transaction) -> bytes` (renders HTML template, calls WeasyPrint in `asyncio.run_in_executor` per research.md R-006), `upload_to_blob(pdf_bytes, transaction_id) -> str` (uploads to `RECEIPTS_BLOB_CONTAINER`), `send_receipt_email(transaction, pdf_bytes)` (uses existing email service, attaches PDF; writes `email_sent_at` on success, increments `email_attempts` on failure); upserts `PaymentReceipt` row (FR-024, FR-027)
- [ ] T041 [US8] Define `generate_and_send_receipt` Celery task in `backend/app/tasks/payment_tasks.py` — `@celery_app.task(bind=True, max_retries=3)` wrapping `ReceiptService.generate_pdf()` + `upload_to_blob()` + `send_receipt_email()`; retry with exponential back-off on email failure; confirm T034 and T048's `.delay()` calls reference this task (FR-024, FR-027)
- [ ] T042 [US8] Create `ReceiptView.tsx` in-app receipt component in `frontend/donor-pwa/src/components/payments/ReceiptView.tsx` — shows transaction details inline (donor name, event, line items, total, masked card) when accessed via `GET /payments/transactions/{id}`; renders a download PDF button (FR-027)

**Checkpoint**: Every stub checkout produces a PDF in blob storage and a `PaymentReceipt` row; receipt is viewable in-app

---

## Phase 8: User Story 5 — Donor Completes End-of-Night Checkout (Priority: P3)

**Goal**: After the event closes, a donor sees their full outstanding balance (auction wins + donations + unpaid ticket balance), can add an optional tip and opt to cover the processing fee, and pays in one charge. Zero-balance donors see confirmation without a charge.

**Independent Test**: Seed donor with winning bids + donation + already-paid ticket → GET `/payments/checkout/balance` → confirm amounts match; POST `/payments/checkout` → confirm single captured transaction; confirm already-paid items excluded.

### Implementation for User Story 5

- [ ] T043 [US5] Implement `CheckoutService` in `backend/app/services/checkout_service.py` — `aggregate_balance(user_id, event_id) -> CheckoutBalanceResponse` (queries auction wins, quick-entry donations, unpaid ticket balances; deducts already-captured payments per FR-017); `compute_processing_fee(subtotal) -> Decimal` (uses env vars per research.md R-008); `charge(user_id, event_id, profile_id, tip, cover_fee) -> CheckoutResponse` (builds line_items with tip/fee entries, calls `PaymentTransactionService.charge_profile()`, handles zero-balance no-op per FR-015, FR-015a, FR-015b)
- [ ] T044 [US5] Add `GET /payments/checkout/balance` and `POST /payments/checkout` to `backend/app/api/v1/payments.py` — balance endpoint is GET + donor-auth; checkout endpoint validates `checkout_open=True` on event, idempotency key, profile ownership, returns zero-balance response when subtotal is 0 (see contracts/donor-payments.md)
- [ ] T045 [US5] Add `GET /admin/payments/checkout/status` and `PATCH /admin/payments/checkout/status` to `backend/app/api/v1/admin_payments.py` — reads/writes `events.checkout_open`; PATCH guarded by NPO Admin/Co-Admin role (FR-016)
- [ ] T046 [US5] Implement automatic checkout-open on event close — in the event status update path in `backend/app/api/v1/admin.py` (or `backend/app/services/event_service.py`), when `event.status` transitions to `"closed"`, set `event.checkout_open = True` and commit (FR-016)
- [ ] T047 [US5] Create end-of-night checkout route `frontend/donor-pwa/src/routes/events.$slug.checkout.tsx` — calls `GET /payments/checkout/balance`, renders `CheckoutSummary` with full item list; tip field (empty by default); processing-fee coverage checkbox (checked by default with fee amount shown); locked when `checkout_open=False`; zero-balance confirmation screen; `POST /payments/checkout` on confirm; receipt-sent confirmation on success (FR-014–FR-017)

**Checkpoint**: Donor completes self-checkout with tip + fee coverage; checkout is auto-opened on event close

---

## Phase 9: User Story 6 — Admin Charges a Donor on Their Behalf (Priority: P3)

**Goal**: NPO admins can view each donor's outstanding balance and charge their saved card manually — essential when donors leave without self-checking out. Donor receives a receipt. All actions are audit-logged with the admin's identity.

**Independent Test**: As NPO Admin, GET `/admin/payments/donors?event_id=...` → find donor with balance; POST `/admin/payments/charge` with their profile and reason → confirm captured transaction with `initiated_by` set; donor receives receipt.

### Implementation for User Story 6

- [ ] T048 [US6] Implement `PaymentTransactionService.charge_profile()` in `backend/app/services/payment_transaction_service.py` — accepts `initiated_by` (admin user ID) and `reason`, calls `gateway.charge_profile()`, creates `PaymentTransaction(initiated_by=..., reason=...)`, enqueues receipt task; idempotency-key check; balance-override flag support (FR-019, FR-020)
- [ ] T049 [US6] Add `GET /admin/payments/donors` (filterable donor list with balance + no-payment-method flag) and `POST /admin/payments/charge` (admin charge with mandatory reason + balance-override) to `backend/app/api/v1/admin_payments.py` — both guarded by NPO Admin/Co-Admin role; Staff role returns 403 (FR-018, FR-019, FR-020; see contracts/admin-payments.md)
- [ ] T050 [P] [US6] Create `DonorBalancePanel.tsx` component in `frontend/fundrbolt-admin/src/components/payments/DonorBalancePanel.tsx` — outstanding balance total, per-item breakdown, saved cards list, "Charge Saved Card" button that opens a confirm dialog with mandatory reason field, balance-override acknowledgment when amount exceeds balance
- [ ] T051 [US6] Extend the donor event profile admin view to include `DonorBalancePanel` — modify `frontend/fundrbolt-admin/src/routes/events.$eventId.donors.$donorId.tsx` (or add new sub-route) to show balance + charge capability for NPO Admin/Co-Admin roles

**Checkpoint**: Admin can view any donor's balance and trigger a charge; receipt is auto-sent; audit log entry has `initiated_by`

---

## Phase 10: User Story 7 — Admin Issues a Refund or Void (Priority: P4)

**Goal**: NPO admins can void an unsettled transaction or issue a full/partial refund on a settled one. The donor receives an updated receipt. All transactions are visible in an event-level payments dashboard.

**Independent Test**: Capture a stub transaction → as NPO Admin, POST `/admin/payments/{id}/refund` with partial amount → confirm child refund transaction created, donor receipt updated, original transaction `status` unchanged.

### Implementation for User Story 7

- [ ] T052 [US7] Implement `PaymentTransactionService.void_transaction()` and `refund_transaction()` in `backend/app/services/payment_transaction_service.py` — `void_transaction()`: calls `gateway.void_transaction()`, updates status to `voided`; `refund_transaction(amount)`: validates amount ≤ original, calls `gateway.refund_transaction()`, creates child `PaymentTransaction(transaction_type=refund, parent_transaction_id=..., status=refunded)`, enqueues receipt-update task (FR-021–FR-023, FR-026)
- [ ] T053 [US7] Add `POST /admin/payments/{transaction_id}/void` and `POST /admin/payments/{transaction_id}/refund` to `backend/app/api/v1/admin_payments.py` — both require reason field; void returns 409 if already settled; refund returns 422 if amount exceeds remaining; NPO Admin/Co-Admin only (FR-021–FR-023; contracts/admin-payments.md)
- [ ] T054 [US7] Add `GET /admin/payments/transactions` (paginated + filterable by event_id, user_id, status) to `backend/app/api/v1/admin_payments.py` — returns items with donor name, email, transaction type, status, amount, card masked, initiated_by_name, receipt link (contracts/admin-payments.md)
- [ ] T055 [P] [US7] Create `TransactionHistory.tsx` component in `frontend/fundrbolt-admin/src/components/payments/TransactionHistory.tsx` — paginated table of transactions; status badge (color-coded); "Void" button (shown for authorized status only); "Refund" button (shown for captured status) with partial-amount input; donor name + bidder number; receipt download link
- [ ] T056 [US7] Create event payments dashboard route in `frontend/fundrbolt-admin/src/routes/events.$eventId.payments.tsx` — summary header (total collected, total refunded, net); `TransactionHistory` component with event filter pre-applied; export to CSV button

**Checkpoint**: Admin can void and partially refund transactions; full payment history visible per event

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Background tasks, OpenAPI housekeeping, and validation.

- [ ] T057 [P] Add `expire_pending_transactions` Celery periodic task to `backend/app/tasks/payment_tasks.py` — `@celery_app.task` decorated function; queries `PaymentTransaction(status="pending", session_created_at < now - PAYMENT_WEBHOOK_TIMEOUT_MINUTES)`, calls `gateway.get_transaction_status()` per research.md R-005, updates status; marks `error` after `PAYMENT_PENDING_EXPIRY_HOURS`; beat schedule entry already registered in T004a (FR-034)
- [ ] T058 [P] Add `retry_failed_receipts` Celery periodic task to `backend/app/tasks/payment_tasks.py` — `@celery_app.task` decorated function; queries `PaymentReceipt(email_sent_at IS NULL, email_attempts < 3)`, calls `ReceiptService.send_receipt_email()`, increments `email_attempts` on failure; beat schedule entry already registered in T004a (FR-027)
- [ ] T059 [P] Add OpenAPI tag descriptors for `payments`, `admin-payments`, and `admin-npo-credentials` tags in `backend/app/main.py` `openapi_tags` list, matching the existing tag-description pattern
- [ ] T060 Run quickstart.md smoke validation — execute all `curl` commands from `.specify/specs/033-payment-processing/quickstart.md` §7 against local dev with stub gateway; confirm all responses match expected HTTP status codes and JSON shapes; fix any discrepancies

---

## Phase 12: Tests (Constitution §Testing Requirements)

**Purpose**: Unit and integration tests for all payment service classes to meet the 80%+ coverage gate mandated by the constitution. All tests mock external dependencies (gateway, email, blob storage).

**⚠️ REQUIRED**: CI (`pytest`) will fail without this phase. Do not merge to `main` before this phase is complete.

- [ ] T061 [P] Write unit tests for `PaymentGatewayCredentialService` in `backend/app/tests/services/test_payment_gateway_credential_service.py` — test `create()`, `update()`, `delete()`, `get_masked()` (confirm plaintext never returned), `test_connection()` success + failure; mock `StubPaymentGateway` and Fernet encryption; cover FR-028–FR-030
- [ ] T062 [P] Write unit tests for `PaymentProfileService` in `backend/app/tests/services/test_payment_profile_service.py` — test `list_profiles()`, `create_profile()`, `set_default()` (only one default per user+npo), `soft_delete()` with and without outstanding balance warning; mock gateway vault delete call; cover FR-001–FR-005
- [ ] T063 [P] Write unit tests for `PaymentTransactionService` in `backend/app/tests/services/test_payment_transaction_service.py` — test `create_hosted_session()` idempotency, `handle_webhook()` status transitions, `charge_profile()` with `initiated_by`, `void_transaction()`, `refund_transaction()` partial + full + exceeds-original validation; mock `StubPaymentGateway`; cover FR-013, FR-019–FR-023, FR-034
- [ ] T064 [P] Write unit tests for `CheckoutService` in `backend/app/tests/services/test_checkout_service.py` — test `aggregate_balance()` correctly excludes already-captured payments, `compute_processing_fee()` with both env var configs, `charge()` with tip + fee coverage, zero-balance no-op, balance-override flag; cover FR-014–FR-017, FR-015a, FR-015b
- [ ] T065 [P] Write unit tests for `ReceiptService` in `backend/app/tests/services/test_receipt_service.py` — test `generate_pdf()` produces non-empty bytes, `upload_to_blob()` with mocked Azure SDK, `send_receipt_email()` sets `email_sent_at` on success and increments `email_attempts` on failure; cover FR-024–FR-027
- [ ] T066 [P] Write unit tests for `encryption.py` helpers in `backend/app/tests/core/test_encryption.py` — test `encrypt_credential()` + `decrypt_credential()` round-trip, confirm ciphertext differs from plaintext, confirm different keys produce different outputs
- [ ] T067 Write integration tests for the full donor payment flow in `backend/app/tests/integration/test_payment_flow.py` — using `AsyncClient` + test DB: POST session → simulate webhook → confirm transaction `captured` + `PaymentReceipt` row created + Celery task enqueued (use `task_always_eager=True` in test config); cover SC-003, SC-004 double-submit idempotency
- [ ] T068 Write integration tests for admin charge + refund flow in `backend/app/tests/integration/test_admin_payment_flow.py` — POST `/admin/payments/charge` as NPO Admin → confirm `initiated_by` populated → POST `/admin/payments/{id}/refund` partial amount → confirm child refund transaction + receipt update; assert 403 for Staff role; cover FR-019–FR-022
- [ ] T069 Write integration tests for webhook polling fallback in `backend/app/tests/integration/test_payment_polling.py` — seed a `PaymentTransaction(status="pending", session_created_at=now - timeout_threshold)`, call `expire_pending_transactions()` directly, mock `gateway.get_transaction_status()` returning `captured` → confirm status updated; cover FR-034
- [ ] T070 [P] Run `cd backend && poetry run pytest --cov=app/services --cov=app/api/v1/payments.py --cov=app/api/v1/admin_payments.py --cov=app/api/v1/admin_npo_credentials.py --cov-fail-under=80 --cov-report=term-missing` and fix any gaps until the threshold passes

**Checkpoint**: All payment module tests pass, coverage ≥80% on payment services and routers

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **blocks all user story phases**
- **Phases 3–10 (User Stories)**: All depend on Phase 2; proceed in priority order or in parallel across developers
- **Phase 11 (Polish)**: Depends on all desired user story phases being functionally complete

### User Story Dependencies

| Story | Priority | Depends On | Can parallel with |
|-------|----------|-----------|-------------------|
| US1 — NPO credentials | P1 | Phase 2 | US2 |
| US2 — Donor payment method | P1 | Phase 2 | US1 |
| US3 — Public ticket browse | P2 | Phase 2 | US4, US8 |
| US4 — Ticket purchase | P2 | Phase 2, US2 for payment method | US3, US8 |
| US8 — PDF receipts | P2 | Phase 2, US4 (webhook handler exists) | US3 |
| US5 — End-of-night checkout | P3 | Phase 2, US2, US8 | US6 |
| US6 — Admin charge | P3 | Phase 2, US2, US8 | US5 |
| US7 — Refunds/voids | P4 | US4 or US6 (transaction must exist) | — |

### Within Each User Story

1. Backend models/services before API endpoints
2. API endpoints before frontend routes
3. Shared components (`[P]`) before the routes that use them
4. Core service logic before error-handling/edge-case polish

---

## Parallel Opportunities

### Phase 2 (Foundational)

```
# Launch all 4 models simultaneously:
T005 PaymentGatewayCredential model
T006 PaymentProfile model
T007 PaymentTransaction model
T008 PaymentReceipt model

# Then after T009 (register) + T010 (migration):
T011 PaymentGatewayPort ABC
↓
T012 StubPaymentGateway   (parallel with T013)
T013 DeluxePaymentGateway skeleton

# Simultaneously:
T014 encryption.py
T015 payment schemas
T016 gateway factory dependency

# Simultaneously:
T017 payments.py skeleton   T018 admin_payments.py skeleton   T019 admin_npo_credentials.py skeleton
```

### Phase 4 (US2 frontend)

```
T028 HpfIframe.tsx      T029 SavedCardList.tsx      T030 payments.ts API client
# All three parallel — different files, no dependencies on each other
# Then T031 (settings route) uses all three
```

### Phase 6 (US4 frontend)

```
T036 PaymentMethodSelector.tsx      T037 CheckoutSummary.tsx
# Both parallel — different files
# Then T038 (checkout route) uses both
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 — both P1)

1. Complete Phase 1 (Setup)
2. Complete Phase 2 (Foundational) — **this is the longest phase, start here**
3. Complete Phase 3 (US1) → super admin can configure NPO credentials
4. Complete Phase 4 (US2) → donor can save a card
5. **STOP and VALIDATE**: test credential entry + HPF card save end-to-end with stub
6. Demo/deploy stub-backed payment profile management

### Incremental Delivery

After MVP:
1. Add US3 + US4 + US8 (all P2) — ticket purchase with receipt
2. Add US5 + US6 (both P3) — end-of-night checkout + admin charge
3. Add US7 (P4) — refunds and voids

### Phase 6 Activation (Deluxe Live Integration)

Once Deluxe sandbox credentials arrive, implement `DeluxePaymentGateway` (T013 skeleton → real implementation), set `PAYMENT_GATEWAY_BACKEND=deluxe`, and run the test-connection flow. No other code changes needed — the gateway port pattern isolates the swap.

---

## Notes

- `[P]` tasks operate on different files with no incomplete dependencies in the same phase — safe to run concurrently
- `[Story]` labels enable traceability back to spec.md user stories
- Stub gateway makes every phase independently testable without real Deluxe credentials
- Commit after each phase checkpoint at minimum; consider committing each completed task
- Run `make check-commits` (pre-commit hooks + auto-format retry) before every commit
- Backend CI gates after any backend change: `ruff check .` → `ruff format --check .` → `mypy app --strict` → `pytest`
- Frontend CI gates after frontend changes: `pnpm lint` → `pnpm format:check` → `pnpm build`
