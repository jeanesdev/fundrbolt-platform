# Implementation Tasks: Admin PWA Layout Redesign

**Feature**: 017-admin-pwa-layout
**Branch**: `017-admin-pwa-layout`
**Generated**: 2026-01-22
**Total Estimated Time**: 8-12 hours

## Task Organization

Tasks are organized by user story priority. Each user story represents an independently testable feature increment.

**Priority Legend**:
- **P1**: Critical path (MVP functionality - US1, US2, US3)
- **P2**: High value (Enhanced UX - US4, US5, US6)
- **P3**: Polish (Nice-to-have - US7)

**Parallel Opportunity**: Tasks marked with `[P]` can be executed in parallel with other `[P]` tasks in the same phase.

**Story Dependencies**:
- US2 depends on US1 (event selector needs foundational state)
- US3 depends on US2 (sidebar nav needs event context)
- US4, US5, US6 independent (can be implemented in parallel after US3)
- US7 independent (cleanup task)

---

## Phase 1: Foundational Setup

### Infrastructure & State Management

- [X] [T001] [P1] [Setup] Create EventContext Zustand store in `frontend/fundrbolt-admin/src/stores/event-context-store.ts`
- [X] [T002] [P1] [Setup] Implement smart default logic in EventContext store: prioritize active → upcoming → past events
- [X] [T003] [P1] [Setup] Add localStorage persistence for selected event (`fundrbolt-selected-event` key)
- [X] [T004] [P1] [Setup] Create useEventContext hook in `frontend/fundrbolt-admin/src/hooks/use-event-context.ts`
- [X] [T005] [P1] [Setup] Add event loading/clearing logic to handle NPO changes
- [X] [T006] [P] [Setup] Write unit tests for EventContext store in `frontend/fundrbolt-admin/src/stores/__tests__/event-context-store.test.ts`
- [X] [T007] [P] [Setup] Write unit tests for useEventContext hook in `frontend/fundrbolt-admin/src/hooks/__tests__/use-event-context.test.tsx`

**Verification Checklist**:
- [ ] EventContext store initializes with `selectedEventId = null`
- [ ] `applySmartDefault()` selects active event when available
- [ ] `applySmartDefault()` selects upcoming event when no active events
- [ ] `applySmartDefault()` selects most recent event when only past events
- [ ] Manual selection persists across page navigation
- [ ] localStorage clears on NPO change
- [ ] All unit tests pass

---

## Phase 2: US1 - Dashboard-First Navigation (Priority P1)

**User Story**: Admin users need quick access to their dashboard as the primary landing page after login, with all navigation consolidated in a single sidebar for simplified information architecture.

### Implementation Tasks

- [X] [T008] [P1] [US1] Update sidebar navigation data to add Dashboard as first item in `frontend/fundrbolt-admin/src/components/layout/data/sidebar-data.ts`
- [X] [T009] [P1] [US1] Add Dashboard route/icon to navigation structure (Home icon from lucide-react)
- [X] [T010] [P1] [US1] Update `app-sidebar.tsx` to render Dashboard link at top of navigation list in `frontend/fundrbolt-admin/src/components/layout/app-sidebar.tsx`
- [X] [T011] [P] [US1] Write component test for Dashboard link visibility in `frontend/fundrbolt-admin/src/components/layout/__tests__/app-sidebar.test.tsx`

**Verification Checklist**:
- [ ] Dashboard link appears as first sidebar item
- [ ] Dashboard link navigates to `/dashboard` route
- [ ] Dashboard icon renders correctly (Home icon)
- [ ] Collapsed sidebar shows tooltip "Dashboard" on hover

---

## Phase 3: US2 - Event Selector with Smart Defaults (Priority P1)

**User Story**: Admin users need to select an event to work with, and the system should intelligently default to the next active event or upcoming event to minimize clicks and reduce decision fatigue.

### Implementation Tasks

