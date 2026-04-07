# Quickstart: Auctioneer Dashboard

**Feature**: 038-auctioneer-dashboard
**Date**: 2026-04-04

## Prerequisites

- Docker Compose running (PostgreSQL + Redis): `make docker-up`
- Backend dependencies installed: `cd backend && poetry install`
- Frontend dependencies installed: `cd frontend/fundrbolt-admin && pnpm install`

## Setup Steps

### 1. Run Database Migration

```bash
cd backend && poetry run alembic upgrade head
```

This adds:
- `auctioneer` role to the `roles` table
- `AUCTIONEER` to the `MemberRole` enum on `npo_members`
- `auctioneer_item_commissions` table
- `auctioneer_event_settings` table
- `live_auction_start_datetime` column on `events`
- Maps existing `auction_close_datetime` column in SQLAlchemy model

### 2. Start Backend

```bash
make dev-backend
```

### 3. Start Admin Frontend

```bash
make dev-frontend
```

### 4. Create Test Auctioneer

#### Option A: Via Invitation (production flow)
1. Log in as NPO Admin
2. Navigate to NPO settings → Team → Invite Member
3. Select role "Auctioneer" and choose an event
4. Enter auctioneer's email
5. Copy the invitation link
6. Open in incognito, register, and accept invitation

#### Option B: Via API (development shortcut)
```bash
# Create user with auctioneer role
curl -X POST http://localhost:8000/api/v1/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "auctioneer@test.com",
    "password": "Test1234!",
    "first_name": "Test",
    "last_name": "Auctioneer",
    "role_name": "auctioneer",
    "npo_id": "<your-npo-id>"
  }'
```

### 5. Verify Setup

```bash
# Log in as auctioneer
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "auctioneer@test.com", "password": "Test1234!"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Get dashboard (should return empty earnings)
curl -s http://localhost:8000/api/v1/admin/events/<event-id>/auctioneer/dashboard \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Set commission on an item
curl -X PUT http://localhost:8000/api/v1/admin/events/<event-id>/auctioneer/commissions/<item-id> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"commission_percent": "10.00", "flat_fee": "25.00", "notes": "Premium item"}'
```

## Key URLs

| Page | URL | Access |
|------|-----|--------|
| Auctioneer Dashboard | http://localhost:5173/events/{slug}/auctioneer | Auctioneer, Super Admin |
| Live Auction Tab | http://localhost:5173/events/{slug}/auctioneer/live | Auctioneer, Super Admin |
| Auction Items (editable) | http://localhost:5173/events/{slug}/auction-items | Auctioneer (edit), all admin roles (view) |

## Testing

```bash
# Run backend tests
cd backend && poetry run pytest app/tests/ -v -k "auctioneer"

# Run frontend tests
cd frontend/fundrbolt-admin && pnpm test -- --grep "auctioneer"
```
