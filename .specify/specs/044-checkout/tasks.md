# Tasks: 044-checkout — Donor Event Checkout

**Branch**: `044-checkout` | **Generated**: 2026-05-05
**Total tasks**: 69 | **Phases**: 8

---

## Dependency Graph

```
Phase 1 (Setup) → Phase 2 (Foundation) → Phase 3 (US1 Donor Checkout)
                                        → Phase 4 (US2 Admin Opens Checkout)
                                        → Phase 5 (US3 Admin Monitor/Items)  [needs Phase 4]
                                        → Phase 6 (US4 Send Checkout Link)   [needs Phase 4]
                                        → Phase 7 (US5 Donor Contact Admin)
                                        → Phase 8 (Polish)
```

---

## Phase 1: Setup

*Database migration, new model files, schema files, Celery task file.*

- [x] T001 Create Alembic migration `backend/alembic/versions/xxxx_add_checkout_tables.py` — add 4 enums + tables: `processing_fee_configs`, `checkout_configurations`, `checkout_sessions`, `checkout_items`, `checkout_audit_logs`; seed `processing_fee_configs` row with rate=0.0290; `checkout_sessions.cover_processing_fee` column default=TRUE (FR-003); `checkout_item_source_type_enum` MUST include `revenue_generator` value (C9 remediation)
- [x] T002 [P] Create `ProcessingFeeConfig` SQLAlchemy model in `backend/app/models/processing_fee_config.py`
- [x] T003 [P] Create `CheckoutConfiguration` SQLAlchemy model in `backend/app/models/checkout_configuration.py`
- [x] T004 [P] Create `CheckoutSession`, `CheckoutItem`, `CheckoutAuditLog` SQLAlchemy models + enums in `backend/app/models/checkout_session.py`; `CheckoutSession.cover_processing_fee` column default=True; `checkout_item_source_type_enum` must include `'revenue_generator'` value alongside `auction_win`, `quick_entry_bid`, `quick_entry_donation`, `ticket`, `manual`
- [x] T005 [P] Create all checkout Pydantic schemas in `backend/app/schemas/checkout.py` — `CheckoutSessionResponse`, `CheckoutItemResponse`, `CheckoutBalanceResponse`, `CheckoutConfirmRequest`, `CheckoutConfirmResponse`, `CheckoutConfigurationResponse`, `DonorCheckoutStatusEntry`, `DonorCheckoutStatusListResponse`, `AdminAddCheckoutItemRequest`, `AdminRepriceItemRequest`, `SendCheckoutNotificationRequest`, `ProcessingFeeConfigResponse`, `ContactAdminRequest`
- [x] T006 [P] Create Celery task file `backend/app/tasks/checkout_tasks.py` with `auto_open_checkout_task` task stub (no-op body initially; mirrors `run_of_show_tasks.py` pattern)
- [x] T007 Add `weasyprint>=61.0` to `backend/pyproject.toml` and run `cd backend && poetry lock && poetry install`
- [x] T008 [P] Create donor-pwa checkout API client module `frontend/donor-pwa/src/lib/api/checkout.ts` with typed functions: `getCheckoutSession`, `updateCheckoutSession`, `confirmCheckout`, `downloadCheckoutReceipt`, `contactAdmin`, `getCheckoutStatus`
- [x] T009 [P] Create admin-pwa checkout API client module `frontend/fundrbolt-admin/src/lib/api/checkout.ts` with typed functions: `getCheckoutConfiguration`, `updateCheckoutConfiguration`, `openCheckout`, `closeCheckout`, `scheduleCheckoutOpen`, `cancelScheduledOpen`, `listDonorCheckoutStatus`, `getDonorCheckoutSession`, `addCheckoutItem`, `repriceCheckoutItem`, `removeCheckoutItem`, `sendCheckoutLink`, `sendCheckoutReminder`, `downloadDonorReceipt`, `adminResendReceipt`
- [x] T010 [P] Create Zustand checkout persistence store `frontend/donor-pwa/src/stores/checkout-store.ts` — persists `paymentMethod`, `auctioneerTipCents`, `platformTipCents`, `coverProcessingFee`, `acknowledgedItemsUpdatedAt` to localStorage

