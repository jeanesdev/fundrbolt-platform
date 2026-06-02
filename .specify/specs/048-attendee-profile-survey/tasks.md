# Tasks: 048 Attendee Profile Survey

**Input**: Design documents from `/specs/048-attendee-profile-survey/`
**Branch**: `048-attendee-profile-survey`

---

## Phase 1: Foundational — Data Layer & Backend Scaffold

**Purpose**: All new DB models, schemas, migration, service stub, and router registration. Nothing else can proceed until complete.

- [ ] T001 Add `SURVEY_DISCOUNT = "survey_discount"` to `CheckoutItemSourceTypeEnum` in `backend/app/models/checkout_session.py`
- [ ] T002 [P] Add `is_system_default: bool` column (default `False`) to `DonorLabel` model in `backend/app/models/donor_label.py`
- [ ] T003 [P] Add `is_suggested: bool` (default `False`) and `source: str` (default `"manual"`, check in `('manual','survey_auto')`) columns to `DonorLabelAssignment` in `backend/app/models/donor_label_assignment.py`
- [ ] T004 [P] Create `backend/app/models/event_survey_config.py` — `EventSurveyConfig` model (fields: `event_id` FK UNIQUE, `is_active`, `modal_prompt_title` VARCHAR(200), `modal_prompt_body` VARCHAR(500), `discount_cents` INT ≥ 0 default 0); back-populates Event
- [ ] T005 [P] Create `backend/app/models/survey_question.py` — `SurveyQuestion` model (fields: `survey_config_id` FK, `text` VARCHAR(500), `display_order` INT, `is_active` BOOL default True)
- [ ] T006 [P] Create `backend/app/models/survey_question_option.py` — `SurveyQuestionOption` model (fields: `question_id` FK, `text` VARCHAR(300), `display_order` INT)
- [ ] T007 [P] Create `backend/app/models/survey_response.py` — `SurveyResponse` model (fields: `registration_id` FK UNIQUE, `survey_config_id` FK nullable SET NULL, `status` VARCHAR(20) check in `('completed','skipped')`, `discount_cents_applied` INT default 0, `completed_at` TIMESTAMPTZ nullable)
- [ ] T008 [P] Create `backend/app/models/survey_answer.py` — `SurveyAnswer` model (fields: `response_id` FK, `question_id` FK nullable SET NULL, `selected_option_id` FK→survey_question_options.id nullable SET NULL, `question_text_snapshot` VARCHAR(500) NOT NULL, `option_text_snapshot` VARCHAR(300) NOT NULL)
- [ ] T009 Update `backend/app/models/__init__.py` to import all 5 new models (also needed so Alembic autogenerates correctly)
- [ ] T010 Add `event_survey_config` relationship to `Event` model in `backend/app/models/event.py`
- [ ] T011 [P] Create `backend/app/schemas/survey.py` with all request/response schemas:
  - `SurveyQuestionOptionResponse`, `SurveyQuestionResponse`
  - `SurveyConfigResponse` (includes nested `questions`)
  - `SurveyConfigUpdateRequest` (partial fields; `modal_prompt_body` max_length=280 via Pydantic validator)
  - `SurveyQuestionOptionCreateRequest` (`text`, `display_order`)
  - `SurveyQuestionCreateRequest` (text, display_order, options: list, min 2 max 10 options validated via Pydantic validator)
  - `SurveyQuestionUpdateRequest` (text, display_order, is_active, options: list — min 2 max 10 when provided)
  - `DonorSurveyStatusResponse` (`should_show: bool`, `survey: SurveyConfigResponse | None`)
  - `DonorSurveyAnswerInput` (`question_id: UUID`, `option_id: UUID`)
  - `DonorSurveySubmitRequest` (`action: Literal["complete","skip"]`, `answers: list[DonorSurveyAnswerInput]`)
  - `DonorSurveySubmitResponse` (`status`, `discount_cents_applied`, `suggested_label_ids`)
  - `SurveyAnswerDetail` (`question_text`, `option_text`)
  - `SurveyResponseSummary` (for donor dashboard: `event_id`, `event_name`, `status`, `completed_at`, `discount_cents_applied`, `answers: list[SurveyAnswerDetail]`, `suggested_labels`)
  - `DonorSurveyAnswerRecord` (`user_id`, `question_id`, `option_text_snapshot`, `question_text_snapshot`) — for dashboard aggregate queries
