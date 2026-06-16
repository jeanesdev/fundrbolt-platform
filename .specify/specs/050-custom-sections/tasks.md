# Tasks: Configurable Our Cause Card Sections

**Input**: Design documents from `.specify/specs/050-custom-sections/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/cause-section-cards.yaml ✅, quickstart.md ✅

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story [US1], [US2], [US3]

---

## Phase 1: Setup

**Purpose**: New file stubs and alembic migration skeleton

- [X] T001 Create backend model stubs: `backend/app/models/cause_section_card.py`
- [X] T002 [P] Create backend schema stubs: `backend/app/schemas/cause_section_card.py`
- [X] T003 [P] Create backend service stub: `backend/app/services/cause_section_card_service.py`
- [X] T004 [P] Create backend API router stub: `backend/app/api/v1/cause_section_cards.py`
- [X] T005 [P] Create admin PWA feature directory: `frontend/fundrbolt-admin/src/features/events/cause-sections/`
- [X] T006 [P] Create donor PWA feature directory: `frontend/donor-pwa/src/features/events/cause-sections/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database migration, model definitions, Pydantic schemas, and router registration — must complete before any user story work.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T007 Implement SQLAlchemy models (`EventCausePageConfig`, `CauseSectionCard`, `CauseSectionSlideItem`, `CauseSectionCardRevision`) in `backend/app/models/cause_section_card.py`
- [X] T008 Add model imports to `backend/app/models/__init__.py`
- [X] T009 Generate Alembic migration for the four new tables in `backend/alembic/versions/`
- [X] T010 Verify migration runs cleanly: `cd backend && poetry run alembic upgrade head`
- [X] T011 [P] Implement all Pydantic request/response schemas in `backend/app/schemas/cause_section_card.py` (CausePageConfigResponse, CauseSectionCardResponse, SlideItemResponse, CreateCardRequest, UpdateCardRequest, ReorderRequest, CreateSlideRequest, UpdateSlideRequest, SlideReorderRequest, PublishRequest, ConflictResponse)
- [X] T012 [P] Add HTML sanitisation helper in `backend/app/services/cause_section_card_service.py` (strip scripts and untrusted iframes from `content_html` and `overlay_html` before every write; use bleach or equivalent)
- [X] T013 [P] Add external URL validation helper in `backend/app/services/cause_section_card_service.py`: reject non-HTTPS schemes; resolve the hostname and reject private/loopback/link-local IP ranges (RFC 1918, 127.0.0.0/8, 169.254.0.0/16, ::1) to prevent SSRF. Do NOT make an outbound HTTP request — use DNS resolution only.
- [X] T014 Register `cause_section_cards` router in `backend/app/main.py`

**Checkpoint**: `poetry run alembic upgrade head` succeeds; FastAPI starts with new router mounted.

---

## Phase 3: User Story 1 — Create and Configure Custom Cards (Priority: P1) 🎯 MVP

**Goal**: Admin can create text, slideshow, and video cards; cards appear on the published Our Cause page after explicit publish.

**Independent Test**: Follow Scenarios 1–3 in `quickstart.md`. Creating, configuring, and publishing each card type works end-to-end. Donor PWA does not show new cards until after publish.

### Implementation — Backend

- [X] T015 [US1] Implement `get_or_create_config` in `backend/app/services/cause_section_card_service.py` (returns or seeds `EventCausePageConfig` for an event, including seeding the three built-in section cards on first creation)
- [X] T016 [US1] Implement `create_card` in service (validates card_type, sanitises content_html, validates video_url, appends to draft at end; bumps draft_version)
- [X] T017 [US1] Implement `update_card` in service (version check → update fields → sanitise/validate → bump draft_version)
- [X] T018 [US1] Implement `delete_card` in service (rejects built_in cards; bumps draft_version)
- [X] T019 [US1] Implement `publish` in service (version check → set `published_version = draft_version` on the config row → write revision record; no row copying needed — the donor public endpoint queries by `draft_version = published_version`)
- [X] T020 [US1] Implement `add_slide`, `update_slide`, `delete_slide` in service (version check; image variants require non-empty media_url; alt_text required for image variants)
- [X] T021 [US1] Wire `GET /admin/events/{event_id}/cause-page/config` endpoint in `backend/app/api/v1/cause_section_cards.py`
- [X] T022 [US1] Wire `GET /admin/events/{event_id}/cause-page/cards` endpoint
- [X] T023 [US1] Wire `POST /admin/events/{event_id}/cause-page/cards` endpoint
- [X] T024 [US1] Wire `PATCH /admin/events/{event_id}/cause-page/cards/{card_id}` endpoint
- [X] T025 [US1] Wire `DELETE /admin/events/{event_id}/cause-page/cards/{card_id}` endpoint
- [X] T026 [US1] Wire `POST /admin/events/{event_id}/cause-page/publish` endpoint
- [X] T026b [US1] Wire `GET /admin/events/{event_id}/cause-page/revisions` endpoint — lists `CauseSectionCardRevision` rows for audit history; implement corresponding service method in `backend/app/services/cause_section_card_service.py`
- [X] T027 [US1] Wire slide endpoints: `GET`, `POST` on `/cards/{card_id}/slides`; `PATCH`, `DELETE` on `/cards/{card_id}/slides/{slide_id}`
- [X] T028 [US1] Wire `GET /events/{event_id}/cause-page/cards` public endpoint (returns enabled cards from published snapshot only; query uses `WHERE draft_version = config.published_version`)