---

## Phase 2: Foundational Services

*Core services blocking all user stories.*

- [x] T011 Implement `CheckoutConfigurationService` in `backend/app/services/checkout_configuration_service.py` — methods: `get_or_create(event_id)`, `open_checkout(event_id)` (snapshots processing fee rate at open time; GUARD: if `config.processing_fee_rate is not None` skip snapshotting — prevents double-snapshot on re-open; C13 remediation), `close_checkout(event_id)`, `schedule_open(event_id, dt)` (calls `apply_async(eta=dt)`, stores `celery_task_id`), `cancel_schedule(event_id)` (revokes Celery task), `update_configuration(event_id, data)`
- [x] T012 Implement `ProcessingFeeConfigService` in `backend/app/services/processing_fee_config_service.py` — methods: `get_current_rate() -> Decimal`, `set_rate(rate, admin_user_id)`, `get_history(page, per_page)`
- [x] T013 Extend `CheckoutService` in `backend/app/services/checkout_service.py` — add `get_or_create_session(user_id, event_id)`, `update_session(session_id, data)`, `build_checkout_items_from_balance(session)` (populates checkout_items from aggregated balance — include `revenue_generator_entries` with source_type=`revenue_generator` alongside existing auction_wins, quick_entry_bids, quick_entry_donations, tickets; C9 remediation), `recalculate_totals(session)` (subtotal / fee / total; use cover_processing_fee=True default per FR-003), `confirm_checkout(session_id, request)` (stub payment, set status=complete, set completed_at)
- [x] T014 Implement admin item management methods on `CheckoutService`: `admin_add_item(session_id, admin_user_id, data)`, `admin_reprice_item(session_id, item_id, admin_user_id, new_amount)`, `admin_remove_item(session_id, item_id, admin_user_id)` — each writes `checkout_audit_logs` row + sets `session.items_updated_at = now()`
- [x] T015 Complete `auto_open_checkout_task` Celery body in `backend/app/tasks/checkout_tasks.py` — calls `CheckoutConfigurationService.open_checkout(event_id)` via `_run_async` pattern

---

## Phase 3: US1 — Donor Checkout Page (P1)

*Story goal*: Donor reviews items, adds tips, selects payment method, double-swipes to confirm, receives receipt.
*Independent test*: Donor logs in, opens checkout, completes payment, checks email inbox.

