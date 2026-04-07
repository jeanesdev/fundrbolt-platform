# Implementation Plan: Donor Dashboard

**Branch**: `039-donor-dashboard` | **Date**: 2026-04-06 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/039-donor-dashboard/spec.md`

## Summary

Build an admin-facing Donor Dashboard that aggregates donor/attendee giving behavior across events. Backend: a new `DonorDashboardService` with API endpoints that aggregate data from 7 existing revenue models (TicketPurchase, AuctionBid, QuickEntryBid, QuickEntryBuyNowBid, QuickEntryDonation, PaddleRaiseContribution, Donation). Frontend: a new dashboard page in the admin PWA using Recharts for charts and TanStack Query for data fetching. No new database tables — all data is computed from existing models.

## Technical Context

**Language/Version**: Python 3.11+ (Backend), TypeScript 5.x (Frontend)
**Primary Dependencies**: FastAPI 0.120+, SQLAlchemy 2.0+, Pydantic 2.0+ (Backend); React 19, Vite 7, TanStack Router, TanStack React Query 5, Zustand, Radix UI, Recharts, Tailwind CSS 4 (Frontend)
**Storage**: Azure Database for PostgreSQL (existing tables — no new migrations), Azure Cache for Redis (optional caching for leaderboard aggregations)
**Testing**: pytest (backend unit + contract tests), vitest (frontend)
**Target Platform**: Linux server (backend), PWA browser (frontend admin)
**Project Type**: Web application (backend + frontend)
**Performance Goals**: Leaderboard loads <5s, donor profile <3s, scope toggle <3s, CSV export <10s for 5,000 donors
**Constraints**: p95 API latency <500ms for leaderboard queries, tenant-isolated data (no cross-NPO leakage for non-privileged roles)
**Scale/Scope**: Up to 5,000 unique donors across 50 events per organization

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| YAGNI — no speculative features | PASS | Read-only dashboard, no new data entities, no feature flags needed |
| Donor-Driven Engagement — prioritize donor outcomes | PASS | This is an admin tool; does not impact donor UX. Aligns with principle by enabling targeted donor outreach |
| Data Security — tenant isolation | PASS | FR-012/FR-013 enforce role-based scoping; Super Admin/Auctioneer see only accessible NPOs |
| Production-Grade Quality — testable, documented | PASS | All aggregations are derived from existing data; contract tests validate API responses |
| Solo Developer Efficiency — leverage existing patterns | PASS | Follows EventDashboardService patterns exactly; reuses Recharts, TanStack Query |
| Minimalist Development | PASS | No new DB tables, no new migrations, no new external dependencies |

## Project Structure

### Documentation (this feature)

```
specs/039-donor-dashboard/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── donor-dashboard-api.yaml
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```
backend/
├── app/
│   ├── api/v1/
│   │   └── admin_donor_dashboard.py      # New API router
│   ├── schemas/
│   │   └── donor_dashboard.py            # New Pydantic schemas
│   ├── services/
│   │   └── donor_dashboard_service.py    # New aggregation service
│   └── tests/
│       ├── contract/
│       │   └── test_donor_dashboard_api.py
│       └── unit/
│           └── test_donor_dashboard_service.py

frontend/fundrbolt-admin/
├── src/
│   ├── features/
│   │   └── donor-dashboard/
│   │       ├── pages/
│   │       │   └── DonorDashboardPage.tsx
│   │       ├── components/
│   │       │   ├── DonorLeaderboard.tsx
│   │       │   ├── DonorProfilePanel.tsx
│   │       │   ├── OutbidLeadersTab.tsx
│   │       │   ├── BidWarsTab.tsx
│   │       │   ├── GivingCategoryCharts.tsx
│   │       │   └── ScopeToggle.tsx
│   │       └── hooks/
│   │           └── useDonorDashboard.ts
│   └── services/
│       └── donor-dashboard.ts            # API client
```

**Structure Decision**: Web application (backend + frontend). Backend follows the established `admin_event_dashboard.py` + `EventDashboardService` pattern. Frontend follows the `event-dashboard/` feature module pattern with Recharts charts and TanStack Query hooks.