- [X] [T012] [P1] [US2] Create WCAG contrast utility in `frontend/fundrbolt-admin/src/lib/colors.ts`
- [X] [T013] [P1] [US2] Implement `calculateLuminance()` and `getContrastRatio()` functions for WCAG AA compliance
- [X] [T014] [P1] [US2] Create `useInitialAvatar` hook in `frontend/fundrbolt-admin/src/hooks/use-initial-avatar.ts`
- [X] [T015] [P1] [US2] Implement initial generation logic: extract 2 letters from name
- [X] [T016] [P1] [US2] Add auto-contrast text color logic (white/navy based on background luminance)
- [X] [T017] [P1] [US2] Create InitialAvatar component in `frontend/fundrbolt-admin/src/components/ui/initial-avatar.tsx`
- [X] [T018] [P1] [US2] Create EventSelector component in `frontend/fundrbolt-admin/src/components/layout/EventSelector.tsx`
- [X] [T019] [P1] [US2] Integrate useEventContext hook into EventSelector
- [X] [T020] [P1] [US2] Add Radix UI DropdownMenu structure (trigger + content)
- [X] [T021] [P1] [US2] Display event logo or InitialAvatar fallback for each event
- [X] [T022] [P1] [US2] Implement search/filter UI using Radix Command component (show when 10+ events)
- [X] [T023] [P1] [US2] Add event selection handler to update EventContext store
- [X] [T024] [P1] [US2] Filter events by currently selected NPO
- [X] [T025] [P1] [US2] Add EventSelector to AppSidebar below NpoSelector in `frontend/fundrbolt-admin/src/components/layout/app-sidebar.tsx`
- [X] [T026] [P] [US2] Write unit tests for WCAG contrast utilities in `frontend/fundrbolt-admin/src/lib/__tests__/colors.test.ts`
- [X] [T027] [P] [US2] Write unit tests for useInitialAvatar hook in `frontend/fundrbolt-admin/src/hooks/__tests__/use-initial-avatar.test.ts`
- [ ] [T028] [P] [US2] Write component tests for InitialAvatar in `frontend/fundrbolt-admin/src/components/ui/__tests__/initial-avatar.test.tsx`
- [ ] [T029] [P] [US2] Write component tests for EventSelector in `frontend/fundrbolt-admin/src/components/layout/__tests__/EventSelector.test.tsx`

**Verification Checklist**:
- [ ] EventSelector dropdown appears below NpoSelector in sidebar
- [ ] Smart default selects active event on load
- [ ] Smart default selects upcoming event when no active events
- [ ] Smart default selects most recent past event when no active/upcoming
- [ ] Search input appears when 10+ events exist
- [ ] Search filters events by name (case-insensitive)
- [ ] Event logos display when uploaded
- [ ] Initial avatars display with 2-letter initials when no logo
- [ ] All initial avatars meet WCAG AA contrast ratio (4.5:1 minimum)
- [ ] Clicking event updates selectedEventId in store
- [ ] Manual selection persists across navigation

---

## Phase 4: US3 - Event-Specific Navigation in Sidebar (Priority P1)

**User Story**: Admin users working on a specific event need quick access to all event-related sections (details, media, links, registrations, seating, tickets, sponsors, auction items) from the sidebar instead of horizontal tabs.

### Implementation Tasks

- [ ] [T030] [P1] [US3] Update `use-role-based-nav.ts` to add dynamic "Event: [Name]" navigation group in `frontend/fundrbolt-admin/src/hooks/use-role-based-nav.ts`
- [ ] [T031] [P1] [US3] Add conditional logic to show event group only when event is selected
- [ ] [T032] [P1] [US3] Define event navigation items: Details, Media, Links, Food Options, Registrations, Seating, Tickets, Sponsors, Auction Items
- [ ] [T033] [P1] [US3] Add icons for each event section (FileText, Image, Link2, Utensils, Users, LayoutGrid, Ticket, Award, Gavel)
- [ ] [T034] [P1] [US3] Add placeholder badge counts (will be replaced with real API data in Phase 5)
- [ ] [T035] [P1] [US3] Update NavGroup component to support collapsibility with localStorage persistence in `frontend/fundrbolt-admin/src/components/layout/nav-group.tsx`
- [ ] [T036] [P1] [US3] Add localStorage keys for each group: `fundrbolt-nav-group-{groupName}-collapsed`
- [ ] [T037] [P1] [US3] Default all groups to expanded state (collapsed = false)
- [ ] [T038] [P1] [US3] Remove horizontal tabs from event detail pages in `frontend/fundrbolt-admin/src/features/events/EventEditPage.tsx`
- [ ] [T039] [P1] [US3] Update event section routing to support sidebar navigation (nested routes)
- [ ] [T040] [P] [US3] Write unit tests for use-role-based-nav in `frontend/fundrbolt-admin/src/hooks/__tests__/use-role-based-nav.test.ts`
- [ ] [T041] [P] [US3] Write component tests for NavGroup collapsibility in `frontend/fundrbolt-admin/src/components/layout/__tests__/nav-group.test.tsx`

