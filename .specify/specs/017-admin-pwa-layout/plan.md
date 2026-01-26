# Implementation Plan: Admin PWA Layout Redesign

**Branch**: `017-admin-pwa-layout` | **Date**: 2026-01-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `.specify/specs/017-admin-pwa-layout/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Redesign the admin PWA navigation architecture to consolidate all navigation into a sidebar-based system with smart event selection, grouped navigation (Dashboard, Admin, Event-specific), and visual identifiers with fallback initials. Replace horizontal tab navigation with sidebar items, add event selector dropdown with intelligent defaults, and display selected event prominently in the top bar. Remove redundant UI elements from settings pages.

**Technical Approach**: Frontend-only changes to existing React admin PWA. Refactor sidebar components, create new EventSelector hook/component parallel to NpoSelector, migrate event tab navigation to sidebar groups, implement initial avatar generation utility, update routing to support sidebar navigation, and clean up settings page layout.

## Technical Context

**Language/Version**: TypeScript 5.x (Frontend), Python 3.11+ (Backend - minimal changes for event list API optimization if needed)
**Primary Dependencies**: React 18, Vite, TanStack Router, Zustand (state), Radix UI (sidebar/dropdown components), Tailwind CSS 4
**Storage**: N/A (UI-only changes; uses existing NPO/event APIs)
**Testing**: Vitest (unit), Testing Library (component), Playwright (E2E for navigation flows)
**Target Platform**: Web browsers (Chrome, Firefox, Safari, Edge); responsive design for desktop/tablet/mobile
**Project Type**: Web application (frontend component of monorepo)
**Performance Goals**: 
- Sidebar render <50ms
- Event selector dropdown open <100ms
- Badge count updates on navigation <200ms
- Initial avatar generation <10ms
**Constraints**: 
- Must maintain existing NPO context functionality
- Must preserve role-based access control for navigation items
- Must support collapsible sidebar (existing feature)
- Must work with existing event/NPO data structures
**Scale/Scope**: 
- ~15 new/modified components (EventSelector, AppSidebar updates, navigation groups)
- ~5 navigation routes affected (settings pages cleanup)
- ~3 custom hooks (useEventContext, useInitialAvatar)
- ~500-800 lines of new TypeScript code
- ~10 unit tests, ~5 integration tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### ✅ Passes All Gates

**Donor-Driven Engagement**: N/A (Admin-facing feature, no direct donor impact)

**Real-Time Reliability**: N/A (No WebSocket changes; badge updates on navigation only)

**Production-Grade Quality**: ✅
- Follows existing TypeScript strict mode patterns
- Uses established component library (Radix UI)
- Maintains test coverage standards (80%+ target)
- Reuses existing auth/permission patterns

**Solo Developer Efficiency**: ✅
- Leverages existing Radix UI Sidebar components
- Follows established Zustand state management patterns
- Minimal backend changes (event list API already exists)
- No new infrastructure/services required

**Data Security and Privacy**: ✅
- No new data storage or API changes
- Uses existing authentication/authorization
- Reads existing NPO/event data with proper RBAC

**Minimalist Development (YAGNI)**: ✅
- Implements only specified requirements (no extra features)
- Reuses existing components where possible
- No premature optimization (badge polling on navigation is sufficient)
- No anticipatory extensibility hooks

### Additional Constitution Alignment

**Type Safety**: ✅ TypeScript strict mode enforced, no `any` types
**Code Style**: ✅ ESLint + Prettier configured, follows existing patterns
**Testing**: ✅ Unit + integration + E2E tests per constitution standards
**Architecture**: ✅ Follows existing frontend architecture (components, hooks, stores)

## Project Structure

### Documentation (this feature)

```
specs/017-admin-pwa-layout/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
frontend/fundrbolt-admin/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── app-sidebar.tsx                    # [MODIFY] Add EventSelector, update navigation groups
│   │   │   ├── EventSelector.tsx                  # [NEW] Event dropdown selector with smart defaults
│   │   │   ├── NpoSelector.tsx                    # [REFERENCE] Existing pattern to follow
│   │   │   ├── header.tsx                         # [MODIFY] Add event name display
│   │   │   ├── nav-group.tsx                      # [MODIFY] Support collapsible state persistence
│   │   │   └── data/
│   │   │       └── sidebar-data.ts                # [MODIFY] Update navigation structure
│   │   └── ui/
│   │       ├── avatar.tsx                         # [NEW] InitialAvatar component with WCAG contrast
│   │       └── sidebar.tsx                        # [REFERENCE] Existing Radix UI sidebar
│   ├── hooks/
│   │   ├── use-event-context.tsx                  # [NEW] Event selection context/hook
│   │   ├── use-npo-context.tsx                    # [REFERENCE] Existing pattern
│   │   ├── use-role-based-nav.ts                  # [MODIFY] Add event-specific nav items
│   │   └── use-initial-avatar.ts                  # [NEW] Generate initials with branding colors
│   ├── lib/
│   │   ├── utils.ts                               # [MODIFY] Add contrast checking utility
│   │   └── colors.ts                              # [NEW] WCAG contrast calculation
│   ├── stores/
│   │   └── event-context-store.ts                 # [NEW] Zustand store for event selection state
│   ├── features/
│   │   ├── events/
│   │   │   └── EventEditPage.tsx                  # [MODIFY] Remove horizontal tabs, update routing
│   │   └── settings/
│   │       └── index.tsx                          # [MODIFY] Remove duplicate header/search elements
│   └── routes/
│       └── __root.tsx                             # [MODIFY] Update routing for sidebar navigation
│
└── tests/
    ├── components/
    │   ├── EventSelector.test.tsx                 # [NEW] Smart default logic tests
    │   └── InitialAvatar.test.tsx                 # [NEW] Contrast compliance tests
    ├── hooks/
    │   ├── use-event-context.test.tsx             # [NEW] Event selection persistence
    │   └── use-initial-avatar.test.tsx            # [NEW] Initial generation logic
    └── e2e/
        └── navigation.spec.ts                     # [NEW] Sidebar navigation flows

