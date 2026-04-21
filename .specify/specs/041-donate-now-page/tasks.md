# Tasks: Donate Now Page (041)

**Input**: Design documents from `/specs/041-donate-now-page/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/donate-now.yaml ✅, quickstart.md ✅

**Organization**: Tasks grouped by user story. Each story is independently completable and testable.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label (US1–US5 per spec.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: File creation and scaffolding — no logic, just structure and routing stubs.

- [ ] T001 Create backend model files (empty): `backend/app/models/donate_now_config.py`, `backend/app/models/donation_tier.py`, `backend/app/models/donation.py`, `backend/app/models/support_wall_entry.py`
- [ ] T002 [P] Create backend schema files (empty): `backend/app/schemas/donate_now_config.py`, `backend/app/schemas/donation.py`, `backend/app/schemas/support_wall_entry.py`
- [ ] T003 [P] Create backend API router files (empty): `backend/app/api/v1/public_donate_now.py`, `backend/app/api/v1/admin_donate_now.py`
- [ ] T004 [P] Create backend service files (empty): `backend/app/services/donate_now_service.py`, `backend/app/services/recurring_donation_service.py`
- [ ] T005 [P] Create backend Celery task file (empty): `backend/app/tasks/recurring_donation_tasks.py`
- [ ] T006 [P] Create donor PWA route file (empty): `frontend/donor-pwa/src/routes/npo.$slug.donate-now.tsx`
- [ ] T007 [P] Create donor PWA component stubs: `frontend/donor-pwa/src/components/donate-now/DonateNowHeroSection.tsx`, `DonationTierButtons.tsx`, `DonationAmountSelector.tsx`, `DonationSlider.tsx`, `DonationConfirmDialog.tsx`, `MonthlyRecurrenceFields.tsx`, `SupportWallMessageForm.tsx`, `SupportWall.tsx`, `SupportWallEntry.tsx`, `DonationSuccessOverlay.tsx`
- [ ] T008 [P] Create donor PWA feature and API client files (empty): `frontend/donor-pwa/src/features/donate-now/DonateNowPage.tsx`, `frontend/donor-pwa/src/features/donate-now/useDonateNow.ts`, `frontend/donor-pwa/src/api/donateNow.ts`
- [ ] T009 [P] Create admin PWA route and component stubs: `frontend/fundrbolt-admin/src/routes/npos/$npoId/donate-now/index.tsx`, `hero.tsx`, `tiers.tsx`, `info.tsx`, `wall.tsx`; `frontend/fundrbolt-admin/src/components/donate-now/DonateNowConfigForm.tsx`, `DonationTierEditor.tsx`, `SupportWallModerationTable.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database migrations, models, Alembic wiring, and router registration. ALL user stories block on this phase.

**⚠️ CRITICAL**: No user story implementation can begin until T010–T019 are complete.

- [ ] T010 Write migration `043a_add_npo_slug.py` in `backend/alembic/versions/`: ADD COLUMN `slug VARCHAR(100)` UNIQUE NOT NULL to `npos`; write backfill logic `re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')[:100]`; add UNIQUE index on `slug`
- [ ] T011 Write migration `043b_add_donate_now_tables.py` in `backend/alembic/versions/`: CREATE `donate_now_page_configs`, `donation_tiers`, `donations`, `support_wall_entries` with all columns, FKs, and indexes per data-model.md
- [ ] T012 [P] Implement `DonateNowPageConfig` SQLAlchemy model in `backend/app/models/donate_now_config.py`: all columns per data-model.md, relationships to `NPO`, `DonationTier[]`, `Donation[]`
- [ ] T013 [P] Implement `DonationTier` SQLAlchemy model in `backend/app/models/donation_tier.py`: `amount_cents`, `impact_statement`, `display_order`, FK to `donate_now_page_configs.id`
- [ ] T014 [P] Implement `Donation` SQLAlchemy model in `backend/app/models/donation.py`: all columns per data-model.md including `DonationStatus` enum, `RecurrenceStatus` enum, idempotency key
- [ ] T015 [P] Implement `SupportWallEntry` SQLAlchemy model in `backend/app/models/support_wall_entry.py`: all columns per data-model.md
- [ ] T016 Add `slug` field to `NPO` model in `backend/app/models/npo.py` and update `NPOResponse` schema in `backend/app/schemas/npo.py` to include `slug`
- [ ] T017 Add `donate_now_config` relationship to `NPO` model in `backend/app/models/npo.py` (back-populates from `DonateNowPageConfig`)
- [ ] T018 Register new models in `backend/app/models/__init__.py` to ensure Alembic autogenerate picks them up
- [ ] T019 Register `public_donate_now` and `admin_donate_now` routers in `backend/app/api/v1/__init__.py` (or `backend/app/main.py` depending on existing pattern) with correct prefixes and tags
- [ ] T020 Run `poetry run alembic upgrade head` in `backend/` and confirm both migrations apply cleanly; fix any issues

