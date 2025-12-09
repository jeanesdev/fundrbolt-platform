# Tasks: Donor PWA Event Homepage

**Status**: ✅ COMPLETE - All 64 tasks implemented across 10 phases
**Input**: Design documents from `/specs/011-donor-pwa-event/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Backend tests passing (39 tests), frontend components implemented

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Backend**: `backend/app/` (Python/FastAPI)
- **Frontend**: `frontend/donor-pwa/src/` (React/TypeScript)
- **Tests**: `backend/app/tests/` and `frontend/donor-pwa/src/__tests__/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Schema definitions, type definitions, and shared utilities

- [x] T001 Create Pydantic schemas in `backend/app/schemas/event_with_branding.py` (RegisteredEventWithBranding, RegisteredEventsResponse)
- [x] T002 [P] Create TypeScript types in `frontend/donor-pwa/src/types/event-branding.ts` (RegisteredEventWithBranding, RegisteredEventsResponse)
- [x] T003 [P] Create TypeScript types in `frontend/donor-pwa/src/types/auction-gallery.ts` (AuctionItemGalleryItem, AuctionItemGalleryResponse, PaginationInfo)
- [x] T004 [P] Create event-home component directory `frontend/donor-pwa/src/components/event-home/` with index.ts barrel export

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core API endpoint and branding infrastructure that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Implement `get_registered_events_with_branding` service method in `backend/app/services/event_registration_service.py` with color fallback chain (event → NPO → defaults)
- [x] T006 Add `/registrations/events-with-branding` endpoint in `backend/app/api/v1/registrations.py`
- [x] T007 [P] Write API test `test_get_registered_events_with_branding_empty` in `backend/app/tests/api/test_registrations_branding.py`
- [x] T008 [P] Write API test `test_get_registered_events_with_branding_event_colors` in `backend/app/tests/api/test_registrations_branding.py`
- [x] T009 [P] Write API test `test_get_registered_events_sorted_correctly` in `backend/app/tests/api/test_registrations_branding.py`
- [x] T010 Create API client function `getRegisteredEventsWithBranding` in `frontend/donor-pwa/src/lib/api/registrations.ts`
- [x] T011 [P] Extend `useEventBranding` hook to inject `--event-background` and `--event-accent` CSS variables in `frontend/donor-pwa/src/hooks/use-event-branding.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Event-Centric Login Experience (Priority: P1) 🎯 MVP

**Goal**: Donors automatically directed to their next upcoming registered event's homepage with full branding applied

**Independent Test**: Log in as a donor with at least one event registration → verify redirect to event homepage with branding

### Implementation for User Story 1

- [x] T012 [US1] Create `EventHomePage.tsx` shell component in `frontend/donor-pwa/src/features/events/EventHomePage.tsx` with loading state and error handling
- [x] T013 [US1] Implement branding application in `EventHomePage.tsx` using `useEventBranding` hook with background color styling
- [x] T014 [US1] Update `frontend/donor-pwa/src/routes/_authenticated/home.tsx` to redirect to first registered event (use `getRegisteredEventsWithBranding` query)
- [x] T015 [US1] Update route at `frontend/donor-pwa/src/routes/_authenticated/events/$eventId/index.tsx` to render `EventHomePage` component
- [x] T016 [US1] Implement empty state in `EventHomePage.tsx` for donors with no registered events (welcoming message with guidance)
- [x] T017 [US1] Add page background styling with `style={{ backgroundColor: 'var(--event-background, #ffffff)' }}` in `EventHomePage.tsx`

**Checkpoint**: User Story 1 complete - donors land on branded event homepage

---

## Phase 4: User Story 2 - Event Switcher and Navigation (Priority: P1)

**Goal**: Multi-event donors can switch between events using dropdown in top navigation

**Independent Test**: Create user with multiple registrations → verify dropdown appears, shows all events, switches correctly with branding change

### Implementation for User Story 2

- [x] T018 [P] [US2] Create `EventSwitcher.tsx` component in `frontend/donor-pwa/src/components/event-home/EventSwitcher.tsx` using Radix DropdownMenu
- [x] T019 [US2] Implement event thumbnail display (event image → NPO logo fallback → initials) in `EventSwitcher.tsx`
- [x] T020 [US2] Implement conditional dropdown (only show if multiple events) in `EventSwitcher.tsx`
- [x] T021 [US2] Implement event sorting in dropdown (upcoming first by date ASC, then past by date DESC) - relies on backend sorting from T005
- [x] T022 [US2] Add "Past" badge indicator for past events in dropdown items
- [x] T023 [US2] Integrate `EventSwitcher` into `EventHomePage.tsx` header section with `onEventSelect` navigation handler
- [x] T024 [US2] Update `event-home/index.ts` barrel export to include `EventSwitcher`

**Checkpoint**: User Story 2 complete - multi-event donors can switch events seamlessly

---

## Phase 5: User Story 5 - Auction Items Gallery (Priority: P1)

**Goal**: Amazon-style gallery with infinite scroll, type filtering, proper sorting

**Independent Test**: View event with auction items → verify grid displays, filter toggles work, infinite scroll loads more items

### Backend Enhancement

- [x] T025 [US5] Add `sort_by` query parameter to auction items endpoint in `backend/app/api/v1/auction_items.py` (values: newest, highest_bid with highest_bid as default)
- [x] T026 [P] [US5] Add `auction_type` filter support for "all" value in auction items endpoint in `backend/app/api/v1/auction_items.py`
- [x] T027 [P] [US5] Write test `test_auction_items_filter_all` in `backend/app/tests/contract/test_auction_items_api.py`
- [x] T028 [P] [US5] Write test `test_auction_items_sort_highest_bid` in `backend/app/tests/contract/test_auction_items_api.py`

### Frontend Implementation

- [x] T029 [P] [US5] Create `AuctionItemCard.tsx` component in `frontend/donor-pwa/src/components/event-home/AuctionItemCard.tsx` with thumbnail, title, bid amount, bid button
- [x] T030 [US5] Create `AuctionGallery.tsx` component in `frontend/donor-pwa/src/components/event-home/AuctionGallery.tsx` with CSS Grid layout (min 2 columns, responsive)
- [x] T031 [US5] Implement `useInfiniteQuery` for pagination in `AuctionGallery.tsx` with native IntersectionObserver for scroll trigger
- [x] T032 [US5] Implement auction type filter toggle (All/Silent/Live) using button group in `AuctionGallery.tsx`
- [x] T033 [US5] Implement empty state "No auction items available yet" with Gavel icon in `AuctionGallery.tsx`
- [x] T034 [US5] Implement loading spinner for infinite scroll in `AuctionGallery.tsx`
- [x] T035 [US5] Integrate `AuctionGallery` into `EventHomePage.tsx` main content area
- [x] T036 [US5] ~~Update auction item service~~ Implemented inline in AuctionGallery.tsx with query params support (auction_type, sort_by, limit)
- [x] T037 [US5] Update `event-home/index.ts` barrel export to include `AuctionGallery` and `AuctionItemCard`

**Checkpoint**: User Story 5 complete - donors can browse and filter auction items with infinite scroll

---

## Phase 6: User Story 6 - Event-Branded Visual Theme (Priority: P1)

**Goal**: Full UI theming with event colors, NPO fallback, and zero Augeo branding

**Independent Test**: View events with different color schemes → verify CSS variables reflect branding, buttons/headers use theme colors

### Implementation for User Story 6

- [x] T038 [US6] Apply CSS variable consumption: `AuctionItemCard.tsx` uses `var(--event-primary)` for bid price/button, `EventHomePage.tsx` uses CSS vars for gradient/borders/icons
- [x] T039 [US6] Verify branding fallback chain works (event → NPO → system defaults) via existing T011 hook extension
- [x] T040 [US6] Add instant theme switch when event changes (applyBranding called in useEffect on currentEvent change) in `EventHomePage.tsx`
- [x] T041 [US6] Audit `EventHomePage.tsx` and child components - no Augeo branding references found in event-home components

**Checkpoint**: User Story 6 complete - event homepage is fully themed with event/NPO branding

---

## Phase 7: User Story 3 - Event Countdown Timer (Priority: P2)

**Goal**: Real-time countdown timer for future events with emphasized styling within 24 hours

**Independent Test**: View a future event → verify countdown displays and updates in real-time, disappears for past events

### Implementation for User Story 3

- [x] T042 [P] [US3] Create `useCountdown` hook in `frontend/donor-pwa/src/hooks/use-countdown.ts` with days/hours/minutes/seconds calculation and cleanup
- [x] T043 [US3] Create `CountdownTimer.tsx` component in `frontend/donor-pwa/src/components/event-home/CountdownTimer.tsx` with TimeUnit subcomponent
- [x] T044 [US3] Implement emphasized styling for events starting within 24 hours (scale-102, larger fonts, pulsing border within 1 hour) in `CountdownTimer.tsx`
- [x] T045 [US3] Implement automatic hide when countdown expires in `CountdownTimer.tsx`
- [x] T046 [US3] Integrate `CountdownTimer` into `EventHomePage.tsx` (show only if `!is_past`)
- [x] T047 [US3] Update `event-home/index.ts` barrel export to include `CountdownTimer`

**Checkpoint**: User Story 3 complete - future events show engaging countdown

---

## Phase 8: User Story 4 - Branded Event Details Section (Priority: P2)

**Goal**: Collapsible event details with venue, date/time, attire, contact - expanded by default for upcoming events

**Independent Test**: View upcoming event → details expanded, view past event → details collapsed, toggle works

### Implementation for User Story 4

- [x] T048 [P] [US4] Create `EventDetails.tsx` component in `frontend/donor-pwa/src/components/event-home/EventDetails.tsx` using Radix Collapsible
- [x] T049 [US4] Display venue name, address, date/time with timezone, attire requirements, and contact info in `EventDetails.tsx`
- [x] T050 [US4] Implement `defaultOpen` based on event timing (open if upcoming within 30 days, collapsed if past) in `EventDetails.tsx`
- [x] T051 [US4] Style collapsible trigger with chevron icon that rotates on open/close
- [x] T052 [US4] Integrate `EventDetails` into `EventHomePage.tsx` between countdown and auction gallery
- [x] T053 [US4] Update `event-home/index.ts` barrel export to include `EventDetails`

**Checkpoint**: User Story 4 complete - event information accessible but not overwhelming

---

## Phase 9: User Story 7 - Sidebar-Free Clean Layout (Priority: P2)

**Goal**: No sidebar, full viewport width for content, navigation via top bar/bottom nav

**Independent Test**: View event homepage on various device sizes → no sidebar visible, content uses full width

### Implementation for User Story 7

- [x] T054 [US7] Remove any sidebar components from event homepage layout in `EventHomePage.tsx`
- [x] T055 [US7] Ensure route layout does not include sidebar wrapper for event homepage route
- [x] T056 [US7] Verify mobile layout uses full viewport width with proper padding in `EventHomePage.tsx`
- [x] T057 [US7] Ensure primary navigation accessible via top bar (event switcher) and any existing bottom nav

**Checkpoint**: User Story 7 complete - clean, focused layout on all devices

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Final integration, testing, and cleanup

- [x] T058 [P] Run all backend tests: `cd backend && poetry run pytest app/tests/api/test_registrations_branding.py app/tests/api/test_auction_items_gallery.py -v`
- [x] T059 [P] Run quickstart.md testing checklist validation
- [x] T060 Verify edge cases: cancelled registration removal, invalid hex fallback, draft items hidden, countdown zero behavior
- [x] T061 [P] Test responsive grid breakpoints (320px to 1920px) for auction gallery
- [x] T062a [P] Run Lighthouse audit on event homepage, verify Performance score ≥80 and First Contentful Paint <1.5s
- [x] T062b [P] Add performance timing test: measure time from authenticated redirect to auction gallery render, assert <5s
- [x] T062c [P] Test page load on throttled network (Chrome DevTools "Fast 3G"), verify full render <3s
- [x] T063 Code cleanup: remove any console.logs, commented code, unused imports
- [x] T064 Update component barrel exports in `frontend/donor-pwa/src/components/event-home/index.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-9)**: All depend on Foundational phase completion
- **Polish (Phase 10)**: Depends on all user stories being complete