backend/app/
├── api/
│   └── v1/
│       └── events.py                              # [MODIFY?] Add search/filter for 10+ events if needed
└── tests/
    └── api/
        └── test_events.py                         # [MODIFY?] Test event list filtering
```

**Structure Decision**: Web application with frontend-heavy changes. This is a UI/UX redesign with minimal backend impact. Following existing monorepo structure with frontend/fundrbolt-admin as the primary work area. Backend changes only if event list API needs optimization for search/filter functionality (to be determined in Phase 0 research).

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

**No Violations**: All constitution gates pass. This feature maintains existing patterns and adds no new complexity beyond what's specified.


---

## Phase 0-1 Complete: Planning & Design ✅

### Generated Artifacts

1. **[research.md](./research.md)** - 7 research questions answered with technical decisions
   - Event selector implementation pattern (Radix UI + smart defaults)
   - Badge count update strategy (poll on navigation)
   - WCAG contrast compliance for initial avatars
   - Navigation group collapsibility with localStorage persistence
   - Event search/filter UI pattern (Radix Command component)
   - Routing strategy (nested routes with TanStack Router)
   - Backend API changes (minimal - stats endpoint + search param)

2. **[data-model.md](./data-model.md)** - Frontend state models and API contracts
   - EventContext Zustand store with smart default logic
   - NavigationGroupState localStorage persistence
   - InitialAvatarConfig with WCAG contrast calculation
   - EventStats API response schema
   - No database schema changes required

3. **[contracts/api-contracts.md](./contracts/api-contracts.md)** - Backend API specifications
   - New endpoint: `GET /api/v1/events/:eventId/stats` (badge counts)
   - Modified endpoint: `GET /api/v1/events?search=query` (event filtering)
   - OpenAPI schemas and examples
   - Full backward compatibility maintained

4. **[quickstart.md](./quickstart.md)** - Step-by-step implementation guide
   - 9 implementation phases with estimated times (8-12 hours total)
   - Verification checklists for each phase
   - Testing strategy (unit + integration + E2E)
   - Common pitfalls and solutions
   - Deployment and rollback procedures

5. **Agent Context Updated** - GitHub Copilot instructions enhanced with:
   - TypeScript 5.x + Python 3.11+ tech stack
   - React 18 + Vite + TanStack Router + Zustand + Radix UI + Tailwind CSS 4
   - Frontend-heavy web application pattern

### Next Command

Run `/speckit.tasks` to generate the detailed task breakdown (tasks.md) for Phase 2 implementation.

---

## Re-Evaluated Constitution Check (Post-Design)

### ✅ All Gates Still Pass

**Production-Grade Quality**: ✅
- All components follow existing patterns (NpoSelector → EventSelector)
- WCAG AA compliance enforced (4.5:1 contrast ratio)
- Comprehensive test coverage (unit + integration + E2E)

**Solo Developer Efficiency**: ✅
- Reuses 100% of existing UI components (Radix UI)
- Minimal backend work (1-2 hours for stats endpoint)
- Leverages existing patterns (NpoContext → EventContext)

**Data Security**: ✅
- No new authentication/authorization logic
- Uses existing RBAC for event access control
- No PII handling changes

**YAGNI Principle**: ✅
- Event search appears only at 10+ events threshold
- Badge counts poll on navigation (no real-time WebSocket overhead)
- No feature flags or extensibility hooks added
- localStorage persistence only for UI state (no server sync)

### Complexity Assessment

**Total Complexity**: Low-Medium
- **LOC Estimate**: 500-800 new TypeScript lines
- **Modified Files**: ~15 components/hooks, 1 backend endpoint
- **New Dependencies**: 0 (uses existing Radix UI, Zustand, TanStack Router)
- **Infrastructure**: 0 (no new services/databases/queues)

**Risk Level**: Low
- ✅ No database migrations
- ✅ No auth/permission changes
- ✅ Fully backward compatible API changes
- ✅ Frontend-only changes (easy rollback)
- ✅ Established patterns (NpoSelector precedent)

---

## Implementation Ready ✅

Feature planning complete. Proceed to Phase 2 task breakdown with:

```bash
/speckit.tasks
```