**Checkpoint**: `poetry run alembic upgrade head` succeeds, all 4 new tables exist in DB, `npos.slug` column exists.

---

## Phase 3: User Story 4 — NPO Admin Configures the Donate Now Page (Priority: P1) 🎯 MVP

**Goal**: Admin can configure hero, tiers, processing fee, NPO info, and enable/disable the page. This unblocks the donor-facing page (US1–US3).

**Independent Test**: Log in to Admin PWA, navigate to NPO → Donate Now, save a complete config (hero URL, 3 tiers, 2.9% fee, info text, enabled=true), verify `GET /api/v1/npos/{slug}/donate-now` returns the saved data.

### Implementation for User Story 4

- [ ] T021 [P] [US4] Implement Pydantic schemas in `backend/app/schemas/donate_now_config.py`: `DonateNowConfigResponse`, `DonateNowConfigUpdate`, `DonationTierResponse`, `DonationTierInput` (per contracts/donate-now.yaml)
- [ ] T022 [P] [US4] Implement `DonateNowService` CRUD methods in `backend/app/services/donate_now_service.py`: `get_config(npo_id)` (upsert-aware), `update_config(npo_id, data)`, `upsert_tiers(config_id, tiers)` with max-10 validation
- [ ] T023 [US4] Implement admin API endpoints in `backend/app/api/v1/admin_donate_now.py`: `GET /api/v1/admin/npos/{npo_id}/donate-now/config`, `PUT /api/v1/admin/npos/{npo_id}/donate-now/config`, `GET /api/v1/admin/npos/{npo_id}/donate-now/tiers`, `PUT /api/v1/admin/npos/{npo_id}/donate-now/tiers` — apply NPO-scoped RBAC using existing `require_npo_role` dependency
- [ ] T024 [P] [US4] Implement hero media SAS upload endpoint in `backend/app/api/v1/admin_donate_now.py`: `POST /api/v1/admin/npos/{npo_id}/donate-now/hero-upload-url` — generates Azure Blob SAS URL using existing blob storage pattern; container reuses existing NPO branding container
- [ ] T025 [P] [US4] Implement admin PWA API client functions in `frontend/fundrbolt-admin/src/api/donateNow.ts` (create file): `getConfig(npoId)`, `updateConfig(npoId, data)`, `getTiers(npoId)`, `updateTiers(npoId, tiers)`, `getUploadUrl(npoId, filename, contentType)`
- [ ] T026 [US4] Implement admin Donate Now index route in `frontend/fundrbolt-admin/src/routes/npos/$npoId/donate-now/index.tsx`: tabbed layout with 4 tabs (Hero, Tiers, NPO Info, Support Wall); fetches config on load; shows enable/disable toggle at top
- [ ] T027 [US4] Implement `DonateNowConfigForm` component in `frontend/fundrbolt-admin/src/components/donate-now/DonateNowConfigForm.tsx`: form fields for `donate_plea_text` (text input), `processing_fee_pct` (number input 0–100%), `npo_info_text` (textarea), `is_enabled` (toggle); save calls `updateConfig`
- [ ] T028 [US4] Implement hero configuration tab in `frontend/fundrbolt-admin/src/routes/npos/$npoId/donate-now/hero.tsx`: file upload button that calls `getUploadUrl` then uploads directly to blob SAS URL; transition style selector (dropdown: `documentary_style | fade | swipe | simple`); live preview using `DonateNowHeroSection` component after upload
- [ ] T029 [US4] Implement `DonationTierEditor` component in `frontend/fundrbolt-admin/src/components/donate-now/DonationTierEditor.tsx`: sortable list of tier rows (drag-to-reorder); each row has amount input (dollars, converts to cents), optional impact statement input (≤200 chars); add/remove row buttons; max 10 rows validation
- [ ] T030 [US4] Implement tiers tab in `frontend/fundrbolt-admin/src/routes/npos/$npoId/donate-now/tiers.tsx`: renders `DonationTierEditor`; save button calls `updateTiers` with the ordered list
- [ ] T031 [US4] Implement NPO info tab in `frontend/fundrbolt-admin/src/routes/npos/$npoId/donate-now/info.tsx`: textarea for `npo_info_text` (plain text); save calls `updateConfig`
- [ ] T032 [US4] Connect admin route to NPO navigation in `frontend/fundrbolt-admin/src/` (existing NPO detail page or sidebar): add "Donate Now" menu item linking to the new route