**Verification Checklist**:
- [ ] "Event: [Name]" group appears in sidebar when event selected
- [ ] Event group label updates when different event selected
- [ ] Event group disappears when no event selected
- [ ] All 9 event sections appear in navigation group
- [ ] Each section has appropriate icon
- [ ] Placeholder badge counts display correctly
- [ ] Clicking event section navigates to correct route
- [ ] Horizontal tabs removed from event pages
- [ ] Navigation groups persist collapsed/expanded state
- [ ] All groups default to expanded on first visit

---

## Phase 5: Backend API Integration

### Badge Count Endpoint

- [ ] [T042] [P2] [Backend] Create EventStatsResponse schema in `backend/app/schemas/event.py`
- [ ] [T043] [P2] [Backend] Add `GET /api/v1/events/{event_id}/stats` endpoint in `backend/app/api/v1/events.py`
- [ ] [T044] [P2] [Backend] Implement authorization check (event access via NPO membership)
- [ ] [T045] [P2] [Backend] Add efficient subqueries for badge counts: media, links, food options, sponsors, auction items, guests
- [ ] [T046] [P2] [Backend] Add optional search parameter to `GET /api/v1/events` endpoint in `backend/app/api/v1/events.py`
- [ ] [T047] [P2] [Backend] Implement case-insensitive search on event name/slug
- [ ] [T048] [P] [Backend] Write API tests for stats endpoint in `backend/app/tests/api/test_events.py`
- [ ] [T049] [P] [Backend] Write API tests for event list search in `backend/app/tests/api/test_events.py`

### Frontend Integration

- [ ] [T050] [P2] [Frontend] Create API client method for event stats in `frontend/fundrbolt-admin/src/lib/api/events.ts`
- [ ] [T051] [P2] [Frontend] Create React Query hook `useEventStats` in `frontend/fundrbolt-admin/src/hooks/use-event-stats.ts`
- [ ] [T052] [P2] [Frontend] Update use-role-based-nav to fetch and display real badge counts
- [ ] [T053] [P2] [Frontend] Add React Query invalidation on navigation to refresh counts
- [ ] [T054] [P2] [Frontend] Update EventSelector to use search parameter when 10+ events

**Verification Checklist**:
- [ ] Stats endpoint returns correct counts for all badge types
- [ ] Stats endpoint enforces authorization (403 for unauthorized users)
- [ ] Event list search filters correctly (case-insensitive)
- [ ] Badge counts update when navigating between pages
- [ ] Event search works in EventSelector dropdown at 10+ events
- [ ] All API tests pass

---

## Phase 6: US4 - Admin Subgroup Navigation (Priority P2)

**User Story**: Admin users with appropriate permissions need access to NPO management, event management (list of all events), and user management under a dedicated "Admin" section of the sidebar.

### Implementation Tasks

- [ ] [T055] [P2] [US4] Add "Admin" navigation group to sidebar-data in `frontend/fundrbolt-admin/src/components/layout/data/sidebar-data.ts`
- [ ] [T056] [P2] [US4] Add NPO management link (Settings icon) - visible only when "All Organizations" selected
- [ ] [T057] [P2] [US4] Add Events management link (Calendar icon) - visible to all admins
- [ ] [T058] [P2] [US4] Add Users management link (Users icon) - visible to all admins
- [ ] [T059] [P2] [US4] Update use-role-based-nav to conditionally show NPO link based on NPO context
- [ ] [T060] [P] [US4] Write component tests for Admin group visibility in `frontend/fundrbolt-admin/src/components/layout/__tests__/app-sidebar.test.tsx`

