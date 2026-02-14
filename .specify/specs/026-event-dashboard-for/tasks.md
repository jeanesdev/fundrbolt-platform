# Tasks: Event Dashboard for Admin PWA

**Input**: Design documents from `/specs/026-event-dashboard-for/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not requested in the feature specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create frontend feature folder and barrel file in frontend/fundrbolt-admin/src/features/event-dashboard/index.ts
- [ ] T002 Create backend API module file backend/app/api/admin/event_dashboard.py

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Define dashboard schemas in backend/app/schemas/event_dashboard.py (summary, sources, pacing, cashflow, waterfall, alerts, segments, projections)
- [ ] T004 Create service scaffolding in backend/app/services/event_dashboard_service.py (interfaces for summary, projections, segments)
- [ ] T005 Register admin dashboard routes in backend/app/api/admin/event_dashboard.py and include router in backend/app/api/admin/__init__.py
- [ ] T006 [P] Add API client module in frontend/fundrbolt-admin/src/services/event-dashboard.ts for dashboard, projections, segments endpoints
- [ ] T007 [P] Add React Query hooks in frontend/fundrbolt-admin/src/features/event-dashboard/hooks/useEventDashboard.ts
- [ ] T008 Add route shell in frontend/fundrbolt-admin/src/routes/admin/event-dashboard.tsx with role guard placeholder

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Monitor event performance at a glance (Priority: P1) 🎯 MVP

**Goal**: Provide a single dashboard view with totals, pacing, source breakdowns, and core visuals.

**Independent Test**: Open the Event Dashboard for an event and verify totals, goal comparison, pacing status, and source breakdowns render with live data and refresh.

### Implementation for User Story 1

- [ ] T009 [US1] Implement dashboard summary aggregation in backend/app/services/event_dashboard_service.py (totals, pacing, sources, waterfall, cashflow, alerts)
- [ ] T010 [US1] Implement GET /api/v1/admin/events/{event_id}/dashboard in backend/app/api/admin/event_dashboard.py
- [ ] T011 [US1] Create dashboard page layout in frontend/fundrbolt-admin/src/features/event-dashboard/pages/EventDashboardPage.tsx
- [ ] T012 [P] [US1] Add summary cards component in frontend/fundrbolt-admin/src/features/event-dashboard/components/SummaryCards.tsx
- [ ] T013 [P] [US1] Add revenue source breakdown chart in frontend/fundrbolt-admin/src/features/event-dashboard/components/SourceBreakdownChart.tsx
- [ ] T014 [P] [US1] Add pacing chart component in frontend/fundrbolt-admin/src/features/event-dashboard/components/PacingChart.tsx
- [ ] T015 [P] [US1] Add waterfall chart component in frontend/fundrbolt-admin/src/features/event-dashboard/components/WaterfallChart.tsx
- [ ] T016 [P] [US1] Add cashflow timeline component in frontend/fundrbolt-admin/src/features/event-dashboard/components/CashflowTimeline.tsx
- [ ] T017 [P] [US1] Add alert cards component in frontend/fundrbolt-admin/src/features/event-dashboard/components/AlertCards.tsx
- [ ] T018 [US1] Wire auto-refresh (60s) + manual refresh in frontend/fundrbolt-admin/src/features/event-dashboard/pages/EventDashboardPage.tsx
- [ ] T019 [US1] Add empty/error/loading states for summary in frontend/fundrbolt-admin/src/features/event-dashboard/pages/EventDashboardPage.tsx

**Checkpoint**: User Story 1 is fully functional and testable independently

---

## Phase 4: User Story 2 - Explore projections and what-if scenarios (Priority: P2)

**Goal**: Allow admins to adjust projections by source and compare scenarios.

**Independent Test**: Adjust a projection value and verify projected totals and variance update immediately for the selected scenario.

### Implementation for User Story 2

- [ ] T020 [US2] Implement projection adjustment logic in backend/app/services/event_dashboard_service.py
- [ ] T021 [US2] Implement GET/POST /api/v1/admin/events/{event_id}/dashboard/projections in backend/app/api/admin/event_dashboard.py
- [ ] T022 [US2] Add projection controls component in frontend/fundrbolt-admin/src/features/event-dashboard/components/ProjectionControls.tsx
- [ ] T023 [US2] Add scenario toggle component in frontend/fundrbolt-admin/src/features/event-dashboard/components/ScenarioToggle.tsx
- [ ] T024 [US2] Update summary calculations for projections in frontend/fundrbolt-admin/src/features/event-dashboard/pages/EventDashboardPage.tsx
- [ ] T025 [US2] Add projection reset handling in frontend/fundrbolt-admin/src/features/event-dashboard/components/ProjectionControls.tsx

**Checkpoint**: User Stories 1 and 2 work independently with projections updating totals

---

## Phase 5: User Story 3 - Drill into contributing segments (Priority: P3)

**Goal**: Provide drilldowns by table, guest, registrant plus guests, and company.

**Independent Test**: Select each segment type and verify rankings render and respect filters.

### Implementation for User Story 3

- [ ] T026 [US3] Implement segment aggregation logic in backend/app/services/event_dashboard_service.py
- [ ] T027 [US3] Implement GET /api/v1/admin/events/{event_id}/dashboard/segments in backend/app/api/admin/event_dashboard.py
- [ ] T028 [US3] Add segment drilldown container in frontend/fundrbolt-admin/src/features/event-dashboard/components/SegmentDrilldown.tsx
- [ ] T029 [P] [US3] Add leaderboard view in frontend/fundrbolt-admin/src/features/event-dashboard/components/SegmentLeaderboard.tsx
- [ ] T030 [P] [US3] Add heatmap view in frontend/fundrbolt-admin/src/features/event-dashboard/components/SegmentHeatmap.tsx
- [ ] T031 [US3] Wire segment filters and query params in frontend/fundrbolt-admin/src/features/event-dashboard/components/SegmentDrilldown.tsx

**Checkpoint**: All user stories are independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T032 [P] Add role guard enforcement in frontend/fundrbolt-admin/src/routes/admin/event-dashboard.tsx
- [ ] T033 Add navigation entry in frontend/fundrbolt-admin/src/components/nav/AdminSidebar.tsx
- [ ] T034 [P] Add refresh timestamp display in frontend/fundrbolt-admin/src/features/event-dashboard/components/LastRefreshed.tsx
- [ ] T035 Run quickstart flow validation against frontend/fundrbolt-admin/src/features/event-dashboard/pages/EventDashboardPage.tsx

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Uses projections endpoint but can be tested independently
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Independent segment drilldowns

### Within Each User Story

- Models/schemas before services
- Services before endpoints
- Endpoints before UI integration
- Story complete before moving to next priority

### Parallel Opportunities

- Phase 2 tasks T006 and T007 can run in parallel
- User Story 1 component tasks T012–T017 can run in parallel
- User Story 3 component tasks T029 and T030 can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch component tasks for User Story 1 together:
Task: "Add summary cards component in frontend/fundrbolt-admin/src/features/event-dashboard/components/SummaryCards.tsx"
Task: "Add revenue source breakdown chart in frontend/fundrbolt-admin/src/features/event-dashboard/components/SourceBreakdownChart.tsx"
Task: "Add pacing chart component in frontend/fundrbolt-admin/src/features/event-dashboard/components/PacingChart.tsx"
Task: "Add waterfall chart component in frontend/fundrbolt-admin/src/features/event-dashboard/components/WaterfallChart.tsx"
Task: "Add cashflow timeline component in frontend/fundrbolt-admin/src/features/event-dashboard/components/CashflowTimeline.tsx"
Task: "Add alert cards component in frontend/fundrbolt-admin/src/features/event-dashboard/components/AlertCards.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories

---

## Summary

- **Total tasks**: 35
- **By story**: US1 = 11, US2 = 6, US3 = 6
- **Parallel opportunities**: Phase 2 (T006–T007), US1 components (T012–T017), US3 components (T029–T030)
- **Independent tests**:
  - US1: Dashboard renders totals, pacing, breakdowns, and refresh
  - US2: Projection adjustments update totals and scenario state
  - US3: Segment drilldowns render and respect filters
- **Suggested MVP scope**: User Story 1 only
- **Format validation**: All tasks follow the checklist format with IDs, story labels (where required), and file paths
