# Tasks: Admin PWA UI Cleanup & Role-Based Access Control

**Feature**: 009-admin-pwa-ui
**Branch**: `009-admin-pwa-ui`
**Input**: Design documents from `.specify/specs/009-admin-pwa-ui/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: This feature does not explicitly request test generation. Tasks focus on implementation and manual validation per acceptance scenarios.

**Organization**: Tasks are grouped by user story (6 total: US1-US6) to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Frontend**: `frontend/augeo-admin/src/`
- **Backend**: `backend/app/`
- This is a web application (frontend + backend coordination)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and environment verification

- [ ] T001 Verify Node.js v22 and pnpm installed for frontend development
- [ ] T002 Verify Python 3.11+ and Poetry installed for backend development
- [ ] T003 [P] Install frontend dependencies in frontend/augeo-admin via pnpm install
- [ ] T004 [P] Install backend dependencies in backend via poetry install
- [ ] T005 [P] Verify PostgreSQL 15 database running with existing schema (users, roles, npos, events tables)
- [ ] T006 [P] Verify Redis 7 running on localhost:6379 for session management
- [ ] T007 Create database indexes for search optimization in backend/alembic/versions/
- [ ] T008 Seed test users with all roles (SuperAdmin, NPO Admin, Event Coordinator, Staff, Donor) for testing

**Checkpoint**: Development environment ready, dependencies installed, test data seeded

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T009 Create Zustand store for NPO context state in frontend/augeo-admin/src/stores/npo-context.ts
- [x] T010 [P] Create useAuth hook for accessing current user role in frontend/augeo-admin/src/hooks/useAuth.ts
- [x] T011 [P] Create useNpoContext hook wrapping store with query invalidation in frontend/augeo-admin/src/hooks/useNpoContext.ts
- [x] T012 [P] Create Zod validation schema for profile updates in frontend/augeo-admin/src/schemas/profile.ts
- [x] T013 Update authenticated route layout to support beforeLoad guards in frontend/augeo-admin/src/routes/_authenticated.tsx
- [x] T014 [P] Create base PermissionService for role-based filtering logic in backend/app/services/permission.py
- [x] T015 [P] Update User schema with ProfileUpdate validator in backend/app/schemas/user.py
- [x] T016 [P] Create SearchRequest and SearchResponse schemas in backend/app/schemas/search.py

**Checkpoint**: Foundation ready - all hooks, stores, and schemas in place. User story implementation can now begin.

---

## Phase 3: User Story 1 - Role-Based Dashboard Access (Priority: P1) 🎯 MVP

**Goal**: Users see role-appropriate dashboards and navigation on login, with proper access control preventing unauthorized data access.

**Independent Test**: Log in as each role (SuperAdmin, NPO Admin, Event Coordinator, Staff, Donor) and verify correct dashboard renders and navigation shows only authorized items.

### Implementation for User Story 1

- [x] T017 [P] [US1] Create SuperAdminDashboard component in frontend/augeo-admin/src/components/dashboards/SuperAdminDashboard.tsx
- [x] T018 [P] [US1] Create NpoAdminDashboard component in frontend/augeo-admin/src/components/dashboards/NpoAdminDashboard.tsx
- [x] T019 [P] [US1] Create AuctioneerDashboard component in frontend/augeo-admin/src/components/dashboards/AuctioneerDashboard.tsx
- [x] T020 [P] [US1] Create EventDashboard component in frontend/augeo-admin/src/components/dashboards/EventDashboard.tsx
- [x] T021 [US1] Update DashboardPage to route to role-specific dashboard with lazy loading in frontend/augeo-admin/src/routes/_authenticated/index.tsx
- [x] T022 [US1] Add beforeLoad guard to authenticated route to block Donor role from admin PWA in frontend/augeo-admin/src/routes/_authenticated/route.tsx
- [x] T023 [US1] Create UnauthorizedPage component for access denial in frontend/augeo-admin/src/pages/errors/UnauthorizedPage.tsx
- [x] T024 [P] [US1] Create useRoleBasedNav hook to filter navigation items by role in frontend/augeo-admin/src/hooks/use-role-based-nav.ts
- [ ] T025 [US1] Update Sidebar component to use useRoleBasedNav for dynamic navigation in frontend/augeo-admin/src/components/layout/Sidebar.tsx
- [ ] T026 [US1] Update backend NPO list endpoint to apply role-based filtering in backend/app/api/v1/npos.py
- [ ] T027 [US1] Update backend Event list endpoint to apply role-based filtering in backend/app/api/v1/events.py
- [ ] T028 [US1] Update backend User list endpoint to apply role-based filtering in backend/app/api/v1/users.py

**Checkpoint**: Role-based dashboards working, Donor role blocked, navigation shows only authorized items per role.

---

## Phase 4: User Story 2 - Template Cleanup & Simplified Navigation (Priority: P1)

**Goal**: Remove all unnecessary template features to create a clean, focused admin interface.

**Independent Test**: Navigate through all pages and verify Tasks, Chats, Apps, Settings, Appearance, Help Center, theme toggle, and hamburger menu are completely removed.

### Implementation for User Story 2

- [ ] T029 [P] [US2] Delete Tasks page directory and routes in frontend/augeo-admin/src/pages/tasks/
- [ ] T030 [P] [US2] Delete Chats page directory and routes in frontend/augeo-admin/src/pages/chats/
- [ ] T031 [P] [US2] Delete Apps page directory and routes in frontend/augeo-admin/src/pages/apps/
- [ ] T032 [P] [US2] Delete theme-toggle component directory in frontend/augeo-admin/src/components/theme-toggle/
- [ ] T033 [P] [US2] Delete hamburger-menu component directory in frontend/augeo-admin/src/components/hamburger-menu/
- [ ] T034 [US2] Remove deleted page routes from route definitions in frontend/augeo-admin/src/routes/
- [ ] T035 [US2] Update Sidebar to remove Tasks, Chats, Apps, Settings, Appearance, Help Center nav items in frontend/augeo-admin/src/components/layout/Sidebar.tsx
- [ ] T036 [US2] Remove hamburger menu button from AppShell header in frontend/augeo-admin/src/components/layout/AppShell.tsx
- [ ] T037 [US2] Remove theme selector UI elements from settings/appearance components
- [ ] T038 [US2] Run linter and type-check to catch broken imports from deletions
- [ ] T039 [US2] Fix any broken imports or references from deleted components

**Checkpoint**: Template cleanup complete, all unnecessary features removed, navigation streamlined.

---

## Phase 5: User Story 3 - Persistent Profile Dropdown Access (Priority: P2)

**Goal**: Profile dropdown accessible from all pages (not just dashboard) with simplified menu options.

**Independent Test**: Navigate to different pages (NPOs, Events, Users) and verify profile dropdown appears consistently in top-right corner with only Profile and Logout options.

### Implementation for User Story 3

- [ ] T040 [P] [US3] Simplify ProfileDropdown to show only Profile and Logout options in frontend/augeo-admin/src/components/layout/ProfileDropdown.tsx
- [ ] T041 [US3] Move ProfileDropdown to AppShell header for persistent rendering in frontend/augeo-admin/src/components/layout/AppShell.tsx
- [ ] T042 [US3] Remove conditional rendering logic that limited dropdown to dashboard only
- [ ] T043 [US3] Add ProfileDropdown styling to ensure visibility on all page backgrounds
- [ ] T044 [US3] Test ProfileDropdown logout functionality clears session and redirects to login

**Checkpoint**: Profile dropdown accessible from all pages, simplified menu working correctly.

---

## Phase 6: User Story 4 - Editable User Profile Page (Priority: P2)

**Goal**: Users can update their profile information with validation and persistence.

**Independent Test**: Navigate to profile page, edit each field (first name, last name, phone, organization, address), save, and verify changes persist and validation works for invalid inputs.

### Implementation for User Story 4

- [ ] T045 [P] [US4] Create ProfileForm component using React Hook Form and Zod in frontend/augeo-admin/src/components/profile/ProfileForm.tsx
- [ ] T046 [P] [US4] Implement profile update API endpoint in backend/app/api/v1/users.py (PATCH /api/v1/users/{id}/profile)
- [ ] T047 [US4] Update ProfilePage to fetch current user data and render ProfileForm in frontend/augeo-admin/src/pages/ProfilePage.tsx
- [ ] T048 [US4] Add field-level validation for phone (E.164 format) in ProfileForm
- [ ] T049 [US4] Add field-level validation for email format in ProfileForm
- [ ] T050 [US4] Add max length validation for all text fields per User model constraints
- [ ] T051 [US4] Implement backend Pydantic validation for profile updates in backend/app/schemas/user.py
- [ ] T052 [US4] Add authorization check ensuring users can only update own profile (or SuperAdmin any) in backend/app/api/v1/users.py
- [ ] T053 [US4] Display success toast notification on profile save in ProfileForm
- [ ] T054 [US4] Display inline error messages for validation failures in ProfileForm
- [ ] T055 [US4] Invalidate TanStack Query cache after successful update to refresh UI

**Checkpoint**: Profile editing fully functional with validation, persistence, and user feedback.

---

## Phase 7: User Story 5 - NPO Context Selector (Priority: P2)

**Goal**: NPO selector in top-left corner allows role-based NPO selection and filters all data accordingly.

**Independent Test**: Log in as different roles, verify NPO selector shows correct NPOs (all for SuperAdmin, assigned only for others), select NPO, verify data on NPO/Event/User pages filters correctly.

### Implementation for User Story 5

- [ ] T056 [P] [US5] Create NpoSelector component with dropdown UI in frontend/augeo-admin/src/components/layout/NpoSelector.tsx
- [ ] T057 [US5] Add NpoSelector to AppShell top-left corner (replacing Teams icon) in frontend/augeo-admin/src/components/layout/AppShell.tsx
- [ ] T058 [US5] Fetch available NPOs on login based on user role via API in useNpoContext hook
- [ ] T059 [US5] Implement SuperAdmin "Augeo Platform" option (null npoId) in NpoSelector
- [ ] T060 [US5] Implement auto-selection for single-NPO users (NPO Admin, Staff) in useNpoContext
- [ ] T061 [US5] Disable selector for single-NPO users (show name only, not clickable)
- [ ] T062 [US5] Implement query cache invalidation on NPO selection change in useNpoContext
- [ ] T063 [US5] Update NPO list query to use selectedNpoId from context in frontend/augeo-admin/src/pages/NposPage.tsx
- [ ] T064 [US5] Update Event list query to use selectedNpoId from context in frontend/augeo-admin/src/pages/EventsPage.tsx
- [ ] T065 [US5] Update User list query to use selectedNpoId from context in frontend/augeo-admin/src/pages/UsersPage.tsx
- [ ] T066 [US5] Update backend NPO endpoint to accept npoId query param and filter results in backend/app/api/v1/npos.py
- [ ] T067 [US5] Update backend Event endpoint to accept npoId query param and filter results in backend/app/api/v1/events.py
- [ ] T068 [US5] Update backend User endpoint to accept npoId query param and filter results in backend/app/api/v1/users.py
- [ ] T069 [US5] Implement localStorage persistence for NPO selection in Zustand store
- [ ] T070 [US5] Clear NPO selection from localStorage on logout

**Checkpoint**: NPO context selector working for all roles, data filtering by selected NPO context across all pages.

---

## Phase 8: User Story 6 - Functional Search Bar (Priority: P3)

**Goal**: Search bar returns relevant results across Users, NPOs, Events with role-based filtering.

**Independent Test**: Enter search queries, verify relevant results appear within 300ms, verify role-based filtering (NPO Admin only sees own NPO results), verify "No results found" message.

### Implementation for User Story 6

- [ ] T071 [P] [US6] Create SearchService with API call logic in frontend/augeo-admin/src/services/search.ts
- [ ] T072 [P] [US6] Create search endpoint with PostgreSQL tsvector search in backend/app/api/v1/search.py
- [ ] T073 [P] [US6] Create database migration for tsvector indexes on users, npos, events tables in backend/alembic/versions/
- [ ] T074 [US6] Update SearchBar component with debounced input (300ms) in frontend/augeo-admin/src/components/search/SearchBar.tsx
- [ ] T075 [US6] Add TanStack Query hook for search with min 2 character validation in SearchBar
- [ ] T076 [US6] Create SearchResults component to display grouped results in frontend/augeo-admin/src/components/search/SearchResults.tsx
- [ ] T077 [US6] Implement role-based filtering in search endpoint (SuperAdmin: all, NPO Admin: own NPO, etc.) in backend/app/api/v1/search.py
- [ ] T078 [US6] Add NPO context filtering to search results (respect selectedNpoId) in backend/app/api/v1/search.py
- [ ] T079 [US6] Display "No results found" message when search returns empty results in SearchResults
- [ ] T080 [US6] Make search result items clickable with navigation to detail pages in SearchResults
- [ ] T081 [US6] Add loading skeleton/spinner during search in SearchBar
- [ ] T082 [US6] Test search performance meets <300ms target for up to 1000 records

**Checkpoint**: Search functionality complete with debouncing, role-based filtering, NPO context awareness, and fast performance.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T083 [P] Update frontend README with new component structure and removed features in frontend/augeo-admin/README.md
- [ ] T084 [P] Update backend API documentation for new endpoints in backend/app/main.py (OpenAPI tags)
- [ ] T085 Run frontend linter (pnpm lint) and fix any remaining issues
- [ ] T086 Run frontend type-check (pnpm type-check) and fix TypeScript errors
- [ ] T087 Run backend linter (poetry run ruff check) and fix issues
- [ ] T088 Run backend type-check (poetry run mypy) and fix type errors
- [ ] T089 [P] Test all acceptance scenarios from spec.md manually
- [ ] T090 Verify all success criteria met (SC-001 through SC-010 from spec.md)
- [ ] T091 [P] Create screenshots for each role's dashboard view for documentation
- [ ] T092 Performance test: Verify dashboard loads <2s, navigation <500ms, profile save <1s
- [ ] T093 Accessibility audit: Keyboard navigation, focus management, screen reader announcements
- [ ] T094 Run pre-commit hooks via make check-commits
- [ ] T095 Validate against quickstart.md success criteria checklist

**Checkpoint**: Feature complete, tested, documented, ready for PR submission.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational completion - P1 priority (MVP)
- **User Story 2 (Phase 4)**: Depends on Foundational completion - P1 priority (MVP)
- **User Story 3 (Phase 5)**: Depends on Foundational completion - P2 priority
- **User Story 4 (Phase 6)**: Depends on Foundational completion - P2 priority
- **User Story 5 (Phase 7)**: Depends on Foundational completion - P2 priority
- **User Story 6 (Phase 8)**: Depends on Foundational completion - P3 priority
- **Polish (Phase 9)**: Depends on all desired user stories being complete

### User Story Dependencies

**No cross-story dependencies** - All user stories are independently implementable after Foundational phase:

- **User Story 1 (Role-Based Dashboards)**: Independent - creates new dashboard components and navigation logic
- **User Story 2 (Template Cleanup)**: Independent - deletes template components
- **User Story 3 (Profile Dropdown)**: Independent - modifies layout component
- **User Story 4 (Profile Editing)**: Independent - creates profile form and update endpoint
- **User Story 5 (NPO Context)**: Independent - creates context selector and filtering (integrates with US1 nav but doesn't break it)
- **User Story 6 (Search)**: Independent - creates new search feature

**Recommended Order**: P1 stories first (US1, US2), then P2 stories (US3, US4, US5), then P3 (US6)

### Within Each User Story

- Frontend components marked [P] can be created in parallel (different files)
- Backend endpoints marked [P] can be created in parallel (different files)
- Database migrations must complete before using new indexes
- Component integration happens after individual components exist

### Parallel Opportunities

**Setup Phase**:

- T003, T004 (frontend/backend installs)
- T005, T006 (DB/Redis verification)

**Foundational Phase**:

- T010, T011, T012, T013 (frontend hooks and schemas)
- T014, T015, T016 (backend services and schemas)

**User Story 1**:

- T017, T018, T019, T020 (all dashboard components - different files)
- T024 (useRoleBasedNav hook - parallel with T025 prep)

**User Story 2**:

- T029, T030, T031, T032, T033 (all deletions - different directories)

**User Story 3**:

- T040 (ProfileDropdown simplification - parallel with other US3 prep)

**User Story 4**:

- T045, T046 (ProfileForm component and backend endpoint - frontend/backend parallelism)

**User Story 5**:

- T056, T057 (NpoSelector component and placement)

**User Story 6**:

- T071, T072, T073 (SearchService, backend endpoint, migration - all different areas)

**Polish Phase**:

- T083, T084, T091 (documentation and screenshots)

---

## Parallel Example: User Story 1

```bash
# Launch all dashboard components together:
Task: "Create SuperAdminDashboard component in frontend/augeo-admin/src/components/dashboards/SuperAdminDashboard.tsx"
Task: "Create NpoAdminDashboard component in frontend/augeo-admin/src/components/dashboards/NpoAdminDashboard.tsx"
Task: "Create AuctioneerDashboard component in frontend/augeo-admin/src/components/dashboards/AuctioneerDashboard.tsx"
Task: "Create EventDashboard component in frontend/augeo-admin/src/components/dashboards/EventDashboard.tsx"

