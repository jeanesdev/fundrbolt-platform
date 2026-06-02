# Research Notes — 048 Attendee Profile Survey

## Codebase Investigation Summary

### 1. DonorLabel + DonorLabelAssignment — Already Exist
**Models:** `backend/app/models/donor_label.py`, `donor_label_assignment.py`
**API:** `backend/app/api/v1/admin_donor_labels.py` — full CRUD at `/admin/npos/{npo_id}/donor-labels`
**Schemas:** `backend/app/schemas/donor_label.py`

**Required extensions:**
- `DonorLabel`: add `is_system_default` boolean (so 4 category labels can be seeded and identified)
- `DonorLabelAssignment`: add `is_suggested` boolean (default `false`) and `source` enum (`survey_auto`, `manual`)
- Seed 4 default labels per NPO on first survey setup (via migration for existing NPOs + NPO create hook)
- Extend existing donor label assignment endpoint to accept `is_suggested` / `source`
- New endpoint: `PATCH /admin/npos/{npo_id}/donor-labels/users/{user_id}/confirm-suggestion` to promote `is_suggested=true` to confirmed

### 2. Checkout Line-Item Architecture
**Model:** `backend/app/models/checkout_session.py`
**Service:** `backend/app/services/checkout_service.py`

Key discovery: `CheckoutItemSourceTypeEnum` has these values: `auction_win`, `quick_entry_bid`, `quick_entry_donation`, `ticket`, `revenue_generator`, `manual`.

**Decision:** Add new enum value `SURVEY_DISCOUNT = "survey_discount"`. The survey discount is injected as a negative `CheckoutItem` (negative `original_amount_cents`) when `build_checkout_items_from_balance()` runs, keyed to the `SurveyResponse.id` as `source_id`. This ensures the discount appears as a line item visible to donor and admin.

**Also needed:** Checkout totals already handle the sum including negatives — `subtotal = sum(i.effective_amount_cents for i in active_items)`. No change needed to totals logic.

**Limitation (per clarification B):** Survey discount applies only to event-night charges — the checkout is scoped to event-night items already (ticket packages purchased pre-event are excluded from the main checkout flow). No additional filtering needed.

### 3. EventRegistration as Anchor
**Model:** `backend/app/models/event_registration.py`
- Unique constraint: `(user_id, event_id)`
- `SurveyResponse` will FK to `registration_id` (giving us user_id + event_id transitively)
- This also lets us look up "has this attendee completed the survey?" by joining to registration

### 4. Admin PWA Event Routes
**Pattern:** `frontend/fundrbolt-admin/src/routes/_authenticated/events/$eventId/<page>.tsx`
**Existing pages:** dashboard, details, edit, checkin, seating, sponsors, media, links, registrations, run-of-show, revenue-generators, notifications, payments, quick-entry, auction-items, auction-bids, tickets/...

**New page:** `survey.tsx` → `/events/$eventId/survey` route with `EventSurveyPage` component

**Navigation:** The event sidebar navigation is defined in event layout — same pattern as existing pages (look at how `seating.tsx` or `run-of-show.tsx` are wired into the event nav)

### 5. Donor PWA Event Home Page
**Route:** `frontend/donor-pwa/src/routes/events.$slug.index.tsx`
**Pattern:** Modal components are shown as overlays on the event home page (e.g., `AuctionItemDetailModal`, `BidSliderModal`)
**Auth:** `ProtectedRoute` wraps authenticated routes; `useAuthStore` gives `isAuthenticated`
**Decision:** Survey modal is triggered from `events.$slug.index.tsx` after the page loads, by checking a new `GET /api/v1/donor/events/{event_id}/survey/status` endpoint that returns `{ should_show: bool, survey: {...} | null }`. Uses a `useSurveyModal` hook with local state. Survey modal visibility stored in Zustand (not persisted, so refresh re-checks server).

### 6. Donor Dashboard Extension
**Backend:** `backend/app/api/v1/admin_donor_dashboard.py`, `backend/app/services/donor_dashboard_service.py`
**Schemas:** `backend/app/schemas/donor_dashboard.py` — `DonorProfileResponse` has `category_interests`, `bid_history`, etc.
**Frontend:** `frontend/fundrbolt-admin/src/features/donor-dashboard/` — tabs: Leaderboard, Outbid Leaders, Bid Wars, Categories; plus `DonorProfilePanel`

**Decision:** Extend `DonorLeaderboardResponse.items` to include `survey_completed_at`, `donor_motivation`, `top_category_suggestion`. Extend `DonorProfileResponse` to include `survey_responses: list[SurveyResponseSummary]` (event, completed_at, answers, suggested_labels). Add "Survey" data tab or section to `DonorProfilePanel`.

### 7. Admin Donor Labels in Dashboard
**Current state:** `DonorProfilePanel` likely shows a donor's label assignments but the detail hasn't been read. The label assignment is set via `PUT /admin/npos/{npo_id}/donor-labels/users/{user_id}`.

**Decision:** Add label management UI to `DonorProfilePanel` component — show current labels with `is_suggested` badges, quick-confirm buttons, and label picker. Reuse existing `PUT` assignment endpoint.

### 8. Default Survey Questions
**Decision:** Store 8 default questions with options as Python constants in the service layer (not DB seeded), injected when creating a new survey config if `create_defaults=true`. This avoids migration data + keeps them editable per event.

### 9. Tenant Isolation
- `EventSurveyConfig` → scoped to `event_id` (transitively to `npo_id` via Event)
- `SurveyResponse` → scoped to `registration_id` → `event_id` → `npo_id`
- `DonorLabel` (existing) → scoped to `npo_id`
- All admin API endpoints verify event ownership via existing `_require_event_access` pattern

### 10. Migration Naming Convention
Existing patterns in repo:
- Numeric: `053_add_paddle_raise_level_notes.py`
- Feature-prefixed: `ros_001_...`, `social_auth_003_...`, `sponsorship_001_...`

**Decision:** Use prefix `survey_001_` for initial migration.

## Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Discount integration | Negative `CheckoutItem` with `source_type=survey_discount` | Consistent with existing line-item model; visible to donor |
| Survey-to-user anchor | `SurveyResponse.registration_id` FK | Single FK gives both user + event context |
| Default questions | Python constants injected on first create | Avoids migration data; editable per event |
| Label auto-suggestion | Fire on `POST /donor/survey/response`, compute from answer patterns | Synchronous with submission; no background job needed |
| Label suggestion state | `is_suggested=true` on `DonorLabelAssignment` | Reuses existing join table; admin sees suggestion badge and confirms |
| Admin survey page | `/events/$eventId/survey` route (event-scoped) | Consistent with all other event sub-pages |
| Modal trigger | Server-side `should_show` check on event home mount | Handles skip/completed state server-side; survives app reload |