**Checkpoint**: Admin can fully configure and enable a Donate Now page. `GET /api/v1/npos/{slug}/donate-now` returns config data.

---

## Phase 4: User Story 1 — Donor Makes a One-Time Donation (Priority: P1) 🎯 MVP

**Goal**: Public donate page renders with hero, tiers, and custom amount; donor can slide-to-donate, authenticate, and receive a successful charge.

**Independent Test**: Navigate to `http://localhost:5174/npo/demo-npo/donate-now`, select $50, slide to donate, log in, confirm — donation record created with `status=captured`.

### Implementation for User Story 1

- [ ] T033 [P] [US1] Implement public page data endpoint in `backend/app/api/v1/public_donate_now.py`: `GET /api/v1/npos/{npo_slug}/donate-now` — resolve NPO by slug, check `is_enabled`, return `DonateNowPagePublic` schema including tiers, social links (from existing NPO social links), upcoming event (nearest published event by date)
- [ ] T034 [P] [US1] Implement `DonateNowPagePublic`, `SupportWallEntryPublic`, `UpcomingEventSummary` Pydantic schemas in `backend/app/schemas/donate_now_config.py`
- [ ] T035 [P] [US1] Implement donation submission endpoint in `backend/app/api/v1/public_donate_now.py`: `POST /api/v1/npos/{npo_slug}/donate-now/donations` — auth required; validate amount; calculate processing fee; create `Donation` record (status=pending); call existing `PaymentGateway.charge(profile_id, amount_cents, idempotency_key)` if payment profile provided, else create HPF session; on success set `status=captured`; on decline return 422 with `PaymentDeclinedError`
- [ ] T036 [P] [US1] Implement donation Pydantic schemas in `backend/app/schemas/donation.py`: `DonationCreateRequest`, `DonationResponse`, `PaymentDeclinedError` (per contracts/donate-now.yaml)
- [ ] T037 [US1] Implement public page API client in `frontend/donor-pwa/src/api/donateNow.ts`: `getDonateNowPage(npoSlug)`, `submitDonation(npoSlug, request)` (typed with generated/manual request/response types)
- [ ] T038 [US1] Implement `DonateNowHeroSection` component in `frontend/donor-pwa/src/components/donate-now/DonateNowHeroSection.tsx`: thin wrapper over existing `EventHeroSection` adapting `hero_media_url` and `hero_transition_style` from config to the props `EventHeroSection` expects
- [ ] T039 [US1] Implement `DonationTierButtons` component in `frontend/donor-pwa/src/components/donate-now/DonationTierButtons.tsx`: one button per tier showing `amount_cents` formatted as currency and `impact_statement` below; "Custom Amount" button at end; clicking any button calls `onSelectAmount(amount_cents)` callback
- [ ] T040 [US1] Implement `DonationAmountSelector` component in `frontend/donor-pwa/src/components/donate-now/DonationAmountSelector.tsx`: modal/drawer (Radix Dialog) showing current amount as a large display; `-` / `+` step buttons (step = $1); free-form dollar amount input field; "Done" button closes and emits final amount; adapts existing `BidSliderModal` Radix Slider primitives
- [ ] T041 [US1] Implement `DonationSlider` component in `frontend/donor-pwa/src/components/donate-now/DonationSlider.tsx`: thin wrapper over existing `BidConfirmSlide` that accepts `amount_cents` and `is_monthly` props; label="$X" (one-time) or "$X Monthly" (recurring); calls `onSlideComplete` when fully swiped
- [ ] T042 [US1] Implement `DonationConfirmDialog` component in `frontend/donor-pwa/src/components/donate-now/DonationConfirmDialog.tsx`: Radix AlertDialog; shows amount, monthly indicator if applicable; "Cover processing fees" checkbox showing calculated fee amount (`amount * processing_fee_pct`); primary CTA "Confirm Donation"; payment decline error renders inline here (FR-017a); calls `onConfirm(coversProcessingFee: boolean)`
- [ ] T043 [US1] Implement `DonationSuccessOverlay` component in `frontend/donor-pwa/src/components/donate-now/DonationSuccessOverlay.tsx`: fullscreen overlay (Radix Dialog) with animated checkmark/confetti, thank-you message, "Close" button that dismisses without redirecting (FR-017b)
- [ ] T044 [US1] Implement `useDonateNow` hook in `frontend/donor-pwa/src/features/donate-now/useDonateNow.ts`: state machine managing: `idle → amount_selected → confirming → authenticating → submitting → success | declined`; exposes: `selectedAmount`, `setAmount`, `isMonthly`, `setMonthly`, `recurrenceStart`, `recurrenceEnd`, `submitDonation(coversProcessingFee)`, `status`, `error`
- [ ] T045 [US1] Implement public route in `frontend/donor-pwa/src/routes/npo.$slug.donate-now.tsx`: fetches page data via `getDonateNowPage(slug)` on load; renders hero, donate plea, tier buttons, amount selector, donation slider, confirm dialog, success overlay; handles auth gate (checks `useAuthStore`; if unauthenticated show existing login modal/redirect after `onConfirm`; if authenticated proceed directly per clarification Q3)
- [ ] T046 [US1] Wire `DonateNowPage` feature component in `frontend/donor-pwa/src/features/donate-now/DonateNowPage.tsx`: full authenticated donor view (same page, alternative render for logged-in state — shows saved payment profile option if profile exists)