# After dashboards exist:
Task: "Update DashboardPage to route to role-specific dashboard with lazy loading"
Task: "Create useRoleBasedNav hook to filter navigation items by role" (parallel)
```

---

## Parallel Example: User Story 2

```bash
# Launch all deletions together:
Task: "Delete Tasks page directory and routes in frontend/augeo-admin/src/pages/tasks/"
Task: "Delete Chats page directory and routes in frontend/augeo-admin/src/pages/chats/"
Task: "Delete Apps page directory and routes in frontend/augeo-admin/src/pages/apps/"
Task: "Delete theme-toggle component directory in frontend/augeo-admin/src/components/theme-toggle/"
Task: "Delete hamburger-menu component directory in frontend/augeo-admin/src/components/hamburger-menu/"
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 Only - Both P1)

1. Complete Phase 1: Setup (T001-T008)
2. Complete Phase 2: Foundational (T009-T016) - CRITICAL blocker
3. Complete Phase 3: User Story 1 - Role-Based Dashboards (T017-T028)
4. Complete Phase 4: User Story 2 - Template Cleanup (T029-T039)
5. **STOP and VALIDATE**: Test both P1 stories work together
6. Deploy/demo if ready - MVP has core security (role-based access) + clean UI

### Incremental Delivery (Add P2 Stories)

