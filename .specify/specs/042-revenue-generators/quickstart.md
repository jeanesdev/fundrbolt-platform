# Quickstart: Revenue Generators

**Feature**: 042-revenue-generators
**Date**: 2026-05-01

## Prerequisites

- Docker Compose running (PostgreSQL + Redis): `make docker-up`
- Backend dependencies installed: `cd backend && poetry install`
- Admin frontend dependencies installed: `cd frontend/fundrbolt-admin && pnpm install`
- Donor PWA dependencies installed: `cd frontend/donor-pwa && pnpm install`

## Setup Steps

### 1. Run Database Migration

```bash
cd backend && poetry run alembic upgrade head
```

This creates:
- `revenue_generator_items` table
- `revenue_generator_entries` table
- `revenue_generator_winner_selections` table

### 2. Start Services

```bash
# Terminal 1: Backend
make dev-backend

# Terminal 2: Admin frontend (http://localhost:5173)
make dev-frontend

# Terminal 3: Donor PWA (http://localhost:5174)
cd frontend/donor-pwa && pnpm dev
```

### 3. Seed Test Data

You need: one event, two registered donors with bidder numbers.

#### Option A: Via Admin UI (production flow)

1. Log in as Super Admin (`http://localhost:5173`)
2. Create or open an existing event
3. Create two test donor accounts and register them for the event (they will receive bidder numbers 1 and 2)
4. Note the event UUID from the URL

#### Option B: Via API (development shortcut)

```bash
# Get admin token
ADMIN_TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"Test1234!"}' | jq -r '.access_token')

# Get event ID (first event)
EVENT_ID=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8000/api/v1/events | jq -r '.[0].id')

echo "Event ID: $EVENT_ID"
```

---

## User Story Test Scenarios

### US1 — Donor Purchases Entries via Play Tab

**Goal**: Verify donors can purchase entries and see their own count, not aggregate.

```bash
# 1. Create a Revenue Generator item
curl -X POST "http://localhost:8000/api/v1/admin/events/$EVENT_ID/revenue-generators" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "50/50 Raffle",
    "description": "Half the pot goes to the winner!",
    "price_per_entry": 10.00,
    "is_visible": false,
    "is_open_for_entries": true
  }'

# Note the returned item ID
ITEM_ID="<item-id-from-response>"

# 2. Make the item visible (toggle visibility)
curl -X PATCH "http://localhost:8000/api/v1/admin/events/$EVENT_ID/revenue-generators/$ITEM_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"is_visible": true}'

# 3. Get donor token
DONOR_TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"donor1@test.com","password":"Test1234!"}' | jq -r '.access_token')

# 4. Donor views the Play tab — should see the item
curl "http://localhost:8000/api/v1/events/$EVENT_ID/revenue-generators" \
  -H "Authorization: Bearer $DONOR_TOKEN"
# Expected: item in list, my_entry_count=0

# 5. Donor purchases an entry
curl -X POST "http://localhost:8000/api/v1/events/$EVENT_ID/revenue-generators/$ITEM_ID/entries" \
  -H "Authorization: Bearer $DONOR_TOKEN"
# Expected: 201, my_entry_count=1

# 6. Donor purchases another entry
curl -X POST "http://localhost:8000/api/v1/events/$EVENT_ID/revenue-generators/$ITEM_ID/entries" \
  -H "Authorization: Bearer $DONOR_TOKEN"
# Expected: 201, my_entry_count=2

# 7. Donor views item again — should see their own count only
curl "http://localhost:8000/api/v1/events/$EVENT_ID/revenue-generators" \
  -H "Authorization: Bearer $DONOR_TOKEN"
# Expected: my_entry_count=2, NO aggregate total from other donors
```

**Pass criteria**: `my_entry_count` increments with each purchase; no `total_entries` field visible to donor.

---

### US2 — Admin Creates and Manages Items

**Goal**: Verify admin can create items, toggle visibility, and donor app reflects changes within 5 seconds (SC-002).

```bash
# 1. Create item (hidden by default)
curl -X POST "http://localhost:8000/api/v1/admin/events/$EVENT_ID/revenue-generators" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Duck Pond Game","price_per_entry":5.00,"is_visible":false}'

ITEM_ID="<item-id-from-response>"

# 2. Donor checks Play tab — item should NOT appear
curl "http://localhost:8000/api/v1/events/$EVENT_ID/revenue-generators" \
  -H "Authorization: Bearer $DONOR_TOKEN"
# Expected: item not in list (or list empty)

# 3. Admin toggles visibility on
curl -X PATCH "http://localhost:8000/api/v1/admin/events/$EVENT_ID/revenue-generators/$ITEM_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"is_visible": true}'

# 4. Donor checks Play tab again — item SHOULD appear (within 5 seconds)
curl "http://localhost:8000/api/v1/events/$EVENT_ID/revenue-generators" \
  -H "Authorization: Bearer $DONOR_TOKEN"
# Expected: item appears with is_open_for_entries=true

# 5. Admin closes entries (visible but closed)
curl -X PATCH "http://localhost:8000/api/v1/admin/events/$EVENT_ID/revenue-generators/$ITEM_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"is_open_for_entries": false}'

# 6. Donor checks — item should still be visible but purchase disabled
curl "http://localhost:8000/api/v1/events/$EVENT_ID/revenue-generators" \
  -H "Authorization: Bearer $DONOR_TOKEN"
# Expected: item in list, is_open_for_entries=false

# 7. Attempt purchase on closed item — should fail
curl -X POST "http://localhost:8000/api/v1/events/$EVENT_ID/revenue-generators/$ITEM_ID/entries" \
  -H "Authorization: Bearer $DONOR_TOKEN"
# Expected: 409 Conflict
```