- [x] T016 [US1] Build `SwipeToConfirm` component in `frontend/donor-pwa/src/components/checkout/SwipeToConfirm.tsx` — extracts slider core from `BidConfirmSlide.tsx`, props: `label`, `onComplete`, `disabled`, `completed`; uses Radix `Slider` with `opacity-0` overlay (same pattern as `BidConfirmSlide`)
- [x] T017 [P] [US1] Build `CheckoutTipSection` component in `frontend/donor-pwa/src/components/checkout/CheckoutTipSection.tsx` — preset tier buttons ($20/$50/$100 or $5/$10/$25), custom option opens WheelPicker (reuse `@ncdai/react-wheel-picker` pattern from `DonationAmountSelector.tsx`); visually matches Donate Now page tip UI
- [x] T018 [P] [US1] Build `CheckoutPaymentMethods` component in `frontend/donor-pwa/src/components/checkout/CheckoutPaymentMethods.tsx` — radio group with icons for Card/Cash/Check/DAF; when Cash/Check/DAF selected shows `BoothInstructionsCard` with `cash_instructions` text; when Card selected shows `CardSelector`
- [x] T019 [P] [US1] Build `CheckoutReceiptView` component in `frontend/donor-pwa/src/components/checkout/CheckoutReceiptView.tsx` — read-only post-completion view: itemised charges, tips, payment method, total paid, download receipt button; no swipe UI
- [x] T020 [P] [US1] Build `CheckoutUpdateBanner` component in `frontend/donor-pwa/src/components/checkout/CheckoutUpdateBanner.tsx` — sticky top banner "Your items were updated by the organizer. Please review before confirming."; dismiss button calls `onAcknowledge()`; also implement IntersectionObserver scroll-past detection so `onAcknowledge()` fires automatically when the banner scrolls fully out of view (FR-017a — "scrolled past OR dismissed")
- [x] T021 [US1] Implement 10-second polling in checkout page for `items_updated_at` change detection — add `refetchInterval: 10_000` to `useQuery(['checkout-session', eventId])` in `frontend/donor-pwa/src/routes/events.$slug.checkout.tsx`; compare with `acknowledgedItemsUpdatedAt` from store; show `CheckoutUpdateBanner` and disable swipe when changed
- [x] T022 [US1] Wire double-swipe flow in `frontend/donor-pwa/src/routes/events.$slug.checkout.tsx` — state machine `confirmStage: 'idle' | 'first' | 'second' | 'submitted'`; first `SwipeToConfirm` completion sets stage='second'; second completion calls `confirmCheckout()`; both swipes disabled if `showUpdateBanner=true`
- [x] T023 [US1] Integrate tip sections into checkout page in `frontend/donor-pwa/src/routes/events.$slug.checkout.tsx` — render two `CheckoutTipSection` components (auctioneer: presets $20/$50/$100, default $50; FundrBolt: presets $5/$10/$25, default $0); on change call `PATCH /checkout/session` and update totals display
- [x] T024 [US1] Integrate `CheckoutPaymentMethods` into checkout page in `frontend/donor-pwa/src/routes/events.$slug.checkout.tsx` — on method change call `PATCH /checkout/session`; remove processing fee from total when Cash/Check/DAF; when Card selected: show `PaymentMethodSelector` component AND an explicit "View / Change Card" flow (card last-4 + expiry displayed with a "Change" button that opens `SavedCardList` selector, then allows adding a new card via HPF); FR-008, FR-011
- [x] T025 [US1] Add state persistence to checkout page — on mount restore `paymentMethod`, `auctioneerTipCents`, `platformTipCents`, `coverProcessingFee` from `checkout-store.ts`; save on each change
- [x] T026 [US1] Add post-completion read-only mode to checkout page — when `session.status === 'complete'` render `CheckoutReceiptView`; hide all tip/payment/swipe UI; FR-001a
- [x] T027 [US1] Wire `GET /api/v1/events/{event_id}/checkout/session` in backend `backend/app/api/v1/payments.py` — add endpoint `GET /events/{event_id}/checkout/session`; calls `CheckoutService.get_or_create_session()`
- [x] T028 [US1] Wire `PATCH /api/v1/events/{event_id}/checkout/session` in backend `backend/app/api/v1/payments.py` — update session fields; recalculate totals; return updated session
- [x] T029 [US1] Wire `POST /api/v1/events/{event_id}/checkout/confirm` in backend `backend/app/api/v1/payments.py` — validate `acknowledged_items_updated_at` matches session; stub payment; set status=complete; trigger receipt generation task; return `CheckoutConfirmResponse`
- [x] T030 [US1] Wire `GET /api/v1/events/{event_id}/checkout/receipt` in backend `backend/app/api/v1/payments.py` — stream PDF from `receipt_url` Blob or generate on-demand; return `application/pdf`
- [x] T031 [US1] Implement PDF receipt generation in `backend/app/services/receipt_service.py` — Jinja2 HTML template with event logo, event name, donor name, itemised table, tips, total paid; WeasyPrint renders to bytes; upload to Azure Blob; return URL; called after checkout confirmation
- [x] T032 [P] [US1] Create receipt Jinja2 HTML template `backend/app/templates/receipt.html` — event logo in header, event details, itemised table (name + amount), auctioneer tip, FundrBolt tip, processing fee (if card), total paid, footer with receipt ID + date
- [x] T033 [US1] Send confirmation email with PDF receipt in `backend/app/services/checkout_service.py` — after confirm: send email to donor with event logo, event details, and PDF receipt as attachment (FR-014)

---

## Phase 4: US2 — Admin Opens and Controls Checkout (P1)