**Verification Checklist**:
- [ ] Admin group appears for users with admin permissions
- [ ] NPO link appears only when "Fundrbolt Platform All Organizations" selected
- [ ] NPO link hidden when specific NPO selected
- [ ] Events and Users links always visible to admins
- [ ] Non-admin users see no Admin group or only permitted items
- [ ] All links navigate to correct routes

---

## Phase 7: US5 - Event Display in Top Bar (Priority P2)

**User Story**: Admin users need to see the currently selected event prominently displayed in the top bar to maintain context awareness when working on event-specific tasks.

### Implementation Tasks

- [ ] [T061] [P2] [US5] Update Header component to display selected event name in `frontend/fundrbolt-admin/src/components/layout/header.tsx`
- [ ] [T062] [P2] [US5] Add useEventContext hook to Header component
- [ ] [T063] [P2] [US5] Style event name prominently (larger font, bold, or highlighted)
- [ ] [T064] [P2] [US5] Add text truncation with ellipsis for long event names
- [ ] [T065] [P2] [US5] Add tooltip showing full event name on hover
- [ ] [T066] [P2] [US5] Handle "No Event Selected" state gracefully
- [ ] [T067] [P] [US5] Write component tests for Header event display in `frontend/fundrbolt-admin/src/components/layout/__tests__/header.test.tsx`

**Verification Checklist**:
- [ ] Event name displays prominently in top bar when event selected
- [ ] Event name updates immediately when different event selected
- [ ] Long event names truncate with ellipsis
- [ ] Tooltip shows full name on hover
- [ ] "No Event Selected" or empty state when no event chosen
- [ ] Responsive layout works on mobile/tablet viewports

---

## Phase 8: US6 - Icon/Logo Fallbacks with Initials (Priority P2)

**User Story**: Admin users need visual identifiers (logos/icons) for NPOs and events in the selectors, with graceful fallbacks to initial-based avatars when no image has been uploaded.

### Implementation Tasks

- [ ] [T068] [P2] [US6] Update NpoSelector to use InitialAvatar fallback in `frontend/fundrbolt-admin/src/components/layout/NpoSelector.tsx`
- [ ] [T069] [P2] [US6] Add branding color integration: use primary branding color as avatar background
- [ ] [T070] [P2] [US6] Add border for navy-on-white theme when contrast insufficient
- [ ] [T071] [P2] [US6] Ensure EventSelector already uses InitialAvatar (implemented in Phase 3)
- [ ] [T072] [P] [US6] Write integration tests for logo/avatar fallback in `frontend/fundrbolt-admin/src/components/layout/__tests__/NpoSelector.test.tsx`
- [ ] [T073] [P] [US6] Write integration tests for logo/avatar fallback in `frontend/fundrbolt-admin/src/components/layout/__tests__/EventSelector.test.tsx`

**Verification Checklist**:
- [ ] NPO selector displays logo when uploaded
- [ ] NPO selector displays initial avatar when no logo
- [ ] Event selector displays image when uploaded
- [ ] Event selector displays initial avatar when no image
- [ ] All initial avatars use 2-letter initials (first letter of first two words)
- [ ] All initial avatars use branding primary color as background
- [ ] All initial avatars have sufficient contrast (WCAG AA)
- [ ] Navy-on-white theme adds border when needed

---

## Phase 9: US7 - Remove Redundant Header Elements (Priority P3)

**User Story**: Admin users on the settings pages should see a clean interface without duplicate navigation elements (hamburger menu, search bar) that are already present in the main application layout.

### Implementation Tasks

- [ ] [T074] [P3] [US7] Remove duplicate hamburger menu from settings pages in `frontend/fundrbolt-admin/src/features/settings/index.tsx`
- [ ] [T075] [P3] [US7] Remove duplicate search bar from settings pages
- [ ] [T076] [P3] [US7] Verify settings pages use only main layout navigation
- [ ] [T077] [P] [US7] Write visual regression tests for settings pages in `frontend/fundrbolt-admin/tests/e2e/settings.spec.ts`