**Pass criteria**: Visibility toggle immediately reflected; closed item returns 409 on purchase attempt.

---

### US3 — Quick Entry Records Entries for Donors

**Goal**: Verify staff can record entries via Quick Entry using a bidder number.

```bash
# 1. List items available for Quick Entry
curl "http://localhost:8000/api/v1/admin/events/$EVENT_ID/quick-entry/revenue-generators" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# Expected: items where is_open_for_entries=true

# 2. Record an entry for bidder #1
curl -X POST "http://localhost:8000/api/v1/admin/events/$EVENT_ID/quick-entry/revenue-generators/entry" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"revenue_generator_item_id\": \"$ITEM_ID\", \"bidder_number\": 1}"
# Expected: 201, donor_total_entries=1

# 3. Record another entry for same bidder immediately (rapid submission test)
curl -X POST "http://localhost:8000/api/v1/admin/events/$EVENT_ID/quick-entry/revenue-generators/entry" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"revenue_generator_item_id\": \"$ITEM_ID\", \"bidder_number\": 1}"
# Expected: 201, donor_total_entries=2

# 4. Verify in admin entry list
curl "http://localhost:8000/api/v1/admin/events/$EVENT_ID/revenue-generators/$ITEM_ID/entries" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# Expected: bidder 1 appears with entry_count=2

# 5. Test invalid bidder number
curl -X POST "http://localhost:8000/api/v1/admin/events/$EVENT_ID/quick-entry/revenue-generators/entry" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"revenue_generator_item_id\": \"$ITEM_ID\", \"bidder_number\": 9999}"
# Expected: 409 (bidder not found)
```

**Pass criteria**: Entries recorded correctly; invalid bidder rejected; donor_total_entries increments per submission.

---

### US4 — Admin Selects Winner

**Goal**: Verify random draw and manual winner selection work correctly.

```bash
# Setup: ensure item has entries from multiple donors (run US3 steps for bidder 1 and 2)
# Bidder 1: 3 entries, Bidder 2: 1 entry (Bidder 1 should win ~75% of draws)

# 1. Random draw
curl -X POST "http://localhost:8000/api/v1/admin/events/$EVENT_ID/revenue-generators/$ITEM_ID/draw" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# Expected: 200 with winner_name, bidder_number, selection_method=random_draw
# Also expected: notifications_url in response for manual notification shortcut (FR-014)

# 2. Run draw again (overrides previous winner, both kept in history)
curl -X POST "http://localhost:8000/api/v1/admin/events/$EVENT_ID/revenue-generators/$ITEM_ID/draw" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 3. Check winner history — should have 2 records
curl "http://localhost:8000/api/v1/admin/events/$EVENT_ID/revenue-generators/$ITEM_ID/winner-history" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# Expected: array of 2 records, most recent first

# 4. Get an entry ID for manual selection
ENTRY_ID=$(curl -s "http://localhost:8000/api/v1/admin/events/$EVENT_ID/revenue-generators/$ITEM_ID/entries" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.entries[0].registration_guest_id')

# 5. Manual winner select — need to get a specific entry UUID
# First get raw entries to find entry UUIDs (implementation may expose this via entry list)

# 6. Test draw on empty item
curl -X DELETE "http://localhost:8000/api/v1/admin/events/$EVENT_ID/revenue-generators/$ITEM_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

EMPTY_ITEM_ID=$(curl -X POST "http://localhost:8000/api/v1/admin/events/$EVENT_ID/revenue-generators" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Empty Game","price_per_entry":5.00}' | jq -r '.id')

curl -X POST "http://localhost:8000/api/v1/admin/events/$EVENT_ID/revenue-generators/$EMPTY_ITEM_ID/draw" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# Expected: 409 "No entries exist"

# 7. Donor sees winner in Play tab
curl "http://localhost:8000/api/v1/events/$EVENT_ID/revenue-generators" \
  -H "Authorization: Bearer $DONOR_TOKEN"
# Expected: current_winner_name populated on item card
```

**Pass criteria**: Random draw produces valid recorded entry as winner; history preserved on re-draw; empty item returns 409; donor sees winner name.

---

### US5 — Revenue Generator Tallies in Event Dashboard

**Goal**: Verify dashboard shows separate RG totals that don't inflate auction totals.

```bash
# After recording entries in US1/US3 scenarios above:

# Check event dashboard for Revenue Generators section
curl "http://localhost:8000/api/v1/admin/events/$EVENT_ID/dashboard" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# Expected JSON path: .revenue_generators.total_revenue and .revenue_generators.total_entries
# Expected: RG revenue shown separately from .silent_auction.total and .live_auction.total
```

**Pass criteria**: `revenue_generators` section appears in dashboard; totals match recorded entries; values isolated from auction totals.

---

### US6 — Auctioneer Monitors Revenue Generator Activity

**Goal**: Verify auctioneer dashboard has dedicated RG tab and sticky header card.

1. Log in as auctioneer role (invite via NPO settings or create directly via API)
2. Navigate to `http://localhost:5173/events/<event-slug>/auctioneer`
3. Select the **Revenue Generators** tab
4. **Expected**: Each item shows entry count, donor list, and revenue total
5. Scroll down on the dashboard — sticky header should remain visible
6. **Expected**: Compact card per RG item in sticky header (item name, entry count, revenue)
7. Record a new entry via Quick Entry
8. **Expected**: Dashboard refreshes within the polling interval (near-real-time, per SC-004)

**Pass criteria**: Dedicated tab present; sticky header cards accurate; data refreshes without page reload.
