# Implementation Plan: Auction Dashboard

**Branch**: `040-auction-dashboard` | **Date**: 2026-04-07 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/040-auction-dashboard/spec.md`

## Summary

Read-only analytics dashboard for auction item performance, providing admin users with summary statistics, visual charts (by auction type and category), a sortable/searchable/filterable items table with card view, item detail drill-down pages with complete bid history and bid-value timeline charts, CSV export, event scope toggle ("This Event" vs "All Events"), and 60-second auto-refresh. Follows the existing donor dashboard patterns for table/card toggle, scope toggle, and pagination.

## Technical Context

**Language/Version**: Python 3.11+ (backend), TypeScript 5.x (frontend)
**Primary Dependencies**: FastAPI 0.120+, SQLAlchemy 2.0+, Pydantic 2.0+ (backend); React 19, Vite 7, TanStack Router, TanStack React Table 8, TanStack React Query 5, Zustand, Radix UI, Recharts, Tailwind CSS 4 (frontend)
**Storage**: Azure Database for PostgreSQL (existing auction_items, auction_bids tables — no new migrations), Azure Cache for Redis (optional caching)
**Testing**: pytest (backend), pnpm test (frontend)
**Target Platform**: Web (admin PWA) — desktop and mobile responsive
**Project Type**: web (backend + frontend in monorepo)
**Performance Goals**: Dashboard loads within 3 seconds for 200 items; scope switch within 2 seconds; filter updates within 1 second
**Constraints**: Read-only dashboard (no mutations); 60-second auto-refresh + manual; 25 items/page pagination
**Scale/Scope**: Up to 200 auction items per event, up to 50 events per user in "All Events" mode

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| YAGNI / Minimalist Development | PASS | Implements only what spec requires — read-only analytics, no management actions |
| No new framework/dependency | PASS | Uses existing Recharts (already in donor dashboard), TanStack Table (already in use) |
| Solo Developer Efficiency | PASS | Follows established donor dashboard patterns, minimal new code surface |
| Data Security | PASS | Admin-only access via existing RBAC, bidder identity shows paddle# + name (no PII leak) |
| Performance SLOs | PASS | p95 <300ms target achievable with existing indexed queries |
| No scope creep | PASS | Out of Scope section explicitly excludes item/bid management actions |
| Testing requirements | PASS | Contract + integration tests for new endpoints, component tests for frontend |

## Project Structure

### Documentation (this feature)

```
specs/040-auction-dashboard/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── auction-dashboard-api.yaml
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```
backend/
├── app/
│   ├── api/v1/
│   │   └── admin_auction_dashboard.py      # New: dashboard API endpoints
│   ├── services/
│   │   └── auction_dashboard_service.py    # New: aggregation/analytics logic
│   ├── schemas/
│   │   └── auction_dashboard.py            # New: Pydantic response models
│   └── tests/
│       └── test_auction_dashboard.py       # New: API contract + integration tests

frontend/fundrbolt-admin/
├── src/
│   ├── routes/_authenticated/events/$eventId/
│   │   └── auction-dashboard.tsx                    # New: route file
│   ├── features/auction-dashboard/
│   │   ├── AuctionDashboardPage.tsx                 # New: main page component
│   │   ├── components/
│   │   │   ├── AuctionSummaryCards.tsx               # New: stat cards
│   │   │   ├── AuctionItemsTable.tsx                 # New: sortable/paginated table
│   │   │   ├── AuctionItemCard.tsx                   # New: card view item
│   │   │   ├── AuctionCharts.tsx                     # New: chart container
│   │   │   ├── RevenueByTypeChart.tsx                # New: chart
│   │   │   ├── RevenueByCategoryChart.tsx            # New: chart
│   │   │   ├── TopItemsChart.tsx                     # New: top 10 charts
│   │   │   └── BidCountByTypeChart.tsx               # New: chart
│   │   ├── AuctionItemDetailPage.tsx                 # New: item detail page
│   │   ├── components/
│   │   │   ├── ItemDetailHeader.tsx                  # New: item info section
│   │   │   ├── BidHistoryTable.tsx                   # New: bid history table
│   │   │   └── BidTimelineChart.tsx                  # New: bid value over time chart
│   │   └── hooks/
│   │       └── useAuctionDashboard.ts               # New: React Query hooks
│   └── routes/_authenticated/events/$eventId/
│       └── auction-dashboard/
│           └── $itemId.tsx                          # New: item detail route
```

**Structure Decision**: Web application following existing monorepo structure. Backend adds new API routes + service alongside existing admin_donor_dashboard pattern. Frontend adds new feature module under `features/auction-dashboard/` following the donor-dashboard component structure.

## Complexity Tracking

No constitution violations to justify — all gates pass.