*Story goal*: Admin manually opens checkout or schedules auto-open; donors see checkout card.
*Independent test*: Admin opens checkout; donor My Event page shows checkout summary card.

- [x] T034 [US2] Add checkout control API endpoints to `backend/app/api/v1/admin_payments.py` — `POST /admin/events/{event_id}/checkout/open`, `POST /admin/events/{event_id}/checkout/close`, `POST /admin/events/{event_id}/checkout/schedule`, `DELETE /admin/events/{event_id}/checkout/schedule`; require NPO Admin role
- [x] T035 [US2] Add `GET /admin/events/{event_id}/checkout/configuration` and `PATCH /admin/events/{event_id}/checkout/configuration` endpoints to `backend/app/api/v1/admin_payments.py` — returns/updates cash_instructions, donor_visible
- [x] T036 [US2] Build `CheckoutControlPanel` component in `frontend/fundrbolt-admin/src/features/events/checkout/CheckoutControlPanel.tsx` — shows current `is_open` status; "Open Checkout" button; "Schedule Auto-Open" datetime picker; "Close Checkout" button; cash instructions textarea; uses `useMutation` for open/close/schedule actions
- [x] T037 [US2] Add Checkout tab/section to `frontend/fundrbolt-admin/src/features/events/EventEditPage.tsx` — renders `CheckoutControlPanel` component; accessible from event management screen (SC-004)
- [x] T038 [US2] Build checkout summary card `frontend/donor-pwa/src/components/payments/CheckoutSummaryCard.tsx` — shows estimated total, status badge, "Review & Pay" link; empty state variant ("You have no items to check out"); post-complete variant ("Checkout Complete" + receipt download link); FR-018, FR-018a, FR-019, FR-020
- [x] T039 [US2] Inject `CheckoutSummaryCard` into My Event page (donor-pwa) — in `frontend/donor-pwa/src/routes/events.$slug._index.tsx` (or equivalent My Event route); render card at bottom when `checkout_configuration.donor_visible = true`; 10 s polling to detect open state change; FR-018, FR-023
- [x] T040 [US2] Add `GET /api/v1/events/{event_id}/checkout/status` endpoint to `backend/app/api/v1/payments.py` — returns `checkout_open`, `donor_visible`, `scheduled_open_at`, `session_status`; used by donor My Event page polling

---

## Phase 5: US3 — Admin Monitors Checkout Status and Manages Items (P1)

*Needs Phase 4 complete.*
*Story goal*: Admin sees per-donor status list; can add/remove/reprice items; changes reflected in donor view within 10 s.
*Independent test*: Admin reprices item; donor sees updated total within 10 s.

- [x] T041 [US3] Add donor status list endpoint `GET /admin/events/{event_id}/checkout/donors` to `backend/app/api/v1/admin_payments.py` — paginated, filter by status; LEFT JOIN registered donors with their sessions; return `DonorCheckoutStatusListResponse`; optimised for 200+ donors (SC query with index on `checkout_sessions(event_id, status)`)
- [x] T042 [US3] Add donor session detail endpoint `GET /admin/events/{event_id}/checkout/donors/{user_id}/session` to `backend/app/api/v1/admin_payments.py` — returns `AdminCheckoutSessionResponse` with full item list
- [x] T043 [US3] Add item management endpoints to `backend/app/api/v1/admin_payments.py` — `POST /admin/events/{event_id}/checkout/donors/{user_id}/items`, `PATCH /admin/events/{event_id}/checkout/donors/{user_id}/items/{item_id}`, `DELETE /admin/events/{event_id}/checkout/donors/{user_id}/items/{item_id}`; calls service methods from T014
- [x] T044 [US3] Build `DonorCheckoutDashboard` component in `frontend/fundrbolt-admin/src/features/events/checkout/DonorCheckoutDashboard.tsx` — data table of donors with status badge (Not Started/In Progress/Complete), total, item count; status filter tabs; paginated; row click opens `DonorCheckoutItemEditor`; summary counts at top (FR-025)
- [x] T045 [US3] Build `DonorCheckoutItemEditor` component in `frontend/fundrbolt-admin/src/features/events/checkout/DonorCheckoutItemEditor.tsx` — side panel/dialog showing donor's item list; "Add Item" form; per-item reprice inline edit; per-item remove button; all mutations call admin API endpoints; FR-026
- [x] T046 [US3] Add `DonorCheckoutDashboard` to checkout tab in `frontend/fundrbolt-admin/src/features/events/checkout/CheckoutControlPanel.tsx` — renders below the open/close controls when checkout is open

