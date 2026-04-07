# Quickstart: Donor Dashboard

**Feature**: 039-donor-dashboard

## What This Feature Does

Adds an admin-facing Donor Dashboard that lets NPO Admins, Event Coordinators, Auctioneers, and Super Admins analyze donor giving behavior. No new database tables — all data is aggregated from existing models.

## Backend

### New Files
- `backend/app/services/donor_dashboard_service.py` — Aggregation service
- `backend/app/schemas/donor_dashboard.py` — Pydantic response schemas
- `backend/app/api/v1/admin_donor_dashboard.py` — API router (6 endpoints)

### Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/admin/donor-dashboard/leaderboard` | Paginated donor leaderboard |
| GET | `/api/v1/admin/donor-dashboard/leaderboard/export` | CSV export |
| GET | `/api/v1/admin/donor-dashboard/donors/{user_id}` | Donor profile detail |
| GET | `/api/v1/admin/donor-dashboard/outbid-leaders` | Outbid leaders ranking |
| GET | `/api/v1/admin/donor-dashboard/bid-wars` | Bid war engagement |
| GET | `/api/v1/admin/donor-dashboard/category-breakdown` | Giving category charts |

### Register Router
In `backend/app/api/v1/__init__.py`:
```python
from app.api.v1 import admin_donor_dashboard
api_router.include_router(admin_donor_dashboard.router)
```

## Frontend

### New Feature Module
`frontend/fundrbolt-admin/src/features/donor-dashboard/`

### Key Components
- `DonorDashboardPage.tsx` — Main page with scope toggle and tab navigation
- `DonorLeaderboard.tsx` — Ranked list with sortable columns
- `DonorProfilePanel.tsx` — Slide-out panel (or full page) for individual donor detail
- `OutbidLeadersTab.tsx` — Outbid ranking view
- `BidWarsTab.tsx` — Bid war analysis view
- `GivingCategoryCharts.tsx` — Recharts pie/bar charts for category breakdowns
- `ScopeToggle.tsx` — "This Event" / "All Events" toggle

### Route
Add route in TanStack Router config: `/donor-dashboard`

## Testing

### Backend
```bash
cd backend && poetry run pytest app/tests/contract/test_donor_dashboard_api.py -v
cd backend && poetry run pytest app/tests/unit/test_donor_dashboard_service.py -v
```

### Frontend
```bash
cd frontend/fundrbolt-admin && pnpm test
```

## Dependencies

No new packages required. Uses existing:
- Recharts (charts)
- TanStack Query (data fetching)
- Radix UI (tabs, panels)