**Checkpoint**: Full one-time donation flow works end-to-end: page load → tier select → slide → auth → confirm → success overlay.

---

## Phase 5: User Story 2 — Donor Sets Up a Monthly Recurring Donation (Priority: P1)

**Goal**: "Make this gift monthly" checkbox shows date pickers; recurring donation submitted with schedule; Celery task charges on anniversary dates.

**Independent Test**: Check "Make this gift monthly", set start = today + 1 day, no end date, slide and confirm — `donations` record has `is_monthly=true`, `recurrence_status=active`, `next_charge_date` set. Celery beat task charges it when `next_charge_date <= today`.

### Implementation for User Story 2

- [ ] T047 [P] [US2] Implement `MonthlyRecurrenceFields` component in `frontend/donor-pwa/src/components/donate-now/MonthlyRecurrenceFields.tsx`: "Make this gift monthly" checkbox; when checked, reveals "Starting:" date picker (defaults today) and "Continue until:" date picker (optional, no default — open-ended); past end dates rejected with inline error; "Continue until:" must be after "Starting:"; values surfaced via props `isMonthly`, `onMonthlyChange`, `recurrenceStart`, `onStartChange`, `recurrenceEnd`, `onEndChange`
- [ ] T048 [US2] Integrate `MonthlyRecurrenceFields` into the donate-now route/form in `frontend/donor-pwa/src/routes/npo.$slug.donate-now.tsx`: render below amount selector; wire state through `useDonateNow` hook; update `DonationSlider` label when `isMonthly=true`
- [ ] T049 [US2] Update `DonationCreateRequest` schema in `backend/app/schemas/donation.py` to validate: if `is_monthly=true` then `recurrence_start` defaults to today if null; `recurrence_end` if provided must be >= `recurrence_start + 30 days`
- [ ] T050 [US2] Implement recurring donation logic in donation submission endpoint in `backend/app/api/v1/public_donate_now.py`: when `is_monthly=true`, after successful initial charge set `recurrence_status='active'` and `next_charge_date = recurrence_start + 1 month`; store `payment_profile_id` (required for recurring — return 400 if no profile and no HPF yet)
- [ ] T051 [US2] Implement `RecurringDonationService` in `backend/app/services/recurring_donation_service.py`: `get_due_donations()` → query `donations WHERE is_monthly=true AND recurrence_status='active' AND next_charge_date <= today`; `charge_donation(donation_id)` → calls `DeluxePaymentGateway` with vault profile, creates new `PaymentTransaction`, advances `next_charge_date += 1 month`; handles end-date completion (set `recurrence_status='completed'`)
- [ ] T052 [US2] Implement Celery beat task in `backend/app/tasks/recurring_donation_tasks.py`: `process_monthly_donations()` task — calls `RecurringDonationService.get_due_donations()` then dispatches individual `charge_monthly_donation(donation_id)` sub-tasks with idempotency key `f"monthly-{donation_id}-{next_charge_date}"`; schedule: daily at 06:00 UTC; register in `backend/app/celery_app.py` beat schedule
- [ ] T053 [US2] Implement `POST /api/v1/npos/{npo_slug}/donate-now/donations/{donation_id}/cancel` endpoint in `backend/app/api/v1/public_donate_now.py`: auth + ownership check; set `recurrence_status='cancelled'`; return 409 if not an active recurring donation