After MVP (US1 + US2):

1. Add User Story 3: Persistent Profile Dropdown (T040-T044)
2. Add User Story 4: Editable Profile (T045-T055)
3. Add User Story 5: NPO Context Selector (T056-T070)
4. Test P1 + P2 stories together
5. Deploy/demo enhanced version

### Full Feature (Add P3 Story)

After P1 + P2:

1. Add User Story 6: Functional Search (T071-T082)
2. Complete Phase 9: Polish (T083-T095)
3. Full validation and testing
4. Deploy production-ready version

### Parallel Team Strategy

With 3 developers (after Foundational phase):

**Week 1**:

- Developer A: User Story 1 (Role-Based Dashboards)
- Developer B: User Story 2 (Template Cleanup)
- Developer C: User Story 3 (Profile Dropdown)

**Week 2**:

- Developer A: User Story 4 (Profile Editing)
- Developer B: User Story 5 (NPO Context)
- Developer C: User Story 6 (Search)

**Week 3**:

- All: Integration testing, Polish phase, bug fixes

---

## Task Summary

**Total Tasks**: 95 tasks

- **Setup**: 8 tasks
- **Foundational**: 8 tasks (BLOCKING)
- **User Story 1 (P1)**: 12 tasks
- **User Story 2 (P1)**: 11 tasks
- **User Story 3 (P2)**: 5 tasks
- **User Story 4 (P2)**: 11 tasks
- **User Story 5 (P2)**: 15 tasks
- **User Story 6 (P3)**: 12 tasks
- **Polish**: 13 tasks

**Parallel Tasks**: 34 tasks marked [P] can run in parallel
**User Stories**: 6 independent stories (all can start after Foundational phase)

**MVP Scope**: User Stories 1 & 2 (23 tasks) + Setup (8) + Foundational (8) = **39 tasks for MVP**

**Estimated Timeline**:

- MVP (P1 stories): 1 week
- MVP + P2 stories: 2-2.5 weeks
- Full feature (all stories + polish): 2.5-3 weeks

---

## Notes

- [P] tasks = different files, no dependencies within phase
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- No tests generated (not requested in spec)
- Manual validation via acceptance scenarios (spec.md)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Format validation: ✅ All tasks follow `- [ ] [ID] [P?] [Story?] Description with path` format