**Verification Checklist**:
- [ ] Settings pages have no duplicate hamburger menu
- [ ] Settings pages have no duplicate search bar
- [ ] Settings pages use main layout navigation only
- [ ] Visual regression tests pass

---

## Phase 10: End-to-End Testing & Polish

### E2E Testing

- [ ] [T078] [P] [E2E] Write E2E test for dashboard-first navigation in `frontend/fundrbolt-admin/tests/e2e/navigation.spec.ts`
- [ ] [T079] [P] [E2E] Write E2E test for event selector smart defaults
- [ ] [T080] [P] [E2E] Write E2E test for sidebar event navigation flow
- [ ] [T081] [P] [E2E] Write E2E test for admin group visibility based on NPO selection
- [ ] [T082] [P] [E2E] Write E2E test for event name display in top bar
- [ ] [T083] [P] [E2E] Write E2E test for initial avatar generation and contrast

### Integration Testing

- [ ] [T084] [P] [Integration] Test full navigation flow: Login → Dashboard → Select NPO → Select Event → Navigate sections
- [ ] [T085] [P] [Integration] Test smart default logic with different event scenarios
- [ ] [T086] [P] [Integration] Test badge count updates on navigation
- [ ] [T087] [P] [Integration] Test navigation group persistence across sessions

### Polish & Refinement

- [ ] [T088] [Polish] Review all component styles for consistency with design system
- [ ] [T089] [Polish] Verify responsive layout on mobile/tablet/desktop
- [ ] [T090] [Polish] Add loading states to EventSelector dropdown
- [ ] [T091] [Polish] Add error states for failed event loading
- [ ] [T092] [Polish] Optimize badge count query performance (if needed)
- [ ] [T093] [Polish] Update documentation: User guide for new navigation structure
- [ ] [T094] [Polish] Update CHANGELOG.md with feature description

**Verification Checklist**:
- [ ] All E2E tests pass
- [ ] All integration tests pass
- [ ] No console errors or warnings
- [ ] Lighthouse accessibility score ≥90
- [ ] Mobile/tablet responsive layout works correctly
- [ ] All loading states display properly
- [ ] All error states display properly
- [ ] Documentation updated

---

## Success Criteria Validation

After implementation, verify all success criteria from spec.md:

- [ ] **SC-001**: Admin users can access dashboard in one click from any page
- [ ] **SC-002**: 90% of event-specific tasks begin with correct event selected (smart default success)
- [ ] **SC-003**: Time to navigate between event sections reduces by 40% (vs horizontal tabs)
- [ ] **SC-004**: Users can identify current event within 2 seconds (top bar display)
- [ ] **SC-005**: 95% of selectors display visual identifiers (logo or initial avatar)
- [ ] **SC-006**: All initial avatars meet WCAG AA contrast (4.5:1 minimum)
- [ ] **SC-007**: Zero duplicate navigation elements on settings pages
- [ ] **SC-008**: Users can switch events in under 3 clicks from any page

---

## Deployment Checklist

- [ ] All tests passing (unit + integration + E2E)
- [ ] No linting errors or warnings
- [ ] Type checking passes (`pnpm type-check`)
- [ ] Backend migrations applied (if any)
- [ ] Feature flag enabled (if applicable)
- [ ] Staging deployment successful
- [ ] Smoke tests pass in staging
- [ ] Production deployment approved
- [ ] Post-deployment monitoring (check for errors in Application Insights)
- [ ] User acceptance testing complete

---

## Rollback Plan

If critical issues arise after deployment:

1. **Immediate**: Feature flag disable (if implemented)
2. **Backend**: Revert to previous Docker image tag
3. **Frontend**: Deploy previous static web app version
4. **Database**: No rollback needed (no schema changes)
5. **Verification**: Run smoke tests to confirm rollback successful

---

## Task Summary

**Total Tasks**: 94
- **P1 (Critical)**: 41 tasks (US1, US2, US3)
- **P2 (High Value)**: 33 tasks (US4, US5, US6 + Backend)
- **P3 (Polish)**: 4 tasks (US7)
- **Testing**: 16 tasks (E2E + Integration)

**Parallel Opportunities**: 20 tasks marked `[P]` can be executed concurrently

**Estimated Time**: 8-12 hours (varies by developer experience)