**Checkpoint**: Monthly recurring donation submitted, `next_charge_date` set; Celery beat task processes due charges; cancellation endpoint works.

---

## Phase 6: User Story 3 — Donor Leaves a Support Wall Message (Priority: P2)

**Goal**: Donor can write a support wall message with anonymity/amount-display controls; message appears on the paginated auto-cycling wall after donation completes.

**Independent Test**: Complete a donation with a 150-char message, "Post anonymously" checked, "Show donation amount" unchecked → wall shows "Anonymous", no amount, correct relative timestamp. Admin hide → entry disappears from public wall.

### Implementation for User Story 3

- [ ] T054 [P] [US3] Implement support wall list endpoint in `backend/app/api/v1/public_donate_now.py`: `GET /api/v1/npos/{npo_slug}/donate-now/support-wall` — filter `is_hidden=false AND donation.status='captured'`, order by `created_at DESC`, paginate (default per_page=5, max 50); return `SupportWallPage` schema; compute `tier_label` by matching `amount_cents` against configured tiers
- [ ] T055 [P] [US3] Implement support wall Pydantic schemas in `backend/app/schemas/support_wall_entry.py`: `SupportWallEntryPublic`, `SupportWallPage`
- [ ] T056 [US3] Update donation submission in `backend/app/api/v1/public_donate_now.py`: after successful capture, if `support_wall_message` is non-null create `SupportWallEntry` record; `display_name` = donor's full name from user record; `is_hidden=false`
- [ ] T057 [P] [US3] Implement `SupportWallMessageForm` component in `frontend/donor-pwa/src/components/donate-now/SupportWallMessageForm.tsx`: `<textarea>` max 200 chars with live character counter; "Post anonymously" checkbox; "Show donation amount" checkbox (default checked); wire state via `useDonateNow` hook
- [ ] T058 [US3] Integrate `SupportWallMessageForm` into the donate-now route in `frontend/donor-pwa/src/routes/npo.$slug.donate-now.tsx`: render below the donation slider section; pass message/anon/showAmount values through to `submitDonation`
- [ ] T059 [P] [US3] Implement `SupportWallEntry` component in `frontend/donor-pwa/src/components/donate-now/SupportWallEntry.tsx`: card showing display name (or "Anonymous"), tier label badge (if any), optional dollar amount, message text, relative timestamp (`"3 days ago"` using `date-fns` or similar already in project)
- [ ] T060 [US3] Implement `SupportWall` component in `frontend/donor-pwa/src/components/donate-now/SupportWall.tsx`: fetches `getSupportWall(npoSlug, page)` on mount; renders 5 entries per page; manual prev/next pagination buttons always visible; auto-cycling: `setInterval` every 5 seconds advancing page, stops after page 3 (manual navigation overrides and stops auto-cycle); no pagination shown if ≤5 entries
- [ ] T061 [US3] Integrate `SupportWall` into donate-now route in `frontend/donor-pwa/src/routes/npo.$slug.donate-now.tsx`: render below NPO info section; refresh wall after successful donation to show new entry

**Checkpoint**: Support wall renders, paginates, auto-cycles. New donations with messages appear after submit. Anonymity and amount-display settings respected.

---

## Phase 7: User Story 5 — "Donate Now" Button on My Event Page (Priority: P2)

**Goal**: A "Donate Now" button appears on the donor's "My Event" page for NPOs with the feature enabled, linking to the donate page.

**Independent Test**: Open "My Event" for a demo event whose NPO has Donate Now enabled → button visible. Open for NPO without it enabled → button absent.

### Implementation for User Story 5

