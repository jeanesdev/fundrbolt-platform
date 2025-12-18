# Implementation Plan: Donor PWA Event Homepage

**Branch**: `011-donor-pwa-event` | **Date**: December 9, 2025 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-donor-pwa-event/spec.md`

## Summary

Transform the donor PWA event page into an immersive, event-branded homepage that serves as the primary donor experience. The page will feature automatic routing to registered events, an event switcher for multi-event donors, a countdown timer for future events, collapsible event details, and an Amazon-style auction item gallery with infinite scroll and type filtering. The UI will apply dynamic event/NPO branding with zero Fundrbolt branding visible.

## Technical Context

**Language/Version**: TypeScript 5.x (Frontend), Python 3.11+ (Backend)
**Primary Dependencies**: React 18, Vite, TanStack Router, Radix UI, Tailwind CSS 4, FastAPI, SQLAlchemy 2.0
**Storage**: Azure Database for PostgreSQL (existing), Azure Blob Storage (images)
**Testing**: Vitest (frontend), pytest (backend)
**Target Platform**: Progressive Web App (PWA), mobile-first, responsive
**Project Type**: Web application (frontend/backend monorepo)
**Performance Goals**: Page load <3s on mobile, auction items visible in <5s from login
**Constraints**: Infinite scroll pagination, minimum 2-column grid, real-time countdown
**Scale/Scope**: 100+ auction items per event, 10+ events per donor

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| **Donor-Driven Engagement** | ✅ PASS | Feature prioritizes donor experience with immersive branding |
| **Real-Time Reliability** | ✅ PASS | Countdown timer updates in real-time; bid data fetched on load |
| **Production-Grade Quality** | ✅ PASS | Extends existing tested patterns |
| **Solo Developer Efficiency** | ✅ PASS | Leverages existing stores, hooks, components |
| **Data Security and Privacy** | ✅ PASS | Only shows events user is registered for |
| **Minimalist Development (YAGNI)** | ✅ PASS | Implements only specified requirements |
| **Never implement unspecified features** | ✅ PASS | Scope bounded by clarified spec |

## Project Structure

### Documentation (this feature)

```
specs/011-donor-pwa-event/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```
backend/
├── app/
│   ├── api/v1/
│   │   └── registrations.py      # Extend: add endpoint for registered events with branding
│   ├── schemas/
│   │   └── event_registration.py # Extend: add event branding to response
│   └── services/
│       └── event_registration_service.py # Extend: include NPO fallback branding
└── tests/
    └── api/
        └── test_registrations.py # Add tests for new endpoint

frontend/donor-pwa/
├── src/
│   ├── components/
│   │   ├── event-home/           # NEW: Event homepage components
│   │   │   ├── EventSwitcher.tsx        # Dropdown for multi-event donors (integrated into EventHomePage header)
│   │   │   ├── CountdownTimer.tsx       # Real-time countdown
│   │   │   ├── EventDetails.tsx         # Collapsible event info
│   │   │   └── AuctionGallery.tsx       # Amazon-style grid with filters
│   │   └── ui/                   # Existing shadcn components
│   ├── hooks/
│   │   ├── use-countdown.ts      # NEW: Countdown timer hook
│   │   └── use-event-branding.ts # Existing: extend for background colors
│   ├── routes/_authenticated/
│   │   └── events/$eventId/
│   │       └── index.tsx         # MODIFY: Use new EventHomePage
│   ├── features/events/
│   │   └── EventHomePage.tsx     # NEW: Main event homepage component
│   └── stores/
│       └── event-context-store.ts # MODIFY: Add branding data
└── tests/
    └── components/
        └── event-home/           # NEW: Component tests
```

**Structure Decision**: Web application with existing frontend/backend separation. Extends existing donor-pwa routes and backend APIs.

## Complexity Tracking

*No constitution violations requiring justification.*