- [ ] T012 [P] Extend `backend/app/schemas/donor_label.py`:
  - Add `is_system_default: bool` to `DonorLabelResponse`
  - Add `is_suggested: bool` and `source: str` to `DonorLabelAssignmentInfo`
  - New `DonorLabelWithAssignmentInfo` (used in donor dashboard donor profile)
- [ ] T013 Create `backend/alembic/versions/survey_001_add_survey_tables.py` — migration that:
  - Creates tables: `event_survey_configs`, `survey_questions`, `survey_question_options`, `survey_responses`, `survey_answers`
  - Alters `donor_labels`: ADD COLUMN `is_system_default BOOLEAN NOT NULL DEFAULT FALSE`
  - Alters `donor_label_assignments`: ADD COLUMN `is_suggested BOOLEAN NOT NULL DEFAULT FALSE`, ADD COLUMN `source VARCHAR(20) NOT NULL DEFAULT 'manual'`
  - Adds PostgreSQL CHECK constraint on `donor_label_assignments.source`
  - Extends PostgreSQL enum `checkoutitemsourcetype` with value `survey_discount` (use `ALTER TYPE ... ADD VALUE`)
  - Seeds 4 default labels per existing NPO (INSERT … SELECT from npos)
- [ ] T014 Create stub `backend/app/services/survey_service.py` with `SurveyService` class (async methods, takes `db: AsyncSession` in `__init__`)
- [ ] T015 [P] Create `backend/app/api/v1/admin_event_survey.py` router stub (prefix `/admin/events/{event_id}/survey`, tag `admin-event-survey`)
- [ ] T016 [P] Create `backend/app/api/v1/donor_survey.py` router stub (prefix `/donor/events/{event_id}/survey`, tag `donor-survey`)
- [ ] T017 Register both new routers in `backend/app/api/v1/__init__.py`
- [ ] T018 Run `cd backend && poetry run alembic upgrade head` to verify migration applies cleanly

---

## Phase 2: US1 — Survey Modal in Donor PWA (P1) 🎯 MVP

**Goal**: Donors see the survey modal on first event visit; can complete or skip.

**Prerequisite**: Phase 1 complete (DB tables exist).

**Independent Test**: Donor logs in, visits event — survey modal appears. Completing it stores answers. Refreshing doesn't show modal again.

### Backend

- [ ] T019 Implement `SurveyService.get_or_create_survey_config(event_id)` — creates default config (inactive) if none exists AND auto-seeds the 8 default questions+options on first creation (FR-005). Returns existing config unchanged on subsequent calls.
- [ ] T020 Implement `SurveyService.get_survey_status_for_donor(registration_id)` — returns `(should_show: bool, config: EventSurveyConfig | None)`. `should_show=True` only when: config `is_active=True`, has ≥1 active question with ≥2 options, no existing `SurveyResponse` for this registration
- [ ] T021 Implement `SurveyService.submit_survey_response(registration_id, action, answers)` — creates `SurveyResponse` + `SurveyAnswer` rows (with verbatim snapshots AND `selected_option_id` FK), returns `discount_cents_applied`. Raises `409` if response already exists. Does NOT apply discount here (checkout does that).
- [ ] T022 Implement `GET /donor/events/{event_id}/survey/status` endpoint in `donor_survey.py` — resolves `registration_id` from `event_id` + `current_user`, calls `get_survey_status_for_donor`, returns `DonorSurveyStatusResponse`
- [ ] T023 Implement `POST /donor/events/{event_id}/survey/response` endpoint in `donor_survey.py` — validates registration ownership, calls `submit_survey_response`, returns `DonorSurveySubmitResponse` (with `suggested_label_ids=[]` for now — label suggestion added in Phase 6)

### Frontend (Donor PWA)

- [ ] T024 Create `frontend/donor-pwa/src/lib/api/survey.ts` with:
  - `getSurveyStatus(eventId: string): Promise<DonorSurveyStatusResponse>`
  - `submitSurveyResponse(eventId: string, payload: DonorSurveySubmitRequest): Promise<DonorSurveySubmitResponse>`
  - TypeScript interfaces: `SurveyOption`, `SurveyQuestion`, `SurveyConfig`, `DonorSurveyStatusResponse`, `DonorSurveySubmitRequest`, `DonorSurveySubmitResponse`
