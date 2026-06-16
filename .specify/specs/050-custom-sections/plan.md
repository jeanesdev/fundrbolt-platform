# Implementation Plan: Configurable Our Cause Card Sections

**Branch**: `050-custom-sections` | **Date**: 2026-06-15 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/050-custom-sections/spec.md`

## Summary

Allow NPO admin and event coordinators to configure the Our Cause page as an ordered list of content cards (text, slideshow, video) plus the existing built-in sections (About This Event, Sponsors, Event Details). Cards have per-card styling, enable/disable toggles, and a draft → explicit-publish workflow. Concurrent saves use optimistic version checking. Rich text is sanitised, media can be uploaded or linked via external HTTPS URLs.

## Technical Context

**Language/Version**: Python 3.11+ (backend), TypeScript 5.x (frontend)
**Primary Dependencies**: FastAPI 0.120+, SQLAlchemy 2.0+, Pydantic 2.0+, Alembic (backend); React 19, Vite 7, TanStack Router, TanStack React Query 5, Zustand 5, Radix UI, Tailwind CSS 4 (admin PWA); React 19, Vite 7, TanStack Router (donor PWA)
**Storage**: Azure Database for PostgreSQL (card config, revision history); Azure Blob Storage (uploaded slide/video media)
**Testing**: pytest + pytest-asyncio + httpx (backend); Vitest (frontend unit); Playwright (E2E)
**Target Platform**: Web (admin PWA at localhost:5173, donor PWA at localhost:5174), backend at localhost:8000
**Project Type**: Web application — monorepo with backend/ + frontend/fundrbolt-admin/ + frontend/donor-pwa/
**Performance Goals**: Card configuration publish visible to donors within 30 seconds; admin page loads in <2 seconds
**Constraints**: WCAG 2.1 AA for donor-facing card rendering and admin authoring controls; rich text sanitised server-side before persist; external media URLs validated at save time
**Scale/Scope**: Per-event card config; same scale as existing event pages (100+ concurrent donors per event)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Donor-Driven Engagement | ✅ Pass | Feature directly improves donor-facing Our Cause page |
| Real-Time Reliability | ✅ Pass | No real-time bid paths touched; polling sufficient for card refresh |
| Production-Grade Quality | ✅ Pass | Draft/publish flow, audit log (FR-015), version conflict detection planned |
| Solo Developer Efficiency | ✅ Pass | Builds on existing patterns; no new third-party services |
| Data Security and Privacy | ✅ Pass | Rich-text sanitisation (FR-020, FR-021), external URL validation (FR-023) |
| Minimalist Development (YAGNI) | ✅ Pass | Only three card templates, exactly as specified; no extra templates added |
| WCAG 2.1 AA | ✅ Pass | Requirement captured in FR-024/FR-025 |

No constitution violations.

## Project Structure

### Documentation (this feature)

```
specs/050-custom-sections/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── cause-section-cards.yaml
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```
backend/
├── app/
│   ├── models/
│   │   └── cause_section_card.py         # NEW: CauseSectionCard, SlideItem, CardConfigRevision
│   ├── schemas/
│   │   └── cause_section_card.py         # NEW: Pydantic request/response schemas
│   ├── services/
│   │   └── cause_section_card_service.py # NEW: CRUD, draft/publish, conflict check, sanitise
│   └── api/v1/
│       └── cause_section_cards.py        # NEW: admin + donor endpoints
├── alembic/versions/
│   └── XXXX_add_cause_section_cards.py   # NEW: migration
└── app/tests/
    └── test_cause_section_cards.py       # NEW: unit + integration tests

frontend/
├── fundrbolt-admin/src/
│   ├── features/events/cause-sections/
│   │   ├── CauseSectionsPage.tsx         # NEW: card management page
│   │   ├── CardList.tsx                  # NEW: draggable ordered card list
│   │   ├── CardEditor.tsx                # NEW: per-card config panel (style, content)
│   │   ├── TextCardEditor.tsx            # NEW: WYSIWYG text card
│   │   ├── SlideshowCardEditor.tsx       # NEW: slide items editor
│   │   ├── VideoCardEditor.tsx           # NEW: video source + playback settings
│   │   └── CauseSectionsPreview.tsx      # NEW: preview drawer
│   └── services/
│       └── cause-section-cards.ts        # NEW: API client
└── donor-pwa/src/
    ├── features/events/cause-sections/
    │   ├── CauseSectionsRenderer.tsx     # NEW: renders ordered card list from API
    │   ├── TextCard.tsx                  # NEW
    │   ├── SlideshowCard.tsx             # NEW
    │   └── VideoCard.tsx                 # NEW
    └── lib/api/
        └── cause-section-cards.ts        # NEW: API client