### User Story Dependencies

| User Story | Priority | Can Start After | Dependencies |
|------------|----------|-----------------|--------------|
| US1: Login Experience | P1 | Phase 2 (Foundational) | None |
| US2: Event Switcher | P1 | Phase 2 (Foundational) | None (can integrate with US1 after) |
| US5: Auction Gallery | P1 | Phase 2 (Foundational) | None |
| US6: Branded Theme | P1 | Phase 2 (Foundational) | US1 (builds on branding setup) |
| US3: Countdown Timer | P2 | Phase 2 (Foundational) | None |
| US4: Event Details | P2 | Phase 2 (Foundational) | None |
| US7: Clean Layout | P2 | Phase 2 (Foundational) | US1 (verifies layout) |

### Within Each User Story

- Backend tasks before frontend integration
- Models/types before services
- Components before page integration
- Core implementation before polish

### Parallel Opportunities

**Phase 1 (all can run in parallel)**:
```
T002, T003, T004 can run in parallel with T001
```

**Phase 2 (after T005-T006)**:
```
T007, T008, T009 can run in parallel (tests)
T010, T011 can run in parallel (frontend)
```

**After Foundational Complete - User Stories in Parallel**:
```
Team A: US1 (T012-T017) - MVP path
Team B: US5 (T025-T037) - Auction gallery
Team C: US3 (T042-T047) - Countdown timer
```