- [ ] T062 [US5] Add `donate_now_enabled` field to the existing event/NPO response or create a new enriched NPO field: in `backend/app/schemas/npo.py`, add `donate_now_slug: str | None = None` (non-null only when `donate_now_config.is_enabled=true`); update the NPO query used by the event home endpoint to join `donate_now_page_configs`
- [ ] T063 [US5] Add `Donate Now` button to the donor My Event page in `frontend/donor-pwa/src/features/events/EventHomePage.tsx`: conditionally render a "Donate Now" `<Link>` pointing to `/npo/{npo.donate_now_slug}/donate-now` only when `npo.donate_now_slug` is truthy; style consistent with existing CTA buttons on that page

**Checkpoint**: Button appears/disappears correctly based on NPO Donate Now enabled state; clicking navigates to the correct donate page.

---

## Phase 8: User Story 4 (continued) — Admin Support Wall Moderation (Priority: P2)

**Goal**: NPO admins can view all support wall entries (including hidden) and hide or restore individual entries.

**Independent Test**: Admin hides an entry → it disappears from public wall. Admin restores it → it reappears.

### Implementation

- [ ] T064 [P] [US4] Implement admin support wall list endpoint in `backend/app/api/v1/admin_donate_now.py`: `GET /api/v1/admin/npos/{npo_id}/donate-now/support-wall` with `include_hidden` query param; returns `AdminSupportWallPage` including `is_hidden` and `donor_user_id`
- [ ] T065 [P] [US4] Implement hide/restore endpoints in `backend/app/api/v1/admin_donate_now.py`: `POST /api/v1/admin/npos/{npo_id}/donate-now/support-wall/{entry_id}/hide`, `POST …/restore` — verify entry belongs to NPO; toggle `is_hidden`
- [ ] T066 [P] [US4] Implement admin support wall API client in `frontend/fundrbolt-admin/src/api/donateNow.ts`: `getAdminWall(npoId, page, includeHidden)`, `hideEntry(npoId, entryId)`, `restoreEntry(npoId, entryId)`
- [ ] T067 [US4] Implement `SupportWallModerationTable` component in `frontend/fundrbolt-admin/src/components/donate-now/SupportWallModerationTable.tsx`: table with columns: Display Name, Amount, Message, Date, Hidden status; Hide / Restore action button per row; pagination (20/page)
- [ ] T068 [US4] Implement support wall tab in `frontend/fundrbolt-admin/src/routes/npos/$npoId/donate-now/wall.tsx`: renders `SupportWallModerationTable`, fetches admin wall data, optimistic update on hide/restore clicks

**Checkpoint**: Admin can hide/restore wall entries; public wall reflects changes immediately.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: NPO info display, persistent page elements, OpenAPI docs, and final wiring.

