# Tasks: Beta-Readiness Integration Test Suite

**Input**: Design documents from `.specify/specs/047-integration-testing-beta/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

**Story Priority Order**:
- US3 (P2) — Seed system is foundational; elevated to Phase 2/3 as blocking prerequisite for all other stories
- US1 (P1) — Critical-path PR gate (Phase 4)
- US2 (P2) — Nightly regression sweep (Phase 5–6)
- US4 (P3) — Manual pre-beta checklist (Phase 7)

---

## Phase 1: Setup

**Purpose**: Initialize infrastructure — new directories, config files, and tooling.

- [ ] T001 Add `mailpit` service to `docker-compose.yml` under the `test` profile (`profiles: [test]`) so it only starts when `--profile test` is passed or via `docker-compose.test.yml`; image `axllent/mailpit:latest`, SMTP port 1025, HTTP port 8025, healthcheck on `curl -f http://localhost:8025/livez`
- [ ] T002 [P] Create `docker-compose.test.yml` override with `EMAIL_BACKEND=mailpit`, `MAILPIT_SMTP_HOST=mailpit`, `MAILPIT_SMTP_PORT=1025` env vars for backend service
- [ ] T003 [P] Initialize `e2e/` directory: create `e2e/package.json` with `@playwright/test ^1.58.2`, TypeScript dev dependencies, and scripts `test:critical-path`, `test:full-suite`, `test:mobile`
- [ ] T004 [P] Create `e2e/tsconfig.json` with strict TypeScript config targeting the `e2e/` source tree
- [ ] T005 [P] Create `e2e/playwright.config.ts` — base Chromium config with `ADMIN_APP_URL`, `DONOR_APP_URL`, `API_URL`, `MAILPIT_API_URL` env vars; `reporter: [['html'], ['json', { outputFile: 'results.json' }]]`; retries 1; workers 4
- [ ] T006 [P] Create `e2e/playwright.mobile.config.ts` — WebKit mobile-Safari project (375×812, `isMobile: true`) covering critical-path/01, critical-path/04, and full-suite/cross-cutting/pwa-features and responsive specs
- [ ] T007 [P] Create `e2e/.env.test.example` documenting all required environment variables per quickstart.md
- [ ] T008 [P] Create `tests/seed/` directory skeleton: `tests/seed/__init__.py`, `tests/seed/fixtures/__init__.py`, `tests/seed/factories/__init__.py`, `tests/seed/README.md` with usage instructions
- [ ] T008a [P] Create `tests/seed/factories/base.py` — `BaseFactory(SQLAlchemyModelFactory)` with `class Meta: sqlalchemy_session_persistence = "commit"`; `tests/seed/factories/user_factory.py` (`UserFactory`), `tests/seed/factories/event_factory.py` (`EventFactory`, `EventTableFactory`), `tests/seed/factories/ticket_factory.py` (`TicketPackageFactory`, `PromotionFactory`), `tests/seed/factories/auction_factory.py` (`AuctionItemFactory`), `tests/seed/factories/organization_factory.py` (`NPOFactory`), `tests/seed/factories/registration_factory.py` (`RegistrationFactory`, `RegistrationGuestFactory`), `tests/seed/factories/sponsor_factory.py` (`SponsorFactory`) — each factory uses `factory.LazyAttribute` for computed fields and `factory.SubFactory` for FK relationships
- [ ] T009 [P] Add Makefile targets: `seed` (runs seed.py), `test-e2e` (runs `cd e2e && pnpm playwright test full-suite/`), `test-critical-path` (runs `cd e2e && pnpm playwright test critical-path/`), `test-all` (sequential: test-backend then test-e2e), `test-e2e-report` (opens playwright-report)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core test infrastructure required before any user story can be verified.

**⚠️ CRITICAL**: No user story work can begin until Phase 2 is complete.

