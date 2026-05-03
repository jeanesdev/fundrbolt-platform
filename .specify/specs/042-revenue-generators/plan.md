# Implementation Plan: Revenue Generators

**Branch**: `042-revenue-generators` | **Date**: 2026-05-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/042-revenue-generators/spec.md`

## Summary

Revenue Generators are a distinct fundraising item category (raffles, games of chance) where donors purchase fixed-price entries — no outbidding, no displacement. Each item has two independently toggleable states (visibility and entry status), donors see only their own entry counts, and admins/auctioneers can draw winners randomly (weighted by entry count) or manually. Revenue is tracked separately from silent and live auction totals across all dashboards.

Technical approach: three new PostgreSQL tables (`revenue_generator_items`, `revenue_generator_entries`, `revenue_generator_winner_selections`) with a new FastAPI router pair (admin + donor), Quick Entry integration following the existing tab pattern, and React feature modules in both admin PWA and donor PWA.

## Technical Context

**Language/Version**: Python 3.11+ (Backend), TypeScript 5.x (Frontend)
**Primary Dependencies**: FastAPI 0.120+, SQLAlchemy 2.0+, Pydantic 2.0+, Alembic (Backend); React 18/19, Vite, TanStack Router, Zustand, Radix UI, Tailwind CSS 4 (Frontend)
**Storage**: Azure Database for PostgreSQL — 3 new tables: `revenue_generator_items`, `revenue_generator_entries`, `revenue_generator_winner_selections`
**Testing**: pytest (backend), vitest (frontend) — no test tasks unless explicitly requested
**Target Platform**: Azure App Service (backend), Azure Static Web Apps (frontend)
**Project Type**: web
**Performance Goals**: Entry purchase <500ms (SC-001 proxy), visibility toggle reflected in donor app within 5s (SC-002), random draw <10s (SC-003), dashboard totals accurate within 10s of new entry (SC-004)
**Constraints**: Multi-tenant (event-scoped with cascade deletes), GDPR (SET NULL on guest deletes preserves entry records), RBAC (admin + auctioneer for winner selection; donors for entry purchase only), 100+ concurrent donors per event
**Scale/Scope**: Per-event scoping, consistent with existing auction item scale

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| **Multi-tenancy** | ✓ PASS | All tables scoped to `event_id` with CASCADE DELETE; tenant isolation at ORM level |
| **Real-time reliability** | ✓ PASS | Donor visibility toggle uses polling (existing pattern, <5s per SC-002); no new WebSocket channels per YAGNI |
| **RBAC** | ✓ PASS | Admin + auctioneer for winner selection (FR-012/013); donors for entry purchase; Quick Entry restricted to admin/staff (per existing `admin_quick_entry` pattern) |
| **YAGNI** | ✓ PASS | Builds exactly 6 user stories, 3 entities, no extras; dashboard aggregations query-time (no premature caching) |
| **Performance** | ✓ PASS | All SC targets met via async FastAPI + SQLAlchemy; Redis cache deferred until performance degrades |
| **Data Security** | ✓ PASS | `registration_guest_id` SET NULL on delete (preserves entry integrity); winner history append-only; all actions logged with actor |
| **Type Safety** | ✓ PASS | mypy strict mode enforced; all functions type-annotated; Pydantic for all request/response boundaries |

## Project Structure

### Documentation (this feature)

```
specs/042-revenue-generators/
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── data-model.md        # Entity definitions and schema
├── quickstart.md        # Developer setup and test scenarios
├── contracts/
│   ├── admin-revenue-generators.yaml
│   ├── donor-revenue-generators.yaml
│   └── quick-entry-revenue-generators.yaml
└── tasks.md             # Implementation task list (Phase 2 output)
```

### Source Code (repository root)

```
backend/
├── app/
│   ├── models/
│   │   ├── revenue_generator_item.py          # RevenueGeneratorItem SQLAlchemy model
│   │   ├── revenue_generator_entry.py         # RevenueGeneratorEntry SQLAlchemy model
│   │   ├── revenue_generator_winner_selection.py  # RevenueGeneratorWinnerSelection model
│   │   └── __init__.py                        # Register new models
│   ├── schemas/
│   │   ├── revenue_generator.py               # All Pydantic request/response schemas
│   │   └── quick_entry/
│   │       └── schemas.py                     # Extended with RG Quick Entry schemas
│   ├── services/
│   │   └── revenue_generator_service.py       # Core business logic
│   └── api/v1/
│       ├── admin_revenue_generators.py        # Admin CRUD + winner selection endpoints
│       ├── donor_revenue_generators.py        # Donor list + purchase entry endpoints
│       └── admin_quick_entry.py               # Extended with RG tab (existing file)
└── alembic/versions/
    └── 042_add_revenue_generator_tables.py    # Migration: 3 new tables

frontend/fundrbolt-admin/src/
├── features/
│   └── revenue-generators/
│       ├── index.ts                           # Public exports
│       ├── RevenueGeneratorList.tsx           # Admin item list with toggles
│       ├── RevenueGeneratorForm.tsx           # Create/edit item form
│       ├── RevenueGeneratorEntryList.tsx      # Per-item entry list + winner controls
│       └── WinnerSelectionModal.tsx           # Random draw + manual selection UI
└── services/
    └── revenueGeneratorService.ts             # Admin API client

frontend/donor-pwa/src/
├── features/
│   └── play/
│       ├── index.ts                           # Public exports
│       ├── PlayTab.tsx                        # "Play" tab container (conditionally visible)
│       ├── RevenueGeneratorCard.tsx           # Per-item card with entry count + winner display
│       └── EntryPurchaseModal.tsx             # Purchase confirmation flow
```

**Structure Decision**: Web application (Option 2). Backend follows existing FastAPI router pattern (`backend/app/api/v1/`). Frontend splits between admin PWA and donor PWA, each with a dedicated `features/` module. Quick Entry extends the existing file rather than creating a new router, consistent with how `paddle-raise` and `live-auction` tabs were added.