### Implementation — Admin PWA

- [X] T029 [US1] Create `frontend/fundrbolt-admin/src/services/cause-section-cards.ts` (API client wrapping all admin endpoints; includes draft_version in every mutating call)
- [X] T030 [US1] Create `CauseSectionsPage.tsx` in `frontend/fundrbolt-admin/src/features/events/cause-sections/` (main page: card list + publish button + unsaved-changes indicator)
- [X] T031 [US1] Create `CardEditor.tsx` — shared panel with card type selector, style controls (background/border colour token picker from curated palette, header toggle, collapsible toggle)
- [X] T032 [US1] Create `TextCardEditor.tsx` — TipTap WYSIWYG editor for `content_html`; sanitised on save
- [X] T033 [US1] Create `SlideshowCardEditor.tsx` — slide list, add/edit/delete slides, slide-type picker, media upload or external URL input per slide, alt-text field
- [X] T034 [US1] Create `VideoCardEditor.tsx` — URL input (upload or HTTPS), autoplay toggle, muted-by-default toggle
- [X] T035 [US1] Add route to admin PWA for cause-sections page (under event workspace, e.g., `frontend/fundrbolt-admin/src/routes/`)
- [X] T035b [US1] Create `CauseSectionsPreview.tsx` in `frontend/fundrbolt-admin/src/features/events/cause-sections/` — inline preview panel (no iframe required) that renders the donor-side card layout using current draft data; accessible from `CauseSectionsPage.tsx` via a Preview button (satisfies FR-014)
- [X] T036 [US1] Add "Our Cause" navigation item to event sidebar in admin PWA layout

### Implementation — Donor PWA

- [X] T037 [US1] Create `frontend/donor-pwa/src/lib/api/cause-section-cards.ts` (API client for public endpoint)
- [X] T038 [US1] Create `TextCard.tsx` in `frontend/donor-pwa/src/features/events/cause-sections/` (renders sanitised HTML with card wrapper, optional header, collapsible support, background/border tokens)
- [X] T039 [US1] Create `SlideshowCard.tsx` (renders slides with Embla carousel; image-only, text-over-image, text-only variants; accessible alt text)
- [X] T040 [US1] Create `VideoCard.tsx` (renders video with autoplay/muted settings; fallback error state if media unavailable)
- [X] T041 [US1] Create `CauseSectionsRenderer.tsx` — fetches published cards, renders ordered list of typed card components; skips disabled cards; built-in keys render existing components (`EventDetails`, `SponsorsCarousel`, etc.)
- [X] T042 [US1] Integrate `CauseSectionsRenderer` into `frontend/donor-pwa/src/routes/events.$slug.index.tsx` (replace or wrap existing hardcoded sections where applicable)

**Checkpoint**: Scenarios 1–3 from `quickstart.md` pass. Donor PWA shows no change until publish.

---

## Phase 4: User Story 2 — Control Presentation and Layout (Priority: P2)

**Goal**: Admin can reorder all cards (custom + built-in), enable/disable any card, and configure card styling. Changes persist and are reflected on the published Our Cause page.

**Independent Test**: Follow Scenario 4 in `quickstart.md`. Drag-reorder, toggle visibility, publish — donor PWA shows exact new order with disabled card hidden.

### Implementation — Backend

