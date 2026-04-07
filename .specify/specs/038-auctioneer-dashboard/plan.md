# Implementation Plan: Auctioneer Dashboard

**Branch**: `038-auctioneer-dashboard` | **Date**: 2026-04-04 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/038-auctioneer-dashboard/spec.md`

## Summary

Add an "Auctioneer" role with invitation-only onboarding, per-item commission/fee tracking, a dedicated earnings dashboard with category-level earning percentages, a live auction tab with real-time bidding activity, and event timing countdowns. The Auctioneer role extends the existing invitation system and NPO member model, with restricted read-only access to most admin sections and edit access to auction items. Commission data is private to the auctioneer and Super Admins. A new live_auction_start_datetime field is added to the event model alongside the existing auction_close_datetime.

## Technical Context

**Language/Version**: Python 3.11+ (Backend), TypeScript 5.x (Frontend)
**Primary Dependencies**: FastAPI 0.120+, SQLAlchemy 2.0+, Pydantic 2.0+, Alembic (Backend); React 18+, Vite, TanStack Router, Zustand, Radix UI, Tailwind CSS 4 (Frontend)
**Storage**: Azure Database for PostgreSQL (3 new tables: auctioneer_item_commissions, auctioneer_event_settings; 1 new column on events: live_auction_start_datetime; existing auction_close_datetime needs model mapping), Azure Cache for Redis (permission caching)
**Testing**: pytest (backend), Vitest (frontend)
**Target Platform**: Web (Admin PWA at localhost:5173)
**Project Type**: Web application (backend + frontend monorepo)
**Performance Goals**: Dashboard loads <2s, Live Auction tab bid updates <500ms via Socket.IO, countdown timers accurate to 1s
**Constraints**: Commission data visibility restricted to owning auctioneer + Super Admin only, no double-counting between per-item and category-level earnings
**Scale/Scope**: 1-5 auctioneers per event, 10-500 auction items per event, real-time bid updates during live auction

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| Donor-Driven Engagement | PASS | Live auction tab and real-time updates enhance auctioneer effectiveness, indirectly improving donor experience |
| Real-Time Reliability | PASS | Live Auction tab uses Socket.IO for <500ms bid updates, consistent with constitution's 500ms target |
| Production-Grade Quality | PASS | New role integrated into existing RBAC system, Alembic migrations, full test coverage planned |
| Solo Developer Efficiency | PASS | Extends existing invitation, permission, and dashboard patterns — minimal new infrastructure |
| Data Security and Privacy | PASS | Commission data visibility scoped to auctioneer + Super Admin, enforced at API and UI layer |
| YAGNI | PASS | All features directly requested in spec, no speculative additions |

## Project Structure

### Documentation (this feature)

```
specs/038-auctioneer-dashboard/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api-contracts.md
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```
backend/
├── alembic/versions/
│   └── 038_add_auctioneer_role_and_tables.py
├── app/
│   ├── models/
│   │   ├── auctioneer.py          # AuctioneerItemCommission, AuctioneerEventSettings
│   │   └── event.py               # +live_auction_start_datetime, map auction_close_datetime
│   ├── schemas/
│   │   └── auctioneer.py          # Request/response schemas
│   ├── services/
│   │   ├── auctioneer_service.py  # Commission CRUD, earnings calculation
│   │   └── permission_service.py  # +auctioneer role checks
│   ├── api/v1/
│   │   ├── admin_auctioneer.py    # Auctioneer dashboard & commission endpoints
│   │   └── invitations.py         # Extend to support auctioneer role
│   └── websocket/
│       └── notification_ws.py     # +auction:bid_placed event for live tab
└── tests/

frontend/fundrbolt-admin/
├── src/
│   ├── features/
│   │   └── auctioneer/
│   │       ├── pages/
│   │       │   ├── AuctioneerDashboardPage.tsx
│   │       │   └── LiveAuctionTab.tsx
│   │       ├── components/
│   │       │   ├── EarningsSummary.tsx
│   │       │   ├── CommissionGallery.tsx
│   │       │   ├── CategoryPercentages.tsx
│   │       │   ├── EventTotals.tsx
│   │       │   ├── CountdownTimers.tsx
│   │       │   ├── CurrentItemCard.tsx
│   │       │   ├── HighBidderCard.tsx
│   │       │   └── BidHistory.tsx
│   │       └── hooks/
│   │           ├── useAuctioneerEarnings.ts
│   │           └── useLiveAuctionBids.ts
│   └── routes/
│       └── _authenticated/events/$eventSlug/auctioneer/
```

**Structure Decision**: Web application (Option 2). Backend extends existing FastAPI app with new models, service, and API module. Frontend adds a new `auctioneer` feature module inside the admin PWA with dedicated pages and components.

## Complexity Tracking

No constitution violations. No complexity justifications needed.