- [ ] T025 Create `frontend/donor-pwa/src/hooks/use-survey-modal.ts` — queries `getSurveyStatus`, manages `isOpen`, `survey`, `hasLoaded` state. Exposes `open()`, `close()`, `submit()`, `skip()`. Uses `useQuery` for status fetch.
- [ ] T026 Create `frontend/donor-pwa/src/components/survey/SurveyModal.tsx` — full-screen Radix Dialog with:
  - Header: configurable `modal_prompt_title` + `modal_prompt_body`
  - If `discount_cents > 0`: highlight discount incentive (e.g. "Earn $20 off tonight!")
  - Question list: one radio group per question, single-select options
  - Progress indicator (question X of Y answered)
  - Footer: "Submit" (disabled until all active questions answered) + "Skip for now" link
  - Loading/submitting states
  - On submit: call `submitSurveyResponse`, show brief success toast, close
  - On skip: call with `{ action: "skip" }`, close
- [ ] T027 Integrate `useSurveyModal` into `frontend/donor-pwa/src/routes/events.$slug.index.tsx` — after auth + registration confirmed, auto-open survey modal if `should_show=true`; render `<SurveyModal>` below existing content

---

## Phase 3: US2 — Admin Survey Configuration (P1) 🎯 MVP

**Goal**: NPO admin can configure survey questions, options, prompt text, and discount amount in the Admin PWA.

**Independent Test**: Admin visits `/events/$eventId/survey`, creates/edits/deletes questions, enables survey.

### Backend

- [ ] T028 Implement `SurveyService.get_survey_for_admin(event_id)` — get-or-create config, eager-load questions + options (active only for donor, all for admin), ordered by `display_order`
- [ ] T029 Implement `SurveyService.update_survey_config(event_id, patch)` — update `is_active`, `modal_prompt_title`, `modal_prompt_body`, `discount_cents`
- [ ] T030 Implement `SurveyService.reset_to_default_questions(survey_config_id)` — deletes all existing questions and re-inserts the 8 default questions+options (used by "Reset to Defaults" admin button, separate from the auto-seed on first create in T019)
- [ ] T031 Implement `SurveyService.copy_survey_from_event(target_event_id, source_event_id)` — copies questions+options from source; clears existing questions first; resets `discount_cents=0`
- [ ] T032 Implement `SurveyService.add_question(survey_config_id, data)` — creates `SurveyQuestion` + `SurveyQuestionOption` rows
- [ ] T033 Implement `SurveyService.update_question(question_id, data)` — update text/display_order/is_active; for options: replace the option set (delete removed, upsert by id)
- [ ] T034 Implement `SurveyService.delete_question(question_id)` — hard delete the question. Answers referencing this question remain intact (their `question_id` FK is SET NULL, snapshots preserved). No 409 block — deletion is always allowed (per spec FR-008; historical data preserved via snapshots).
- [ ] T035 Wire up admin endpoints in `admin_event_survey.py`:
  - `GET /admin/events/{event_id}/survey` → `get_survey_for_admin` (auto-seeds on first call via get_or_create)
  - `PATCH /admin/events/{event_id}/survey` → `update_survey_config` (explicit save only; no auto-save behavior)
  - `POST /admin/events/{event_id}/survey/reset-defaults` → `reset_to_default_questions`
  - `POST /admin/events/{event_id}/survey/copy-from/{source_event_id}` → `copy_survey_from_event`
  - `POST /admin/events/{event_id}/survey/questions` → `add_question`
  - `PATCH /admin/events/{event_id}/survey/questions/{question_id}` → `update_question` (explicit save; UI sends full question state on save button click)
  - `DELETE /admin/events/{event_id}/survey/questions/{question_id}` → `delete_question`
  - All endpoints: verify admin owns the event (reuse `_require_event_access` pattern from other admin endpoints)

### Frontend (Admin PWA)