---

## Phase 6: US4 — Admin Sends Checkout Link (P2)

*Needs Phase 4 (checkout must be open).*
*Story goal*: Admin sends push notification with direct checkout link to all or selected donors.
*Independent test*: Admin sends link; targeted donors receive push notification.

- [x] T047 [US4] Add notification dispatch endpoints to `backend/app/api/v1/admin_payments.py` — `POST /admin/events/{event_id}/checkout/notifications/send-link`, `POST /admin/events/{event_id}/checkout/notifications/send-reminder`; reuse existing notification infrastructure; filter reminder to `status != 'complete'`
- [x] T048 [P] [US4] Implement notification dispatch logic in `backend/app/services/checkout_notification_service.py` — `send_checkout_link(event_id, user_ids: list | None)`, `send_checkout_reminder(event_id, user_ids: list | None)`; use existing `NotificationService`/push infrastructure; return queued_count; FR-024, FR-027
- [x] T049 [US4] Build `SendCheckoutNotification` component in `frontend/fundrbolt-admin/src/features/events/checkout/SendCheckoutNotification.tsx` — "Send Checkout Link" button (all donors) + optional donor multi-select; "Send Reminder" button (only to incomplete donors); confirmation dialog; FR-024, FR-027

---

## Phase 7: US5 — Donor Contacts Admin (P2)

*Story goal*: Donor sends typed message from checkout page; NPO Admin receives via email + push + SMS.
*Independent test*: Donor submits message; admin email/push/SMS received; donor checkout state preserved.

- [x] T050 [US5] Add `POST /api/v1/events/{event_id}/checkout/contact-admin` endpoint to `backend/app/api/v1/payments.py` — rate-limit 3/hour per donor IP; dispatch email + push + SMS to NPO Admin simultaneously (fire-and-forget background task); return 204
- [x] T051 [P] [US5] Implement `ContactAdminService.send_message(event_id, donor_user_id, message)` in `backend/app/services/contact_admin_service.py` — send email (existing email service), push notification (existing notification service), SMS via Twilio (existing SMS service); FR-016
- [x] T052 [US5] Build `ContactAdminForm` component in `frontend/donor-pwa/src/components/checkout/ContactAdminForm.tsx` — inline expandable textarea (no navigation); "Send Message" button; success/error feedback; checkout state NOT affected on open/close (FR-017); rate-limit error message shown
- [x] T053 [US5] Integrate `ContactAdminForm` into checkout page in `frontend/donor-pwa/src/routes/events.$slug.checkout.tsx` — "Contact Admin" link at bottom of checkout; expands inline; FR-016

---

## Phase 8: Polish and Cross-Cutting Concerns

*Receipt PDF, Celery scheduled-open, Super Admin processing fee, My Event page checkout section.*