- [ ] T010 Add `EMAIL_BACKEND` config field to `backend/app/core/config.py` (default `"azure_acs"` — MUST remain `"azure_acs"` to not break production; accepts `"mailpit"` or `"console"`); add config validation in `backend/app/tests/unit/test_config.py` asserting that default `email_backend` is `"azure_acs"` and invalid values raise `ValidationError`; wire `backend/app/services/email_service.py` to use SMTP transport when `email_backend == "mailpit"` with `MAILPIT_SMTP_HOST` / `MAILPIT_SMTP_PORT` settings; see ADR-003
- [ ] T011 Add `freezegun ^1.5.0` and `pytest-freezegun ^0.4.2` to `backend/pyproject.toml` dev dependencies; run `cd backend && poetry lock --no-update && poetry install`
- [ ] T012 [P] Create `e2e/helpers/api-client.ts` — typed `ApiClient` class wrapping `fetch` with base URL, Bearer token injection, and methods `get`, `post`, `patch`, `delete`; exported factory `createApiClient(baseUrl, token)`
- [ ] T013 [P] Create `e2e/helpers/auth.ts` — `loginAs(role)` helper that authenticates via `POST /api/v1/auth/login` with seed credentials for the given role and returns `ApiClient` + access token; `storeSeedAuth(page, role)` for injecting tokens into browser localStorage
- [ ] T014 [P] Create `e2e/helpers/email.ts` — `MailpitClient` class with `waitForMessage({ to, subjectContains, timeout })` method that polls `GET /api/v2/messages` until a matching message arrives or timeout; `extractLink(message, pattern)` for pulling URLs out of email bodies; `deleteAll()` teardown helper
- [ ] T015 [P] Create `e2e/helpers/provision.ts` — `provisionEvent`, `provisionUser`, `provisionTicketPackage`, `provisionAuctionItem`, `provisionRegistration` factory functions that POST to admin API using super-admin `ApiClient` and return typed response objects; each function appends a random UUID to names for test isolation; **omit** `cleanupProvisioned` (YAGNI — scoped entities are isolated by UUID suffix and don't need teardown per FR-050a)
- [ ] T015a [P] Create `e2e/helpers/wait.ts` — `waitForCondition(conditionFn: () => Promise<boolean>, opts: { timeout?: number; interval?: number; message?: string })` that polls `conditionFn` every `interval` ms (default 250) until it returns `true` or `timeout` ms (default 10 000) elapses, then throws with `message`; `waitForApiState(apiClient: ApiClient, endpoint: string, assertFn: (data: unknown) => boolean, opts?)` that wraps `waitForCondition` with an API GET; required for FR-030 (live dashboard ≤5 s) and FR-034 (notification receipt) per spec edge-case "must wait deterministically … not sleep for a fixed interval"
- [ ] T016 [P] Create `e2e/helpers/time.ts` — `setEventTime(page, offset)` helper wrapping `page.clock.setFixedTime(Date.now() + offset)` and `resetClock(page)` wrapper
- [ ] T017 [P] Create `e2e/fixtures/base-fixtures.ts` — Playwright fixtures extending base `test` with `adminApi: ApiClient`, `donorApi: ApiClient`, `superAdminApi: ApiClient`, and `seedRefs: SeedRefs` (typed references to seeded entity slugs/IDs read from API on first use)
- [ ] T018 [P] Install `e2e/` dependencies: `cd e2e && pnpm install && pnpm playwright install chromium webkit`

---

## Phase 3: Seed System [US3]

**Story Goal**: Any engineer or QA reviewer can bring up a complete fundrbolt environment with a single command and seed step, producing a known, idempotent baseline.

**Independent Test**: Run `make seed` twice in succession — second run produces 0 new entities and no errors.

- [ ] T019 [US3] Create `tests/seed/fixtures/legal.py` — seed `LegalDocument` rows for current ToS and Privacy Policy using `LegalDocumentFactory` from `tests/seed/factories`; use `session.merge()` (or `INSERT ... ON CONFLICT DO NOTHING`) for idempotency; version `1.0`
- [ ] T020 [US3] Create `tests/seed/fixtures/users.py` — seed one `User` per role (`super_admin`, `npo_admin`, `npo_staff`, `checkin_staff`, `donor`) using `UserFactory` with deterministic emails `automation+{role}@fundrbolt.com`, pre-verified, pre-ToS-accepted; use `ON CONFLICT (email) DO UPDATE SET is_active = true` to handle re-runs
- [ ] T021 [US3] Create `tests/seed/fixtures/organizations.py` — seed `NPO` with slug `seed-nonprofit`, status `approved` using `NPOFactory`; assign `npo_admin` user as member; `ON CONFLICT (slug) DO NOTHING`
- [ ] T022 [US3] Create `tests/seed/fixtures/events.py` — seed three events (`seed-future-event` scheduled, `seed-live-event` active, `seed-past-event` complete) under `seed-nonprofit` using `EventFactory`; each with branding (logo URL from Azurite test blob), food options (chicken, vegetarian, vegan); `ON CONFLICT (slug) DO UPDATE SET status = EXCLUDED.status`
- [ ] T023 [US3] Create `tests/seed/fixtures/tickets.py` — seed 3 ticket packages per event (General $100/100 qty, VIP $500/20 qty, Custom w/ meal_choice + plus_one options) using `TicketPackageFactory`; seed promo code `SEED10` (10% off, unlimited uses) per event; `ON CONFLICT (event_id, name) DO NOTHING`
- [ ] T024 [US3] Create `tests/seed/fixtures/auction_items.py` — seed 5 silent items (min bid $50–$200) and 5 live items (min bid $100–$500) per event using `AuctionItemFactory`; each with a test image blob URL; `ON CONFLICT (event_id, item_number) DO NOTHING`
- [ ] T025 [US3] Create `tests/seed/fixtures/seating.py` — seed 5 seating tables per event (capacity 50 each, numbered 1–5) using `EventTableFactory`; table 1 named `VIP Table` with capacity 10; seed pre-checked-in registration on `seed-live-event` (bidder #1, table 1, table captain) using `RegistrationFactory` + `RegistrationGuestFactory`; seed unchecked-in registration; seed multi-guest registration with meal selections; `ON CONFLICT DO UPDATE` for tables
- [ ] T026 [US3] Create `tests/seed/fixtures/sponsors.py` — seed 2 gold, 2 silver, 1 bronze sponsor per event with test logo URLs using `SponsorFactory`; `ON CONFLICT (event_id, name) DO NOTHING`
- [ ] T027 [US3] Create `tests/seed/seed.py` — main entry point: `argparse` CLI with `--tenant-slug` (default `seed-nonprofit`) and `--environment` (default `development`) flags; imports and calls each fixture module in dependency order (legal → users → organizations → events → tickets → auction_items → seating → sponsors); prints summary `{entity}: N created, M unchanged`; exits non-zero on any error
- [ ] T028 [US3] Create `tests/seed/helpers.py` — Python provisioning helpers for pytest using factory_boy factories: `provision_event(session, npo_id, **kwargs) → Event`, `provision_user(session, role, **kwargs) → User`, `provision_ticket_package(session, event_id, **kwargs) → TicketPackage`, `provision_auction_item(session, event_id, **kwargs) → AuctionItem`, `provision_registration(session, event_id, user_id, **kwargs) → Registration` — each wraps the corresponding Factory with a unique name/email via `uuid4()` suffix, sets the session on the factory Meta, and returns the created model instance

---

## Phase 4: Critical-Path PR Gate [US1]

**Story Goal**: When a PR breaks a critical flow, the gate fails within 8 minutes and identifies the broken flow.

**Independent Test**: Break the ticket checkout endpoint (return 500) → PR check must fail pointing to the checkout spec.

- [ ] T029 [US1] Create `e2e/critical-path/01-donor-signup.spec.ts` — signs up with unique email (FR-001), asserts verification email arrives in Mailpit within 10 s, extracts verification link, navigates to link, asserts donor is now authenticated
- [ ] T030 [US1] Create `e2e/critical-path/02-donor-signin.spec.ts` — signs in with pre-verified seed donor credentials, asserts authenticated state; signs out, asserts session cleared; tests rejection of wrong password (FR-002)
- [ ] T031 [US1] Create `e2e/critical-path/03-event-registration.spec.ts` — provisions a scoped event + ticket package; donor navigates to donor PWA event page, selects General Admission ticket, proceeds to checkout, completes payment via stub gateway, asserts registration confirmation page and confirmation email in Mailpit (FR-015, FR-017)
- [ ] T032 [US1] Create `e2e/critical-path/04-ticket-purchase.spec.ts` — uses seed live event; donor adds VIP ticket to cart, applies promo code `SEED10`, verifies 10% discount reflected; completes stub checkout; asserts receipt page and receipt email (FR-016, FR-017)
- [ ] T033 [US1] Create `e2e/critical-path/05-bid-placement.spec.ts` — uses seed live event; donor signs in, navigates to auction item (silent), places bid at minimum, asserts bid is reflected in item card; places second bid above minimum, asserts new high bid shows (FR-023)
- [ ] T034 [US1] Create `e2e/critical-path/06-guest-checkin.spec.ts` — signs in as checkin_staff; opens check-in page for seed live event; searches unchecked-in registration by last name; confirms check-in; asserts bidder number assigned and registration marked checked-in (FR-028)
- [ ] T035 [US1] Create `e2e/critical-path/07-admin-event-creation.spec.ts` — signs in as npo_admin on admin PWA; creates a new event via the event creation form; asserts event appears in event list with status `draft`; transitions to `scheduled`; asserts branding inherited from org (FR-008, FR-009)
- [ ] T036 [US1] Create `.github/workflows/critical-path-gate.yml` — triggers on `pull_request` to `main`/`develop`; jobs: `setup` (spins up `docker-compose --profile test` stack, seeds DB, starts backend + frontends), `critical-path-chromium` (depends on `setup`, runs `pnpm playwright test critical-path/ --shard $N/$TOTAL` on Chromium, 4 shards, timeout 8 min), `report` (always runs, uploads Playwright HTML report + trace artifacts); overall timeout 10 min; **WebKit mobile subset runs only in nightly** (too slow for PR gate budget)

---

## Phase 5: Extended Backend API Integration Tests [US2]

**Story Goal**: API-level verification of flows that are faster or more reliable to test without a browser.

**Independent Test**: `poetry run pytest app/tests/integration/test_ticket_checkout_flow.py -v` passes.

- [ ] T037 [US2] Create `backend/app/tests/integration/test_ticket_checkout_flow.py` — covers FR-017 (checkout success), FR-018 (inventory exhaustion → 409, duplicate submission idempotency, abandoned-cart timeout), FR-019 (cash/check/DAF alternate payment recording), FR-020 (ticket self-assignment, transfer, revocation); uses `@freeze_time` for cart expiry scenarios
- [ ] T038 [US2] Create `backend/app/tests/integration/test_auction_bidding_flow.py` — covers FR-022 (item browsing/filtering/search/watchlist), FR-023 (bid validation: below min rejected, at/above accepted, max-bid auto-increment), FR-024 (concurrent bids via `asyncio.gather`, single winner assertion), FR-025 (quick-bid entry by paddle: unassigned paddle rejected, missing table rejected), FR-026 (auction close: winner marked, outbid notifications emitted, winner notification emitted), FR-027 (bid CSV import: row errors reported, audit record created)
- [ ] T039 [US2] Create `backend/app/tests/integration/test_checkin_flow.py` — covers FR-028 (name search check-in, scanned-ID check-in, bidder number assigned, duplicate check-in rejected), FR-029 (bulk check-in multiple guests in one action)
- [ ] T040 [US2] [P] Create `backend/app/tests/integration/test_event_analytics.py` — covers FR-033 (revenue by source, registrations vs capacity, top sponsors, auction performance via analytics API)
- [ ] T041 [US2] [P] Create `backend/app/tests/integration/test_import_flows.py` — covers FR-035 (user import CSV with row errors, audit log entry; registration import; ticket-sales import; bid import), supplementing existing `test_registration_import_integration.py`
- [ ] T042 [US2] [P] Create `backend/app/tests/integration/test_rbac_matrix.py` — covers FR-037: for each role × each protected route group, assert that the role gets the correct HTTP 200/403/401 response; driven by a parametrize matrix so adding routes only requires updating the matrix data
- [ ] T043 [US2] [P] Create `backend/app/tests/integration/test_gdpr_flow.py` — covers FR-038 (data export request enqueued, account deletion request with grace period, deletion produces audit record); uses `@freeze_time` for grace-period expiry
- [ ] T043a [US2] [P] Create `backend/app/tests/integration/test_user_management_flow.py` — covers FR-036: super admin changes user role and asserts audit log entry; super admin deactivates user and asserts login returns 401; super admin reactivates user and asserts login succeeds; super admin triggers forced password reset and asserts reset email captured in Mailpit; all four actions produce distinct `audit_log` records with correct `actor_id`, `action`, and `target_user_id`

---

## Phase 6: Full Nightly E2E Suite [US2]

**Story Goal**: Nightly comprehensive sweep exercises every donor, admin, auctioneer, and staff flow.

**Independent Test**: Trigger `gh workflow run nightly-regression.yml` → all flow groups execute and publish results.

### Auth specs (FR-001 to FR-007)

- [ ] T044 [US2] [P] Create `e2e/full-suite/auth/registration.spec.ts` — FR-001: full sign-up → email verify → authenticated flow
- [ ] T045 [US2] [P] Create `e2e/full-suite/auth/signin-signout.spec.ts` — FR-002: sign-in, sign-out, reject expired reset token, reject reused reset token
- [ ] T046 [US2] [P] Create `e2e/full-suite/auth/password-reset.spec.ts` — FR-002: request reset → email link → confirm reset → sign in with new password
- [ ] T047 [US2] [P] Create `e2e/full-suite/auth/rate-limiting.spec.ts` — FR-003: 6th login attempt within window returns 429; reset rate limit; password-reset 4th attempt rejected (via API assertions, not real waiting, using `@freeze_time` via direct API calls)
- [ ] T048 [US2] [P] Create `e2e/full-suite/auth/session-expiry.spec.ts` — FR-004: session expiry warning modal appears before expiry; token refresh succeeds on user action; uses `page.clock.setFixedTime` to advance clock
- [ ] T049 [US2] [P] Create `e2e/full-suite/auth/legal-consent.spec.ts` — FR-005: new user must accept ToS at registration; version bump forces re-acceptance on next protected action; withdrawal deactivates account
- [ ] T050 [US2] [P] Create `e2e/full-suite/auth/npo-onboarding.spec.ts` — FR-006: new user submits NPO application; super admin approves; applicant gains org admin privileges
- [ ] T051 [US2] [P] Create `e2e/full-suite/auth/social-login.spec.ts` — FR-007: social callback API contract test (identity linking to existing account by email; sign in via social path for passwordless account)

### Admin Event Setup specs (FR-008 to FR-014)

- [ ] T052 [US2] [P] Create `e2e/full-suite/admin-event-setup/event-creation.spec.ts` — FR-008: org admin creates event, branding inherited from org
- [ ] T053 [US2] [P] Create `e2e/full-suite/admin-event-setup/event-status.spec.ts` — FR-009: valid transitions (draft→scheduled→active→complete); invalid transitions rejected (active→scheduled, complete→active)
- [ ] T054 [US2] [P] Create `e2e/full-suite/admin-event-setup/event-media-sponsors.spec.ts` — FR-010: media upload, sponsor management, food option management, ticket package management (custom options, promo codes), event link management
- [ ] T055 [US2] [P] Create `e2e/full-suite/admin-event-setup/auction-items.spec.ts` — FR-011: single auction item creation; bulk import from CSV; per-row error reporting on invalid rows
- [ ] T056 [US2] [P] Create `e2e/full-suite/admin-event-setup/seating.spec.ts` — FR-012: custom per-table capacity (1–20); table naming; table captain assignment; reject capacity reduction below occupancy
- [ ] T057 [US2] [P] Create `e2e/full-suite/admin-event-setup/checklist-run-of-show.spec.ts` — FR-013: checklist template application; run-of-show scheduling; revenue generator creation and winner selection
- [ ] T058 [US2] [P] Create `e2e/full-suite/admin-event-setup/event-duplication.spec.ts` — FR-014: duplicate event deep-copies food/tickets/sponsors/media; registrations/sales/bids are NOT copied

### Donor Registration & Tickets specs (FR-015 to FR-021)

- [ ] T059 [US2] [P] Create `e2e/full-suite/donor-registration/guest-registration.spec.ts` — FR-015: register guests, select meal options per guest, record dietary notes
- [ ] T060 [US2] [P] Create `e2e/full-suite/donor-registration/ticket-browsing.spec.ts` — FR-016: browse tickets, add/remove from cart, apply valid promo code, reject invalid promo code, custom option price recalculation
- [ ] T061 [US2] [P] Create `e2e/full-suite/donor-registration/ticket-checkout.spec.ts` — FR-017: complete stub checkout; receipt generated; confirmation email captured in Mailpit
- [ ] T062 [US2] [P] Create `e2e/full-suite/donor-registration/checkout-errors.spec.ts` — FR-018: inventory exhaustion (409), idempotent duplicate submission, abandoned-cart recovery
- [ ] T063 [US2] [P] Create `e2e/full-suite/donor-registration/alt-payment.spec.ts` — FR-019: cash, check, DAF payment recording (no gateway invoked); assert order confirmed
- [ ] T064 [US2] [P] Create `e2e/full-suite/donor-registration/ticket-management.spec.ts` — FR-020: ticket self-assign, guest-assign, transfer to another recipient, revoke
- [ ] T065 [US2] [P] Create `e2e/full-suite/donor-registration/donate-now.spec.ts` — FR-021: one-time donation, recurring donation, support wall entry, configurable preset amounts

### Auction Bidding specs (FR-022 to FR-027)

- [ ] T066 [US2] [P] Create `e2e/full-suite/auction-bidding/item-browsing.spec.ts` — FR-022: item browse, filter by type, search, watch list toggle
- [ ] T067 [US2] [P] Create `e2e/full-suite/auction-bidding/bid-placement.spec.ts` — FR-023: reject below-minimum, accept at/above minimum, silent-auction max-bid auto-increment
- [ ] T068 [US2] [P] Create `e2e/full-suite/auction-bidding/concurrent-bidding.spec.ts` — FR-024: two concurrent API callers on same item via `apiClient`, assert single winner, no lost bids, consistent history (API-level, not browser)
- [ ] T069 [US2] [P] Create `e2e/full-suite/auction-bidding/quick-bid-entry.spec.ts` — FR-025: admin quick-bid by paddle; unassigned paddle rejected; missing table rejected
- [ ] T070 [US2] [P] Create `e2e/full-suite/auction-bidding/auction-close.spec.ts` — FR-026: close auction; winner marked; outbid notifications to losers; winner notification; uses `page.clock`
- [ ] T071 [US2] [P] Create `e2e/full-suite/auction-bidding/bid-import.spec.ts` — FR-027: bid CSV import, row errors reported, audit record created

### Check-In, Live Event, Dashboards specs (FR-028 to FR-034)

- [ ] T072 [US2] [P] Create `e2e/full-suite/checkin-live/checkin.spec.ts` — FR-028+FR-029: name-search check-in, scanned-ID check-in, bidder number assigned, duplicate rejected; bulk check-in multiple guests
- [ ] T073 [US2] [P] Create `e2e/full-suite/checkin-live/live-dashboard.spec.ts` — FR-030: new arrival reflected in dashboard within 5 s; ticket revenue updated; top bids updated; polling assertion with bounded timeout
- [ ] T074 [US2] [P] Create `e2e/full-suite/checkin-live/auctioneer-view.spec.ts` — FR-031: auctioneer live view current item, current high bid, paddle entry, advance to next item
- [ ] T075 [US2] [P] Create `e2e/full-suite/checkin-live/donor-live-view.spec.ts` — FR-032: after event starts, donor sees table number, captain badge, fellow guests
- [ ] T076 [US2] [P] Create `e2e/full-suite/checkin-live/analytics.spec.ts` — FR-033: revenue by source, registrations vs capacity, top sponsors, auction performance
- [ ] T077 [US2] [P] Create `e2e/full-suite/checkin-live/notifications.spec.ts` — FR-034: in-app and push notification (mock subscription) for auction-closing reminder and item-won outcome

### Imports specs (FR-035)

- [ ] T078 [US2] [P] Create `e2e/full-suite/imports/user-import.spec.ts` — FR-035: user CSV import, row-level errors reported, audit log entry
- [ ] T079 [US2] [P] Create `e2e/full-suite/imports/registration-import.spec.ts` — FR-035: registration CSV import, row errors, audit log
- [ ] T080 [US2] [P] Create `e2e/full-suite/imports/ticket-sales-import.spec.ts` — FR-035: ticket-sales CSV import, row errors, audit log
- [ ] T081 [US2] [P] Create `e2e/full-suite/imports/bid-import.spec.ts` — FR-035: bid CSV import, row errors, audit log (browser-level verification of admin UI flow)

### Cross-Cutting specs (FR-037 to FR-043)

- [ ] T082 [US2] [P] Create `e2e/full-suite/cross-cutting/rbac.spec.ts` — FR-037: programmatic role × route matrix assertion via API calls; no browser required
- [ ] T083 [US2] [P] Create `e2e/full-suite/cross-cutting/gdpr.spec.ts` — FR-038: data export request, deletion request + grace period
- [ ] T084 [US2] [P] Create `e2e/full-suite/cross-cutting/cookie-consent.spec.ts` — FR-039: cookie consent anonymous user, authenticated user, revocation
- [ ] T085 [US2] [P] Create `e2e/full-suite/cross-cutting/pwa-features.spec.ts` — FR-040: PWA install prompt, offline cached event home, update banner after new release (Playwright service worker interception)
- [ ] T086 [US2] [P] Create `e2e/full-suite/cross-cutting/responsive.spec.ts` — FR-041: key pages at 375 px viewport (donor home, ticket browsing, bid placement, check-in, sign-in) — no broken layout, no horizontal scroll
- [ ] T087 [US2] [P] Create `e2e/full-suite/cross-cutting/accessibility.spec.ts` — FR-042: axe-core via `@axe-core/playwright` — no serious/critical violations on: donor sign-in, event home, ticket checkout, bid placement, check-in
- [ ] T088 [US2] [P] Create `e2e/full-suite/cross-cutting/error-boundaries.spec.ts` — FR-043: simulate 500 from API via route interception; verify friendly error boundary renders, no blank screen, no unhandled React error
- [ ] T089 [US2] Add `@axe-core/playwright` to `e2e/package.json` dependencies

### Nightly CI Workflow + Notifications

- [ ] T090 [US2] Create `.github/workflows/nightly-regression.yml` — cron `0 3 * * *` (3 AM UTC); jobs: `reseed-tenant` (wipe + reseed automation tenant on staging), `full-suite-chromium` (matrix over spec groups: `auth`, `admin-event-setup`, `donor-registration`, `auction-bidding`, `checkin-live`, `imports`, `cross-cutting` with `continue-on-error: true`), `mobile-webkit` (runs `pnpm playwright test --config playwright.mobile.config.ts` — FR-047a: covers critical-path/01, critical-path/04, full-suite/cross-cutting/pwa-features.spec.ts, full-suite/cross-cutting/responsive.spec.ts), `notify-teams` (always runs, builds JSON summary from matrix outputs, POSTs to `MSTEAMS_WEBHOOK_URL`); `update-github-issues` (always runs, uses `gh` CLI to create/update/close issues per failing/passing flow with label `nightly-failure`)

---

## Phase 7: Manual Pre-Beta Checklist [US4]

**Story Goal**: Engineering lead can sign off on real-device, real-provider, and real-payment items before beta launch.

**Independent Test**: New team member opens checklist, follows it top-to-bottom, no questions needed.

- [ ] T091 [US4] Create `tests/manual/pre-beta-checklist.md` — structured checklist covering (per FR-052): real payment processor sandbox transaction (end-to-end charge + refund), real email deliverability (Gmail, Outlook, Yahoo — verify receipt + links), Apple Pay button rendering (Safari on macOS + iOS), Google Pay button rendering (Chrome), real device push notifications (iOS Safari + Android Chrome), real social login via Google and Apple, PWA install on physical iOS (Safari Add to Home Screen) and Android (Chrome install prompt); each item uses the standard format from data-model.md; includes sign-off table at end with `Reviewer`, `Date`, `Environment`, `Pass/Fail`

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T092 Verify `make seed` idempotency (run twice, assert 0 new entities on second run) and update seed README with any corrections found
- [ ] T093 [P] Add `e2e/` to `.gitignore` exclusions for `playwright-report/`, `test-results/`, `node_modules/` (create `e2e/.gitignore`)
- [ ] T094 [P] Add `tests/seed/` to `backend/.gitignore` `__pycache__` patterns if not already covered
- [ ] T095 [P] Update root `README.md` `## Testing` section with references to `make seed`, `make test-critical-path`, `make test-e2e`, and link to quickstart.md
- [ ] T096 [P] Update `.github/copilot-instructions.md` `## Commands` section to include new Makefile targets

---

## Dependencies

```
Phase 1 → Phase 2 (infrastructure before helpers)
Phase 2 → Phase 3 (helpers + email before seed)
Phase 3 → Phase 4 (seed before critical-path specs need fixture data)
Phase 3 → Phase 5 (seed before API integration tests need fixture data)
Phase 4 → Phase 6 (critical-path patterns established before full-suite)
Phase 5 → Phase 6 (API test patterns established)
Phase 6 → Phase 7 (nightly CI defined before manual checklist cross-references it)
All → Phase 8 (polish after main implementation)

Within Phase 4: T029–T035 can run in parallel (different spec files)
Within Phase 6: all T044–T090 are [P] — different spec files, no inter-file deps
```

## Parallel Execution Examples

**PR gate (critical-path, 4 shards)**:
```
Shard 1: T029 + T030  (auth flows ~2 min)
Shard 2: T031 + T032  (registration + ticket ~2 min)
Shard 3: T033 + T034  (bid + checkin ~2 min)
Shard 4: T035         (admin event creation ~1.5 min)
Total wall-clock: ~2.5 min (+ 3 min infra bringup) ≈ 5.5 min < 8 min budget ✓
```

**Nightly full suite (7 spec-group shards)**:
```
auth/ | admin-event-setup/ | donor-registration/ | auction-bidding/ | checkin-live/ | imports/ | cross-cutting/
Each shard runs independently; any failure publishes per-flow results without aborting others.
```

## Implementation Strategy

**MVP scope (minimum for US1 acceptance)**: Phases 1–4 + T090 (nightly workflow skeleton).
Deliver US3 seed + US1 critical-path + CI gate first — this is the highest-value safety net.
US2 full suite and US4 checklist follow in subsequent iterations.