- [ ] T036 Create `frontend/fundrbolt-admin/src/routes/_authenticated/events/$eventId/survey.tsx` route file pointing to `EventSurveyPage`
- [ ] T037 Create `frontend/fundrbolt-admin/src/services/survey.ts` API client with methods for all admin survey endpoints + TypeScript interfaces
- [ ] T038 Create `frontend/fundrbolt-admin/src/features/events/survey/SurveyConfigForm.tsx` — form for `is_active` toggle, `modal_prompt_title`, `modal_prompt_body` (live character counter, max 280), `discount_cents` (dollars input → cents). Explicit **Save** button only — no auto-save on blur (FR-010). Live preview panel shows mock donor modal with current prompt text.
- [ ] T039 Create `frontend/fundrbolt-admin/src/features/events/survey/SurveyQuestionEditor.tsx` — inline editor for a single question: text field, options list (add/remove/reorder), is_active toggle, and explicit **Save** button per question. Changes are staged locally until Save is clicked (then PATCH endpoint called). DELETE button with confirmation.
- [ ] T040 Create `frontend/fundrbolt-admin/src/features/events/survey/SurveyQuestionList.tsx` — ordered list of `SurveyQuestionEditor` components; "Add Question" button (min 2, max 10 options enforced in UI); drag-to-reorder (or up/down arrows); "Reset to Defaults" button (calls reset-defaults endpoint with confirmation dialog); "Copy from Event" selector with event picker dropdown
- [ ] T041 Create `frontend/fundrbolt-admin/src/features/events/survey/EventSurveyPage.tsx` — composes `SurveyConfigForm` + `SurveyQuestionList`; page header "Attendee Survey"; loading/error states
- [ ] T042 Add "Survey" navigation entry to the event sidebar nav (same pattern as "Run of Show", "Revenue Generators" etc.) linking to `/events/$eventId/survey`

---

## Phase 4: US3 — Checkout Discount (P1) 🎯 MVP

**Goal**: Donors who complete the survey receive a discount as a visible line item in checkout.

**Prerequisite**: Phase 1 (SURVEY_DISCOUNT enum), Phase 2 (survey response with `discount_cents_applied` > 0).

**Independent Test**: Complete survey with discount > 0, then open checkout — a negative line item "Survey Discount" appears equal to the configured discount.

### Backend

- [ ] T043 Modify `CheckoutService.build_checkout_items_from_balance()` in `backend/app/services/checkout_service.py`:
  - After building all other items, query `SurveyResponse` for this event + user where `status='completed'` and `discount_cents_applied > 0`
  - If found and no existing `SURVEY_DISCOUNT` item: create a `CheckoutItem` with `source_type=SURVEY_DISCOUNT`, `source_id=survey_response.id`, `name="Profile Survey Discount"`, `original_amount_cents=-survey_response.discount_cents_applied`
  - Ensure the item is NOT re-added if already present (idempotent)
- [ ] T044 Ensure the negative `CheckoutItem` doesn't make `subtotal_cents` go below 0 — add guard in checkout totals recalculation: `subtotal = max(0, subtotal)` (defensive, since checkout could have been mostly paid already)

---

## Phase 5: US4 — Donor Dashboard Integration (P2)

**Goal**: Staff can see survey responses and labels in the Donor Dashboard leaderboard and donor profile panel.

**Prerequisite**: Phases 1–2 (survey responses exist in DB).

### Backend

- [ ] T045 Extend `DonorProfileResponse` schema in `backend/app/schemas/donor_dashboard.py` with:
  - `survey_responses: list[SurveyResponseSummary]` (from `survey.py` schemas)
  - `donor_labels: list[DonorLabelWithAssignmentInfo]` (includes `is_suggested`, `source`)
- [ ] T046 Extend `donor_dashboard_service.get_donor_profile(user_id, npo_id)` in `backend/app/services/donor_dashboard_service.py` to:
  - Load `SurveyResponse` rows for this user across all NPO events (join through EventRegistration), eager-load answers (with question+option snapshots) and suggested labels
  - Load `DonorLabelAssignment` rows for this user (joined to DonorLabel for NPO filtering), include `is_suggested`, `source`
- [ ] T047 Add new endpoint `GET /admin/events/{event_id}/survey/donor-answers` in `admin_event_survey.py` — returns all survey answers for the event as a 2D structure:
  - Response: `{ questions: [{id, text}], donors: [{user_id, name, answers: {question_id: option_text_snapshot}}] }`
  - Supports `sort_by_question_id` query param + `sort_order` (`asc`/`desc`)
  - Supports `filter_question_id` + `filter_option_text` query params for answer filtering
  - Used by Donor Dashboard to render dynamic survey columns
- [ ] T048 Extend `GET /admin/donor-dashboard/leaderboard` to support:
  - `label_ids` query param (multi-value, filter donors who have ALL listed labels assigned)
  - `survey_completed` query param (bool filter)
  - `survey_completed` and `donor_labels` fields in each `DonorLeaderboardItem`

### Frontend (Admin PWA)

- [ ] T049 Extend `frontend/fundrbolt-admin/src/features/donor-dashboard/components/DonorLeaderboard.tsx`:
  - Add "Labels" column showing label chips (is_suggested ones with dashed/amber border)
  - Add "Survey ✓" column with completion indicator
  - Add label filter UI (multi-select dropdown using existing labels from `/admin/npos/{npo_id}/donor-labels`) — passes `label_ids` query param to leaderboard API
