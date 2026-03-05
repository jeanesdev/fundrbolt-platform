# Implementation Plan: Admin PWA Mobile & Tablet UI

**Branch**: `032-admin-pwa-mobile` | **Date**: 2026-03-04 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/032-admin-pwa-mobile/spec.md`

## Summary

Make the admin PWA tablet-friendly by adding a card/list view toggle for all 12 data table pages, making the sidebar collapsible with overlay behavior on tablets, increasing touch target sizes, and ensuring responsive reflow of forms, dashboards, and quick-entry interfaces. This is a frontend-only feature with no backend or database changes. The approach leverages the existing shadcn/ui sidebar (which already supports collapse and overlay via Sheet), the existing TanStack Table column definitions (to derive card layouts), and Tailwind CSS responsive utilities with new tablet breakpoint hooks.

## Technical Context

**Language/Version**: TypeScript 5.9, React 19, Node 22
**Primary Dependencies**: Vite 7, TanStack Router, TanStack React Table 8, TanStack React Query 5, Radix UI primitives, Tailwind CSS 4, Zustand 5, shadcn/ui sidebar component, Lucide icons
**Storage**: Browser localStorage (view preference persistence only — no backend storage)
**Testing**: Vitest 4 (unit/component), Playwright 1.58 (E2E smoke tests), Testing Library (React component tests)
**Target Platform**: Web PWA — iPad Safari (primary), Android Chrome tablet, desktop Chrome/Firefox/Edge. Viewports from 768px to 1920px+
**Project Type**: Web frontend (monorepo subfolder `frontend/fundrbolt-admin/`)
**Performance Goals**: Card view initial paint < 1s for 50+ records, sidebar collapse/expand animation < 0.5s, orientation reflow < 0.3s
**Constraints**: No backend changes, no new npm dependencies unless essential, reuse existing column definitions for card rendering, iOS Safari compatibility (16px min font for inputs)
**Scale/Scope**: 12 data table views to convert, 1 sidebar component to adapt, ~6 form layouts to audit, 3 quick-entry interfaces to optimize

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| YAGNI — build only what's specified | ✅ Pass | Scope is bounded to spec's 16 FRs; no speculative features |
| No new backend services | ✅ Pass | Frontend-only; preference stored in localStorage |
| Type safety — TypeScript strict | ✅ Pass | All new components will be fully typed; existing strict mode |
| Testing requirements — unit coverage | ✅ Pass | New hook + card component will have unit tests |
| Security — no new auth/data flows | ✅ Pass | No sensitive data added; localStorage stores UI preference only |
| Permissive licenses only | ✅ Pass | No new dependencies planned; if added, will verify MIT/Apache |
| Accessibility — WCAG compliance | ✅ Pass | FR-009 enforces 44×44px targets (WCAG 2.5.8); card view maintains aria attributes |
| Mobile-first responsive design | ✅ Pass | This feature directly serves the constitution's "Responsive Design: Mobile-first, optimized for tablets" directive |

## Project Structure

### Documentation (this feature)

```
specs/032-admin-pwa-mobile/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (minimal — localStorage schema only)
├── quickstart.md        # Phase 1 output
└── contracts/           # Phase 1 output (no API contracts — frontend-only feature)
```

### Source Code (repository root)

```
frontend/fundrbolt-admin/src/
├── hooks/
│   ├── use-mobile.tsx                    # EXISTING — 768px breakpoint hook
│   ├── use-breakpoint.ts                 # NEW — configurable breakpoint hook (phone/tablet-portrait/tablet-landscape/desktop)
│   └── use-view-preference.ts            # NEW — per-page table/card view preference (localStorage)
├── components/
│   ├── ui/
│   │   ├── sidebar.tsx                   # MODIFY — adjust breakpoints for tablet landscape (icon rail default)
│   │   └── table.tsx                     # EXISTING — unchanged
│   ├── data-table/
│   │   ├── index.ts                      # MODIFY — export new DataTableCardView
│   │   ├── card-view.tsx                 # NEW — generic card renderer from TanStack Table columns
│   │   ├── view-toggle.tsx               # NEW — table/card toggle button group
│   │   └── data-table-wrapper.tsx        # NEW — wrapper combining table + card view with toggle logic
│   └── layout/
│       ├── app-sidebar.tsx               # MODIFY — default collapsed on tablet landscape
│       ├── authenticated-layout.tsx      # MODIFY — tablet-aware sidebar default state
│       └── header.tsx                    # EXISTING — already has SidebarTrigger
├── features/
│   ├── users/components/users-table.tsx  # MODIFY — integrate DataTableWrapper
│   ├── events/sections/
│   │   └── EventCheckInSection.tsx       # MODIFY — integrate DataTableWrapper
│   ├── events/auction-bids/
│   │   └── AuctionBidsDashboard.tsx      # MODIFY — integrate DataTableWrapper
│   ├── events/tickets/components/
│   │   └── TicketSalesTable.tsx          # MODIFY — integrate DataTableWrapper
│   ├── npo-management/components/
│   │   ├── MemberList.tsx                # MODIFY — integrate DataTableWrapper
│   │   └── PendingInvitations.tsx        # MODIFY — integrate DataTableWrapper
│   ├── quick-entry/components/
│   │   ├── PaddleRaiseEntryForm.tsx      # MODIFY — touch-optimized layout
│   │   ├── BuyNowEntryForm.tsx           # MODIFY — touch-optimized layout
│   │   └── LiveBidLogAndMetrics.tsx      # MODIFY — responsive table/list
│   └── event-dashboard/                  # MODIFY — responsive grid breakpoints
├── components/admin/
│   └── AttendeeListTable.tsx             # MODIFY — integrate DataTableWrapper
├── pages/admin/
│   └── npo-applications.tsx              # MODIFY — integrate DataTableWrapper
└── styles/
    └── index.css                         # MODIFY — touch target size utilities, tablet breakpoint helpers
```

## Complexity Tracking

No constitution violations. No complexity justification needed.