- [ ] T069 [P] Add NPO info section to the donor donate-now route in `frontend/donor-pwa/src/routes/npo.$slug.donate-now.tsx`: render `npo_info_text` as a pre-wrapped `<p>` block below the support wall; only render if `npo_info_text` is non-null
- [ ] T070 [P] Add social links row to donate-now route in `frontend/donor-pwa/src/routes/npo.$slug.donate-now.tsx`: render the `social_links` array from page data as a horizontal row of social icon links; reuse existing social link icon component if available, otherwise create simple icon-href rows
- [ ] T071 [P] Add upcoming event button to donate-now route in `frontend/donor-pwa/src/routes/npo.$slug.donate-now.tsx`: if `upcoming_event` is non-null in page data, render a "View Upcoming Event: [name]" button linking to `/events/{upcoming_event.slug}`; styled as secondary CTA
- [ ] T072 [P] Add profile menu to donate-now route in `frontend/donor-pwa/src/routes/npo.$slug.donate-now.tsx`: reuse the existing profile menu component used on the event page; position top-right consistent with event page
- [ ] T073 [P] Add FundrBolt logo to donate-now route in `frontend/donor-pwa/src/routes/npo.$slug.donate-now.tsx`: render logo in the page footer; reuse existing footer/logo component if available
- [ ] T074 Add OpenAPI tags and operation summaries to all new endpoints in `backend/app/api/v1/public_donate_now.py` and `backend/app/api/v1/admin_donate_now.py`: ensure `tags=["Public Donate Now"]` / `tags=["Admin Donate Now"]` and meaningful `summary=` strings match contracts/donate-now.yaml
- [ ] T075 Add audit logging for donation events in `backend/app/api/v1/public_donate_now.py`: log to existing `audit_logs` table on donation submit, payment decline, and recurring cancellation (use existing audit log pattern from auth/payments)
- [ ] T076 Run full backend CI checks: `cd backend && poetry run ruff check . && poetry run ruff format --check . && poetry run mypy app --strict --ignore-missing-imports --exclude 'app/tests'` — fix all errors
- [ ] T077 Run full frontend CI checks for donor PWA: `cd frontend/donor-pwa && pnpm lint && pnpm format:check && pnpm build` — fix all errors
- [ ] T078 Run full frontend CI checks for admin PWA: `cd frontend/fundrbolt-admin && pnpm lint && pnpm format:check && pnpm build` — fix all errors
- [ ] T079 Validate end-to-end using quickstart.md: run through full donation flow per `specs/041-donate-now-page/quickstart.md`; confirm support wall, admin config, and monthly flow all work

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS** all user stories
- **Phase 3 (US4 Admin Config)**: After Phase 2 — implement first; donor page (US1) needs data to display
- **Phase 4 (US1 One-Time Donation)**: After Phase 2; can begin in parallel with Phase 3 on backend
- **Phase 5 (US2 Monthly Recurring)**: After Phase 4 — extends donation submit flow
- **Phase 6 (US3 Support Wall)**: After Phase 4 — extends submission + adds wall component; can overlap with Phase 5
- **Phase 7 (US5 Event Button)**: After Phase 2 — independent of US1–US3; can run in parallel with Phase 4–6
- **Phase 8 (Admin Moderation)**: After Phase 6 — needs wall entries to exist
- **Phase 9 (Polish)**: After all user story phases complete

### User Story Dependencies

| Story | Depends On | Can Parallelize With |
|-------|-----------|----------------------|
| US4 (Admin Config) | Phase 2 | US1 backend work |
| US1 (One-Time Donation) | Phase 2 + US4 (needs config) | US5 |
| US2 (Monthly Recurring) | US1 | US3 |
| US3 (Support Wall) | US1 | US2, US5 |
| US5 (Event Page Button) | Phase 2 | US1–US3 |

---

## Parallel Opportunities

### Within Phase 2 (Foundational)

```
# Can run simultaneously:
T012: DonateNowPageConfig model
T013: DonationTier model
T014: Donation model
T015: SupportWallEntry model
T016: NPO slug field
```

### Within Phase 3 (US4 Admin)

```
# Can run simultaneously:
T021: Backend Pydantic schemas
T022: DonateNowService
T025: Admin PWA API client
```

### Within Phase 4 (US1 Donor)

```
# Can run simultaneously:
T033: Public page endpoint
T034: Public page schemas
T035: Donation submit endpoint
T036: Donation schemas
T037: Donor PWA API client
T038: DonateNowHeroSection
T039: DonationTierButtons
T040: DonationAmountSelector
T041: DonationSlider
T042: DonationConfirmDialog
T043: DonationSuccessOverlay
```

### Within Phase 6 (US3 Support Wall)

```
# Can run simultaneously:
T054: Support wall API endpoint
T055: Support wall schemas
T057: SupportWallMessageForm (frontend)
T059: SupportWallEntry card (frontend)
```

---

## Implementation Strategy

### MVP (User Stories 4 + 1 only)

1. Phase 1: Setup scaffolding
2. Phase 2: Foundational (migrations + models)
3. Phase 3: Admin config — so the page has data
4. Phase 4: Donor one-time donation flow
5. **STOP AND VALIDATE**: Full one-time donation works end-to-end
6. Demo/deploy

### Full Delivery Order

1. Setup → Foundational → Admin Config → One-Time Donation (MVP)
2. Add Monthly Recurring (US2)
3. Add Support Wall (US3)
4. Add Event Page Button (US5) — can be done any time after Phase 2
5. Add Admin Moderation (US4 continued)
6. Polish

---

## Notes

- [P] tasks can be worked on simultaneously (different files)
- Each phase ends with a testable checkpoint — stop and validate before proceeding
- Commit after each logical task group using Conventional Commits (e.g., `feat(donate): add donation tiers model`)
- All backend tasks must pass mypy strict before marking complete
- Frontend tasks must produce no linting errors
- Use `make check-commits` before each commit to run pre-commit hooks