- [x] T054 Add `GET /api/v1/admin/processing-fee-config` and `POST /api/v1/admin/processing-fee-config` endpoints to `backend/app/api/v1/admin_payments.py` — Super Admin only; calls `ProcessingFeeConfigService`; FR-004
- [x] T055 [P] Add `GET /api/v1/admin/processing-fee-config/history` endpoint to `backend/app/api/v1/admin_payments.py` — paginated list of all historical rate rows
- [x] T056 [P] Build `ProcessingFeeConfig` Super Admin UI component in `frontend/fundrbolt-admin/src/components/settings/ProcessingFeeConfig.tsx` — current rate display, "Set New Rate" form with decimal/percent input, rate history table; FR-004
- [x] T057 Add admin receipt management endpoints to `backend/app/api/v1/admin_payments.py` — `GET /admin/events/{event_id}/checkout/donors/{user_id}/receipt` (stream PDF), `POST /admin/events/{event_id}/checkout/donors/{user_id}/receipt/resend` (re-send email); FR-028
- [x] T058 [P] Build `CheckoutReceiptActions` component in `frontend/fundrbolt-admin/src/features/events/checkout/CheckoutReceiptActions.tsx` — download button (calls receipt endpoint), resend button (calls resend endpoint); shown in `DonorCheckoutItemEditor` for completed checkouts; FR-028
- [x] T059 Add `GET /api/v1/events/{event_id}/checkout/balance` backward-compatible endpoint to `backend/app/api/v1/payments.py` — enhanced version of existing balance endpoint; returns new `CheckoutBalanceResponse` with `processing_fee_rate`, `cash_instructions`, `items_updated_at` fields; existing UI continues to work
- [x] T060 [P] Create `BoothInstructionsCard` component in `frontend/donor-pwa/src/components/checkout/BoothInstructionsCard.tsx` — displays `cash_instructions` text + NPO payee name; shown when Cash/Check/DAF selected; FR-009, FR-010
- [x] T061 Add `checkout_sessions(event_id, status)` composite index to Alembic migration in `backend/alembic/versions/xxxx_add_checkout_tables.py` — ensures admin dashboard query scales to 200+ donors (SC-003-perf)
- [x] T062 [P] Add `checkout_sessions(event_id, user_id)` unique index (already in data model) — verify it is in migration; add explicit GIN index on `checkout_items(session_id)` for item list query performance
- [x] T063 Register `checkout_tasks` module in Celery app `backend/app/celery_app.py` — add `app.tasks.checkout_tasks` to `include` list so task discovery works
- [x] T064 [P] Add `checkout_configuration` relationship to `Event` model in `backend/app/models/event.py` — `relationship("CheckoutConfiguration", back_populates="event", uselist=False, cascade="all, delete-orphan")` for convenient access in queries
- [x] T065 Run backend linter and type checker: `cd backend && poetry run ruff check . && poetry run ruff format --check . && poetry run mypy app --strict --ignore-missing-imports --exclude 'app/tests'` — fix all issues
- [x] T066 Run frontend lint, format, and build: `cd frontend/fundrbolt-admin && pnpm lint && pnpm format:check && pnpm build` — fix all issues
- [x] T067 [P] Run donor-pwa lint, format, and build: `cd frontend/donor-pwa && pnpm lint && pnpm format:check && pnpm build` — fix all issues
- [x] T068 Manual end-to-end smoke test against local stack following Scenario 1 in `quickstart.md` — verify full flow from admin opening checkout to donor receiving PDF receipt email
- [x] T069 [P] Verify `RevenueGeneratorEntry` source type coverage in service — in `backend/app/services/checkout_service.py` `build_checkout_items_from_balance()` query `revenue_generator_entries` table for entries linked to event+user with status=committed/won and insert them as `checkout_items` with `source_type='revenue_generator'`; item name copied from `RevenueGeneratorItem.name`; C9 remediation

---

## Implementation Strategy

### MVP Scope (Phase 1 + 2 + 3 + 4)
The P1 user stories (US1, US2) deliver the complete end-to-end checkout flow. Deliver these first:
1. Phase 1 + 2 (setup + services) — backend only, no UI
2. Phase 4 (US2 admin open) — Admin can open checkout; donor sees card
3. Phase 3 (US1 donor checkout) — Full checkout flow with tips, swipe, receipt

### Parallel Execution Within Phases
- **Phase 1**: T002–T010 are all independent (different files)
- **Phase 3**: T016–T020 (UI components) are independent; T027–T033 (backend endpoints) are independent after T013
- **Phase 5**: T044 and T045 can be built in parallel with T041–T043

### Key Dependencies
- T013 (session management) must complete before T027–T029
- T011 (config service) must complete before T034–T035
- T031 (PDF service) requires T007 (WeasyPrint installed)
- T039 (My Event checkout card) requires T040 (status endpoint)
