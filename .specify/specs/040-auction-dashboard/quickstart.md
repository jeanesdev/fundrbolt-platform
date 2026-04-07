# Quickstart: Auction Dashboard (040)

## What This Feature Does

Adds a read-only analytics dashboard for auction items within the admin PWA. Admins can view summary stats, visual charts, and a sortable/filterable/searchable items table. They can drill down into any item to see its complete bid history and a bid-value timeline chart. Supports "This Event" vs "All Events" scope, card view for mobile, and CSV export.

## Prerequisites

- Existing auction items and bids in the database (via features 008, 019)
- Running backend (FastAPI) and frontend (admin PWA)
- User with admin role (super_admin, npo_admin, or event_coordinator)

## New Files Overview

### Backend
| File | Purpose |
|------|---------|
| `backend/app/api/v1/admin_auction_dashboard.py` | 4 API endpoints: summary, items list, charts, item detail |
| `backend/app/services/auction_dashboard_service.py` | Aggregation queries, access control, CSV export logic |
| `backend/app/schemas/auction_dashboard.py` | Pydantic request/response models |
| `backend/app/tests/test_auction_dashboard.py` | Contract + integration tests |

### Frontend
| File | Purpose |
|------|---------|
| `frontend/.../routes/.../auction-dashboard.tsx` | Route entry point |
| `frontend/.../routes/.../auction-dashboard/$itemId.tsx` | Item detail route |
| `frontend/.../features/auction-dashboard/AuctionDashboardPage.tsx` | Main dashboard page |
| `frontend/.../features/auction-dashboard/AuctionItemDetailPage.tsx` | Item detail page |
| `frontend/.../features/auction-dashboard/components/` | Summary cards, table, charts, bid history, timeline |
| `frontend/.../features/auction-dashboard/hooks/useAuctionDashboard.ts` | React Query hooks |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/admin/auction-dashboard/summary` | Summary stats (total items, bids, revenue, avg bid) |
| GET | `/api/v1/admin/auction-dashboard/items` | Paginated items list (sortable, searchable, filterable) |
| GET | `/api/v1/admin/auction-dashboard/items/export` | CSV export of filtered items |
| GET | `/api/v1/admin/auction-dashboard/charts` | Chart data (revenue by type/category, top 10s, bid counts) |
| GET | `/api/v1/admin/auction-dashboard/items/{item_id}` | Item detail with bid history + timeline |

All endpoints require admin authentication and respect event access permissions.

## Key Patterns

- **Scope toggle**: `event_id` query param — present = "This Event", absent = "All Events"
- **Access control**: Reuses `_resolve_accessible_npo_ids()` pattern from donor dashboard
- **Auto-refresh**: React Query `refetchInterval: 60000` + manual refresh button
- **Table**: TanStack React Table 8 with sortable columns, pagination (25/page), search
- **Charts**: Recharts (bar charts, pie charts, line chart for timeline)
- **Card view**: Toggle button switches between table and card grid layout
- **Navigation**: Item click navigates to `/events/{eventId}/auction-dashboard/{itemId}`

## Testing

```bash
# Backend tests
cd backend && poetry run pytest app/tests/test_auction_dashboard.py -v

# Frontend (lint + build)
cd frontend/fundrbolt-admin && pnpm lint && pnpm build
```