- [ ] T050 Extend `frontend/fundrbolt-admin/src/features/donor-dashboard/components/DonorProfilePanel.tsx`:
  - Add "Survey Responses" section showing each event's survey status, answers, and discount applied
  - Add "Donor Labels" section: show assigned labels with `is_suggested` amber badge; per-suggestion "Confirm" button (sets `is_suggested=false` for that one label — see T053 updated API); per-label "Remove" button (calls PUT with label removed); "Add Label" picker; "Confirm All" bulk button
- [ ] T050b Fetch event-level survey answers via the new `GET /admin/events/{event_id}/survey/donor-answers` endpoint and render as dynamic columns in an additional "Survey Answers" tab in the Donor Dashboard, with column-level sort/filter controls

---

## Phase 6: US5 — Donor Category Labels (P2)

**Goal**: Auto-suggest donor category labels from survey answers; admins can confirm or manually assign.

**Prerequisite**: Phase 1 (donor_label extensions, 4 default labels seeded in migration), Phase 2 (survey responses).

### Backend

- [ ] T051 Implement `SurveyService._compute_suggested_labels(answers: list[SurveyAnswer], npo_id: UUID, db)` — keyword-matching logic against `option_text_snapshot` values, returns list of matching `DonorLabel.id` from the 4 system defaults for this NPO
- [ ] T052 Integrate label suggestion into `SurveyService.submit_survey_response()` — after saving response+answers, call `_compute_suggested_labels`, create `DonorLabelAssignment` rows with `is_suggested=True, source='survey_auto'` (skip if assignment already exists), return `suggested_label_ids` in response
- [ ] T053 Add label suggestion management to `admin_donor_labels.py`:
  - `PATCH /admin/npos/{npo_id}/donor-labels/users/{user_id}/suggestions/{label_id}/confirm` — confirms a single suggestion: sets `is_suggested=False, source='manual'` for that specific assignment
  - `DELETE /admin/npos/{npo_id}/donor-labels/users/{user_id}/suggestions/{label_id}` — dismisses a single suggestion: removes the `DonorLabelAssignment` entirely
  - `PATCH /admin/npos/{npo_id}/donor-labels/users/{user_id}/suggestions/confirm-all` — bulk confirm all pending suggestions for this user
- [ ] T054 Ensure new NPO creation seeds 4 default donor category labels — add a call in the NPO service (`backend/app/services/npo_service.py` or wherever NPO is created) to insert the 4 defaults after NPO commit
- [ ] T055 Update `DonorLabelResponse` serialization to include `is_system_default` (already added to model in T002, just ensure schema uses `from_attributes=True`)

### Frontend (Admin PWA)

- [ ] T056 Update `frontend/fundrbolt-admin/src/features/donor-dashboard/components/DonorProfilePanel.tsx` label management:
  - Show amber "Suggested" badge on `is_suggested=true` labels
  - Per-suggestion: "✓ Confirm" button → calls `confirm` endpoint for that label_id; "✗ Dismiss" button → calls dismiss DELETE endpoint for that label_id
  - "Confirm All Suggestions" bulk button → calls confirm-all endpoint, refetches donor profile
  - Label picker to manually add/remove labels (calls existing `PUT /admin/npos/{npo_id}/donor-labels/users/{user_id}`)
  - "Remove" (×) on confirmed/manual labels
- [ ] T057 Add label display to admin survey page `EventSurveyPage.tsx` — a read-only section "Category Mapping" explaining which answers map to which labels (static documentation, not editable)

---

## Phase 7: Cross-Cutting

- [ ] T058 Add `is_system_default` filter to `GET /admin/npos/{npo_id}/donor-labels` — add optional query param `?system_defaults_only=true` (used by admin survey page category mapping display)
- [ ] T059 Backend CI validation: `cd backend && poetry run ruff check . && poetry run ruff format --check . && poetry run mypy app --strict --ignore-missing-imports --exclude 'app/tests' && poetry run pytest -v --tb=short`
- [ ] T060 Frontend CI validation: `cd frontend/fundrbolt-admin && pnpm lint && pnpm format:check && pnpm build`
- [ ] T061 Donor PWA CI validation: `cd frontend/donor-pwa && pnpm lint && pnpm format:check && pnpm build` (if build scripts exist)