- [X] T043 [US2] Implement `reorder_cards` in service (version check; full list of IDs → update display_order for each; bump draft_version; reject if IDs don't match current draft cards)
- [X] T044 [US2] Wire `PATCH /admin/events/{event_id}/cause-page/cards/reorder` endpoint

### Implementation — Admin PWA

- [X] T045 [US2] Add drag-and-drop reorder to `CardList.tsx` using `@dnd-kit/core` (keyboard-accessible drag handles; WCAG 2.1 AA; sends reorder bulk PATCH on drop)
- [X] T046 [US2] Add enable/disable toggle to each card row in `CardList.tsx` (fires `PATCH /cards/{card_id}` with `is_enabled` and current `draft_version`)
- [X] T047 [US2] Add visual diff indicator on `CauseSectionsPage.tsx` showing "unsaved draft" when draft differs from published (compare `draft_version` vs `published_version`)
- [X] T048 [US2] Connect conflict detection: if any mutating API call returns 409, show a conflict resolution modal in `CauseSectionsPage.tsx` that (a) summarises what changed on the server since the client's version, (b) offers "Keep my changes (overwrite server draft)" and "Discard my changes (reload server draft)" options; re-fetch `draft_version` before applying the chosen resolution (satisfies FR-018, FR-019)

**Checkpoint**: Scenario 4 from `quickstart.md` passes. Scenario 6 (conflict) also passes.

---

## Phase 5: User Story 3 — Manage Built-In Sections as Cards (Priority: P3)

**Goal**: Built-in sections (About, Sponsors, Event Details) appear in the card list and respond to the same ordering, enable/disable, and style controls as custom cards.

**Independent Test**: Follow Scenario 5 in `quickstart.md`. Fresh event auto-seeds built-in cards; reorder/disable and publish; donor PWA reflects changes.

### Implementation — Backend

- [X] T049 [US3] Ensure `get_or_create_config` seeds three built-in cards (`about`, `sponsors`, `event_details`) when first called for an event (done in T015; verify correct seeding logic and idempotency)
- [X] T050 [US3] Enforce that built-in cards cannot be deleted via `DELETE /cards/{card_id}` — return 422 with clear error message

### Implementation — Admin PWA

- [X] T051 [US3] Render built-in card rows in `CardList.tsx` with a "Built-in" badge and no delete button; all other controls (reorder, enable/disable, style) remain available
- [X] T052 [US3] Display the built-in section key as a read-only label in the card editor (not editable)

### Implementation — Donor PWA

- [X] T053 [US3] In `CauseSectionsRenderer.tsx`, switch on `built_in_section_key` to render existing donor PWA components (`EventDetails`, `SponsorsCarousel`, About section) inside the card wrapper with configured styling

**Checkpoint**: Scenario 5 from `quickstart.md` passes. Built-in sections follow the same layout order as custom cards.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T054 [P] _(Moved to T035b in Phase 3 — see above)_
- [X] T055 [P] Ensure all card wrapper components (donor PWA) meet WCAG 2.1 AA: collapsible sections use `<details>`/`<summary>` or equivalent ARIA; carousels have accessible next/prev controls; images have `alt` from `alt_text` field
- [X] T056 [P] Add keyboard-accessible drag handles in admin `CardList.tsx` (`aria-roledescription="sortable"`, keyboard up/down reorder) per WCAG 2.1 AA (2.1.1)
- [X] T057 [P] Ensure the curated colour token palette in `CardEditor.tsx` uses only tokens with verified contrast ratio ≥ 4.5:1 against default text colour
- [X] T058 Run Scenario 7 (sanitisation) from `quickstart.md` against deployed backend and confirm script injection is blocked
- [X] T058b [P] Add colour-token allowlist validation to `CreateCardRequest` and `UpdateCardRequest` Pydantic schemas in `backend/app/schemas/cause_section_card.py`; valid values are a fixed set of Tailwind semantic tokens with verified ≥4.5:1 contrast (e.g., `slate-50`, `slate-100`, `white`, `transparent`); return 422 for unknown tokens
- [X] T059 [P] Update backend OpenAPI tags in `backend/app/api/v1/cause_section_cards.py` to match `contracts/cause-section-cards.yaml`
- [X] T060 [P] Add `cause_section_card` to `backend/app/models/__init__.py` re-exports and verify mypy passes: `cd backend && poetry run mypy app --strict --ignore-missing-imports --exclude 'app/tests'`
- [X] T061 [P] Run full backend CI: `cd backend && poetry run ruff check . && poetry run ruff format --check . && poetry run pytest -v --tb=short`
- [X] T062 [P] Run frontend CI for admin PWA: `cd frontend/fundrbolt-admin && pnpm lint && pnpm format:check && pnpm build`
- [X] T063 [P] Run frontend CI for donor PWA: `cd frontend/donor-pwa && pnpm lint && pnpm format:check && pnpm build`

---

## Deferred / Parking Lot

| Item | Reason | Revisit When |
|------|--------|--------------|
| Duplicate card (`POST /cards/{card_id}/duplicate`) — note: FR-001 has been updated to SHOULD for this capability | No task added to keep Phase 3 MVP tight; low user impact vs build cost | After Phase 3 ships and admin feedback gathered |

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories
- **Phase 3 (US1)**: Depends on Phase 2 — delivers MVP
- **Phase 4 (US2)**: Depends on Phase 2; integrates with Phase 3 components
- **Phase 5 (US3)**: Depends on Phase 2; builds on Phase 3 infrastructure (CauseSectionsRenderer)
- **Phase 6 (Polish)**: Depends on Phases 3–5 being substantially complete

### Parallel Opportunities

```
Phase 1: T001 | T002 T003 T004 T005 T006 (all parallel)
Phase 2: T007 → T008 → T009 → T010 (sequential); T011 T012 T013 (parallel with T007)
Phase 3 backend: T015-T020 (sequential), T021-T028 (parallel per endpoint)
Phase 3 frontend: T029-T036 (admin), T037-T042 (donor) — run in parallel with backend
Phase 4+5: Can start as soon as Phase 2 completes (independent of Phase 3 tasks)
```

### Implementation Strategy

**MVP = Phase 3 only**: Once Phase 2 is complete, Phase 3 delivers a fully working end-to-end feature (create card types, publish, render on donor page). Phases 4 and 5 add polish and built-in section management. Phase 6 hardens quality.
