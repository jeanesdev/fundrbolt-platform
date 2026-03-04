# Tasks: Admin PWA Mobile & Tablet UI

**Input**: Design documents from `/specs/032-admin-pwa-mobile/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Unit and component tests for new hooks and shared components (constitution mandates testable code).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Frontend**: `frontend/fundrbolt-admin/src/`
- **Styles**: `frontend/fundrbolt-admin/src/styles/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: New hooks and shared utilities that multiple user stories depend on

- [x] T001 Create multi-tier breakpoint hook in `frontend/fundrbolt-admin/src/hooks/use-breakpoint.ts` — export `useBreakpoint()` returning `'phone' | 'tablet-portrait' | 'tablet-landscape' | 'desktop'` using `window.matchMedia` listeners for 768px, 1024px, 1367px thresholds. Also export `useIsTablet()` convenience helper returning `true` for both tablet tiers.
- [x] T002 Create per-page view preference hook in `frontend/fundrbolt-admin/src/hooks/use-view-preference.ts` — reads/writes `fundrbolt_view_prefs` JSON in localStorage keyed by current page path (from TanStack Router `useLocation`). Returns `[viewMode, setViewMode]` where default is `'card'` when breakpoint < tablet-landscape, `'table'` otherwise. Accepts a `pageKey` override parameter.
- [x] T003 [P] Create view toggle component in `frontend/fundrbolt-admin/src/components/data-table/view-toggle.tsx` — renders a two-button toggle group (LayoutGrid icon for card, Table icon for table) using existing Button component. Receives `value: 'table' | 'card'` and `onChange` callback. Highlights the active mode.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core card view component and wrapper that ALL table page integrations depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Create generic card view renderer in `frontend/fundrbolt-admin/src/components/data-table/card-view.tsx` — accepts a TanStack Table instance (`Table<TData>`), renders each row as a card. Card layout: 3–5 primary fields shown prominently (determined by column order, excluding `select` and `actions` columns), remaining fields in a collapsible "More details" section (use Radix Collapsible). Actions column renders as a dropdown menu in the card header. Each card has an optional selection checkbox. Uses responsive grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` for card layout.
- [x] T005 Create `DataTableWrapper` component in `frontend/fundrbolt-admin/src/components/data-table/data-table-wrapper.tsx` — generic wrapper that combines table view and card view with toggle logic. Props: `table` (TanStack Table instance), `viewPreferenceKey` (string for localStorage key), optional `renderCard` (custom card renderer for manual tables), optional `primaryFieldCount` (default 4). Renders: ViewToggle + either the existing table children or CardView based on current mode. Shares the toolbar, pagination, and bulk actions between both views.
- [x] T006 Export new components from `frontend/fundrbolt-admin/src/components/data-table/index.ts` — add exports for `DataTableCardView`, `DataTableViewToggle`, `DataTableWrapper`.

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 2b: Unit & Component Tests

**Purpose**: Satisfy constitution testing gate for new shared infrastructure

- [x] T046 [P] Write unit tests for `use-breakpoint.ts` — test all 4 breakpoint tiers with mocked `window.matchMedia`. Verify transitions between tiers fire the correct return value. Verify `useIsTablet()` returns `true` for both tablet tiers and `false` for phone/desktop. File: `frontend/fundrbolt-admin/src/hooks/__tests__/use-breakpoint.test.ts`
- [x] T047 [P] Write unit tests for `use-view-preference.ts` — test localStorage read/write, default value by breakpoint, explicit preference override, `pageKey` parameter. Mock `useLocation` from TanStack Router. File: `frontend/fundrbolt-admin/src/hooks/__tests__/use-view-preference.test.ts`
- [x] T048 [P] Write component tests for `view-toggle.tsx` — render with `value="table"` and `value="card"`, verify active state highlighting, verify `onChange` callback fires on click. File: `frontend/fundrbolt-admin/src/components/data-table/__tests__/view-toggle.test.tsx`
- [x] T049 [P] Write component tests for `card-view.tsx` — render with a mock TanStack Table instance, verify primary fields displayed, verify "More details" section toggles, verify action dropdown renders. Test empty state. File: `frontend/fundrbolt-admin/src/components/data-table/__tests__/card-view.test.tsx`
- [x] T050 [P] Write component tests for `data-table-wrapper.tsx` — render with children (table view) and `renderCards` callback, verify toggle switches between views, verify viewPreferenceKey integration with localStorage. File: `frontend/fundrbolt-admin/src/components/data-table/__tests__/data-table-wrapper.test.tsx`

---

## Phase 3: User Story 1 - Table/Card View Toggle on Narrow Screens (Priority: P1) 🎯 MVP

**Goal**: All 12 data table pages have a working table/card view toggle. Card view defaults on screens < 1024px. Per-page preference persists in localStorage.

**Independent Test**: Resize browser to < 1024px on any table page → toggle appears, card view is default, switching to table view persists across navigation.

### TanStack Table pages (have column definitions)

- [x] T007 [US1] Integrate `DataTableWrapper` into `frontend/fundrbolt-admin/src/features/users/components/users-table.tsx` — wrap existing table rendering with `DataTableWrapper`, passing the TanStack table instance and `viewPreferenceKey="users"`. Set primary fields: Name, Email, Role, Status (4 fields). Keep existing toolbar, pagination, and bulk actions.

### Manual table pages (need custom card renderers)

- [x] T008 [P] [US1] Add card view to `frontend/fundrbolt-admin/src/components/admin/AttendeeListTable.tsx` — add a `renderAttendeeCard` function that renders each attendee as a card with primary fields: Name, Type Badge, Bidder #, Status. "More" section: Email, Phone, Meal, Guest Of. **Nested guests (FR-014)**: if the attendee has associated guests (expandable rows in table view), render a collapsible "Guests (N)" section within the card that lists each guest as a compact sub-card or key-value row with name, meal, and status. Use Radix Collapsible for the expand/collapse interaction. Actions: same dropdown as table row. Use `useViewPreference('attendees')` and `ViewToggle` in the existing toolbar area. Conditionally render card grid or existing table based on view mode.
- [x] T009 [P] [US1] Add card view to `frontend/fundrbolt-admin/src/features/events/sections/EventCheckInSection.tsx` — add card rendering for check-in rows. Primary fields: Check-in checkbox, Name, Party Of, Table #. "More": Email, Phone, Bidder #, Checked In At, Confirmation Code. Use `useViewPreference('check-in')`.
- [x] T010 [P] [US1] Add card view to `frontend/fundrbolt-admin/src/features/events/auction-bids/AuctionBidsDashboard.tsx` — both the top bids table and all-bids table need card alternatives. Primary fields: Bidder, Item, Amount, Status. "More": Time. Use `useViewPreference('auction-bids')`.
- [x] T011 [P] [US1] Add card view to `frontend/fundrbolt-admin/src/features/events/tickets/components/TicketSalesTable.tsx` — primary fields: Purchaser, Package, Amount, Date. "More": Quantity, status details. Use `useViewPreference('ticket-sales')`.
- [x] T012 [P] [US1] Add card view to `frontend/fundrbolt-admin/src/features/npo-management/components/MemberList.tsx` — primary fields: Name, Email, Role, Joined. Actions: same as table. Use `useViewPreference('npo-members')`.
- [x] T013 [P] [US1] Add card view to `frontend/fundrbolt-admin/src/features/npo-management/components/PendingInvitations.tsx` — primary fields: Email, Role, Status, Invited date. Actions: resend/revoke. Use `useViewPreference('pending-invitations')`.
- [x] T014 [P] [US1] Add card view to `frontend/fundrbolt-admin/src/pages/admin/npo-applications.tsx` — primary fields: Organization, Email, Status, Submitted. Actions: approve/reject. Use `useViewPreference('npo-applications')`.
- [x] T015 [P] [US1] Add card view to `frontend/fundrbolt-admin/src/features/events/auction-items/components/EngagementPanel.tsx` — watcher list table. Primary fields: Watcher Name, Email, Added Date. Use `useViewPreference('engagement-watchers')`.

### Quick-entry tables (raw HTML tables)

- [x] T016 [P] [US1] Add card view to `frontend/fundrbolt-admin/src/features/quick-entry/components/PaddleRaiseEntryForm.tsx` — replace `min-w-[640px]` table with conditional card rendering below 1024px. Card: Amount (prominent), Bidder #, Donor name, Labels as badges, Time. Use `useViewPreference('paddle-raise-log')`.
- [x] T017 [P] [US1] Add card view to `frontend/fundrbolt-admin/src/features/quick-entry/components/BuyNowEntryForm.tsx` — replace min-width table with conditional card rendering. Card: Buyer, Item, Amount, Time. Use `useViewPreference('buy-now-log')`.
- [x] T018 [P] [US1] Add card view to `frontend/fundrbolt-admin/src/features/quick-entry/components/LiveBidLogAndMetrics.tsx` — bid log table. Card: compact horizontal format showing bid details. Use `useViewPreference('live-bid-log')`.

**Checkpoint**: All 12 table views have card/table toggle. This is the MVP — validate independently.

---

## Phase 4: User Story 2 - Collapsible Sidebar on Tablets (Priority: P1)

**Goal**: Sidebar defaults to collapsed icon-rail on tablet landscape, uses Sheet overlay on tablet portrait. Expand from icon-rail opens as overlay (not push) on tablets.

**Independent Test**: At 1024–1366px width, sidebar shows icon-rail only. Clicking a nav icon or toggle expands the sidebar as an overlay. At 768–1023px, sidebar is hidden; hamburger opens it as a Sheet.

- [x] T019 [US2] Modify `frontend/fundrbolt-admin/src/components/ui/sidebar.tsx` — update the mobile detection to treat tablet-portrait (768–1023px) the same as phone (Sheet mode). Change the inline sidebar CSS from `hidden md:block` / `hidden md:flex` to `hidden lg:block` / `hidden lg:flex` (1024px threshold). Import and use `useBreakpoint()` alongside `useIsMobile()`.
- [x] T020 [US2] Add tablet-landscape auto-collapse in `frontend/fundrbolt-admin/src/components/ui/sidebar.tsx` — in `SidebarProvider`, add an effect: when breakpoint is `'tablet-landscape'` and there's no stored sidebar_state cookie, default `open` to `false` (icon-rail). Preserve user's explicit toggle choice.
- [x] T021 [US2] Add overlay behavior for sidebar expansion on tablet landscape in `frontend/fundrbolt-admin/src/components/ui/sidebar.tsx` — when breakpoint is `'tablet-landscape'` and `open` transitions to `true`, render the sidebar with `position: fixed`, `z-50`, and a semi-transparent backdrop div. Clicking the backdrop or navigating collapses the sidebar back to icon-rail.
- [x] T022 [US2] Update `frontend/fundrbolt-admin/src/components/layout/authenticated-layout.tsx` — pass breakpoint-aware default to `SidebarProvider`'s `defaultOpen` prop: `false` for tablet-landscape, `true` for desktop, irrelevant for phone/tablet-portrait (Sheet mode).
- [x] T023 [US2] Update popover positioning in sidebar nav components — in `frontend/fundrbolt-admin/src/components/layout/nav-group.tsx`, `frontend/fundrbolt-admin/src/components/layout/NpoSelector.tsx`, and `frontend/fundrbolt-admin/src/components/layout/EventSelector.tsx`: change `isMobile` checks for popover `side` to also include tablet-portrait (use `useBreakpoint()` or updated `useSidebar().isMobile`).

**Checkpoint**: Sidebar works correctly across all 4 breakpoint tiers.

---

## Phase 5: User Story 3 - Touch-Friendly Interactive Elements (Priority: P2)

**Goal**: All interactive elements meet 44×44px minimum touch target on screens < 1366px.

**Independent Test**: In Chrome DevTools at 1024px width with touch simulation, all buttons, menu items, pagination controls, and card actions are comfortably tappable.

- [x] T024 [US3] Add touch target size utilities in `frontend/fundrbolt-admin/src/styles/index.css` — add a `@media (max-width: 1365px)` block that increases minimum sizes on: `button` (min-h-11 min-w-11), `[role="menuitem"]` (min-h-11), `[role="option"]` (min-h-11), `.pagination-link` or pagination control selectors (min-h-11 min-w-11, gap spacing). Use Tailwind `@apply` or raw CSS as appropriate.
- [x] T025 [P] [US3] Increase touch target sizes in pagination component at `frontend/fundrbolt-admin/src/components/data-table/pagination.tsx` — ensure page number buttons and prev/next buttons have `min-h-11 min-w-11` (44px) and adequate spacing (`gap-1` → `gap-2`) on screens < 1366px. Use responsive classes or the breakpoint hook.
- [x] T026 [P] [US3] Increase dropdown menu item sizes in card view actions — ensure action dropdown items in card view (`frontend/fundrbolt-admin/src/components/data-table/card-view.tsx`) have `min-h-11` and adequate padding for touch targets.
- [x] T027 [P] [US3] Audit and fix toolbar button sizes — ensure filter, sort, search, and bulk action buttons in `frontend/fundrbolt-admin/src/components/data-table/toolbar.tsx` and `frontend/fundrbolt-admin/src/components/data-table/bulk-actions.tsx` meet 44×44px minimum on tablet viewports.

**Checkpoint**: All interactive elements pass 44×44px target size on tablet viewports.

---

## Phase 6: User Story 4 - Responsive Form Layouts (Priority: P2)

**Goal**: Forms reflow to single-column on < 768px, two-column on 768–1024px, preserving multi-column on desktop.

**Independent Test**: Open event creation form at 800px width → two-column layout. At 600px → single-column. All fields are full-width within their column.

- [x] T028 [P] [US4] Audit and fix event creation/edit form layouts — search for multi-column grid/flex layouts in `frontend/fundrbolt-admin/src/features/events/` form components. Replace hardcoded `grid-cols-2` with responsive `grid-cols-1 md:grid-cols-2` where columns would be too narrow on tablet portrait. Ensure text inputs maintain 16px font size on narrow screens.
- [x] T029 [P] [US4] Audit and fix auction item form layouts — in `frontend/fundrbolt-admin/src/features/events/auction-items/` form components, ensure multi-column layouts reflow to single-column below 768px and two-column between 768–1024px.
- [x] T030 [P] [US4] Audit and fix ticket package form layouts — in `frontend/fundrbolt-admin/src/features/events/tickets/` form components, ensure responsive column reflow.
- [x] T031 [P] [US4] Audit and fix NPO creation/settings forms — in `frontend/fundrbolt-admin/src/pages/npo/` and `frontend/fundrbolt-admin/src/features/npo-management/` form components, ensure responsive column reflow.
- [x] T032 [US4] Verify 16px minimum font size rule in `frontend/fundrbolt-admin/src/styles/index.css` — confirm the existing `@media screen and (max-width: 767px)` rule with `font-size: 16px !important` on inputs covers all form elements (input, select, textarea). Extend to cover any missing selectors.

**Checkpoint**: All forms reflow correctly at tablet widths without cramped columns.

---

## Phase 7: User Story 5 - Responsive Dashboard and Summary Cards (Priority: P3)

**Goal**: Event dashboard stat cards and charts reflow to appropriate column counts on tablets without horizontal overflow.

**Independent Test**: Load event dashboard at 800px width → stat cards in 2-column grid, charts resize proportionally without horizontal scroll.

- [x] T033 [P] [US5] Update dashboard stat card grid in `frontend/fundrbolt-admin/src/features/event-dashboard/` — find the stat card grid container and change from fixed `grid-cols-4` (or similar) to responsive `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`. Ensure cards don't clip content at narrow widths.
- [x] T034 [P] [US5] Ensure chart containers are responsive in `frontend/fundrbolt-admin/src/features/event-dashboard/` — verify Recharts components use `ResponsiveContainer` with `width="100%"` and percentage heights. Remove any fixed pixel widths that would cause overflow on tablets. Ensure chart parent containers don't have `overflow: hidden` that clips labels.
- [x] T035 [US5] Verify no horizontal scroll on dashboard at tablet widths — test the full dashboard page at 768px and 1024px widths. Fix any remaining overflow issues (padding, margins, absolute-positioned elements).

**Checkpoint**: Dashboard displays correctly at all tablet widths.

---

## Phase 8: User Story 6 - Quick Entry Optimization for Tablets (Priority: P3)

**Goal**: Quick-entry interfaces (bid entry, paddle raise, buy now) are optimized for rapid touch input on tablets.

**Independent Test**: Open live bid entry at 1024px width → inputs and submit button are prominently sized, recent entries list is scannable without horizontal scroll.

- [x] T036 [P] [US6] Optimize bid entry form layout in `frontend/fundrbolt-admin/src/features/quick-entry/components/PaddleRaiseEntryForm.tsx` — increase input field sizes on tablet (larger font-size, taller min-height), ensure submit button is prominent (`h-14` or larger, full-width on portrait). Summary stats grid: change `md:grid-cols-4` to `sm:grid-cols-4` to take advantage of tablet width. Donation labels grid: `grid-cols-2 lg:grid-cols-3`.
- [x] T037 [P] [US6] Optimize buy-now entry form in `frontend/fundrbolt-admin/src/features/quick-entry/components/BuyNowEntryForm.tsx` — same touch-optimization pattern: larger inputs, prominent submit, responsive recent-entries list.
- [x] T038 [P] [US6] Optimize live bid entry form in `frontend/fundrbolt-admin/src/features/quick-entry/components/LiveBidLogAndMetrics.tsx` — ensure bid log metrics and entry form are touch-optimized with larger targets and responsive layout.
- [x] T039 [US6] Verify quick-entry parent layout is responsive — check the parent page/tab layout that wraps the quick-entry forms. Ensure entry type tabs and the form panel stack vertically on tablet portrait rather than side-by-side if space is insufficient.

**Checkpoint**: Quick-entry workflows are comfortable on tablets with rapid input capability.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, orientation handling, and final validation

- [x] T040 Handle orientation change edge case — verify that rotating a tablet mid-session (portrait ↔ landscape) triggers layout reflow via the `useBreakpoint` hook's `matchMedia` listeners without losing form data, scroll position, or sidebar state. Fix any components that don't reflow smoothly.
- [x] T041 Handle empty state in card view — ensure `DataTableCardView` and all custom card renderers display the same empty-state message as the table view when there are zero rows. Use the existing empty state patterns.
- [x] T042 Handle bulk selection in card view — ensure card view renders selection checkboxes on each card and that the `DataTableBulkActions` toolbar displays correctly above the card grid when items are selected.
- [x] T043 [P] Verify sidebar transition on orientation change — test that the sidebar correctly transitions from icon-rail (landscape) to Sheet overlay (portrait) and back without content jumps or stale state.
- [x] T044 Run quickstart.md validation — follow all test scenarios in `quickstart.md` at 768px, 1024px, and 1366px widths. Document any failures and fix.
- [x] T045 Run frontend CI checks — execute `pnpm lint`, `pnpm format:check`, and `pnpm build` from `frontend/fundrbolt-admin/`. Fix any type errors, lint warnings, or build failures introduced by this feature.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on T001, T002 from Phase 1 — BLOCKS all user stories
- **Tests (Phase 2b)**: Depends on Phase 2 completion (T004–T006). Can run in parallel with Phase 3+.
- **US1 (Phase 3)**: Depends on Phase 2 completion (T004–T006)
- **US2 (Phase 4)**: Depends on Phase 1 only (T001 — `useBreakpoint`). Independent of US1.
- **US3 (Phase 5)**: Independent of other stories. Can start after Phase 1.
- **US4 (Phase 6)**: Fully independent. Can start immediately (no new hooks needed).
- **US5 (Phase 7)**: Fully independent. Can start immediately.
- **US6 (Phase 8)**: Depends on Phase 1 (T002 — `useViewPreference` for card views in T016–T018). Card view tasks in Phase 3 can be done first or in parallel.
- **Polish (Phase 9)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 2 (card view component). Core MVP.
- **US2 (P1)**: Depends on Phase 1 (breakpoint hook). Independent of US1.
- **US3 (P2)**: Independent. Can proceed in parallel.
- **US4 (P2)**: Independent. Can proceed in parallel.
- **US5 (P3)**: Independent. Can proceed in parallel.
- **US6 (P3)**: Partially depends on US1 (card views for quick-entry tables).

### Within Each User Story

- Models/hooks before components
- Core components before per-page integrations
- Per-page integrations can run in parallel (marked [P])
- Story complete before moving to next priority

### Parallel Opportunities

- **Phase 1**: T003 can run in parallel with T001/T002 (different files)
- **Phase 3 (US1)**: T008–T018 are all [P] — 11 independent table integrations can run in parallel after T007
- **Phase 4 (US2)**: T019–T021 are sequential (same file); T022–T023 can follow in parallel
- **Phase 5 (US3)**: T025–T027 are all [P] — can run in parallel after T024
- **Phase 6 (US4)**: T028–T031 are all [P] — can run in parallel
- **Phase 7 (US5)**: T033–T034 are [P]
- **Phase 8 (US6)**: T036–T038 are [P]
- **US2 + US3 + US4 + US5**: Can all start in parallel after Phase 1, independent of Phase 2/US1

---

## Parallel Example: User Story 1

```bash
# After Phase 2 completes, launch all table integrations in parallel:
Task T007: "Integrate DataTableWrapper into users-table.tsx"
Task T008: "Add card view to AttendeeListTable.tsx"
Task T009: "Add card view to EventCheckInSection.tsx"
Task T010: "Add card view to AuctionBidsDashboard.tsx"
Task T011: "Add card view to TicketSalesTable.tsx"
Task T012: "Add card view to MemberList.tsx"
Task T013: "Add card view to PendingInvitations.tsx"
Task T014: "Add card view to npo-applications.tsx"
Task T015: "Add card view to EngagementPanel.tsx"
Task T016: "Add card view to PaddleRaiseEntryForm.tsx"
Task T017: "Add card view to BuyNowEntryForm.tsx"
Task T018: "Add card view to LiveBidLogAndMetrics.tsx"
# All 12 touch different files — full parallelism possible
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003) — hooks & toggle component
2. Complete Phase 2: Foundational (T004–T006) — card view component & wrapper
3. Complete Phase 3: User Story 1 (T007–T018) — integrate all 12 tables
4. **STOP and VALIDATE**: Test card/table toggle at 768px, 1024px, 1366px widths
5. Deploy/demo if ready — this alone delivers the highest-impact improvement

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 (card view toggle) → Test → Deploy/Demo (**MVP!**)
3. US2 (sidebar) → Test → Deploy/Demo
4. US3 (touch targets) + US4 (forms) → Test → Deploy/Demo (can parallel)
5. US5 (dashboard) + US6 (quick-entry) → Test → Deploy/Demo (can parallel)
6. Polish → Final validation → Deploy

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once ready:
   - Developer A: US1 (card view — 12 tables)
   - Developer B: US2 (sidebar) + US3 (touch targets)
   - Developer C: US4 (forms) + US5 (dashboard) + US6 (quick-entry)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No backend/API changes in this feature — frontend only
- No new npm dependencies expected; all needed components exist (Radix Collapsible, Lucide icons, etc.)
- iOS Safari is primary tablet target — test with 16px input font sizes
- localStorage key: `fundrbolt_view_prefs` — JSON object keyed by page path
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