---

## Parallel Example: Phase 2 Foundational

```bash
# After T005-T006 (API endpoint):
# Launch all tests in parallel:
T007: "Write API test test_get_registered_events_with_branding_empty"
T008: "Write API test test_get_registered_events_with_branding_event_colors"
T009: "Write API test test_get_registered_events_sorted_correctly"

# Launch frontend foundation in parallel:
T010: "Create API client function getRegisteredEventsWithBranding"
T011: "Extend useEventBranding hook with background/accent CSS variables"
```

## Parallel Example: P1 User Stories

```bash
# After Phase 2 complete, run P1 stories in parallel:

# US1 (Login Experience):
T012: "Create EventHomePage.tsx shell component"
T013: "Implement branding application in EventHomePage"

# US5 (Auction Gallery) - can run simultaneously:
T029: "Create AuctionItemCard.tsx component"
T030: "Create AuctionGallery.tsx component"

# US2 (Event Switcher) - can run simultaneously:
T018: "Create EventSwitcher.tsx component"
```

---

## Implementation Strategy

### MVP First (User Story 1 + 5 + 6)

1. Complete Phase 1: Setup (T001-T004)
2. Complete Phase 2: Foundational (T005-T011) - **BLOCKS ALL STORIES**
3. Complete Phase 3: US1 - Event-Centric Login (T012-T017)
4. Complete Phase 5: US5 - Auction Gallery (T025-T037)
5. Complete Phase 6: US6 - Branded Theme (T038-T041)
6. **STOP and VALIDATE**: Core donor experience works
7. Deploy/demo if ready

### Incremental Delivery (P2 Stories)

8. Add US2: Event Switcher (T018-T024) → Multi-event support
9. Add US3: Countdown Timer (T042-T047) → Engagement feature
10. Add US4: Event Details (T048-T053) → Information completeness
11. Add US7: Clean Layout (T054-T057) → UX polish
12. Complete Phase 10: Polish (T058-T064)

---

## Notes

- All TypeScript components should use existing shadcn/ui primitives where available
- Branding colors MUST flow through CSS variables for instant switching
- Infinite scroll MUST use `@tanstack/react-query` useInfiniteQuery + Intersection Observer
- Backend tests use existing pytest fixtures from the project
- No new database tables required - extending existing models and endpoints
- MVP scope: US1 + US5 + US6 delivers core donor experience
