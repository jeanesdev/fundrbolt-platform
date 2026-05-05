# Quickstart: 044-checkout-i-need — Donor Event Checkout

**Date**: 2026-05-05 | **Branch**: `044-checkout-i-need`

---

## Prerequisites

1. Docker stack running: `make docker-up`
2. Backend started: `make dev-backend`
3. Frontend (donor-pwa) started: `cd frontend/donor-pwa && pnpm dev`
4. Frontend (admin) started: `cd frontend/fundrbolt-admin && pnpm dev`
5. Migration applied: `make migrate`
6. Seed data: `make db-seed` (creates test event, donor, admin accounts)

---

## Scenario 1: Admin Opens Checkout → Donor Completes Full Card Flow

### Setup
- Event: `Test Gala 2026` (slug: `test-gala-2026`)
- Donor account: `donor@test.com` / `TestPass123!`
- Admin account: `admin@test.com` / `TestPass123!`
- Donor has: 1 auction win ($250), 1 quick-entry donation ($100)

### Steps

**Admin side** (Admin PWA at http://localhost:5173):
1. Log in as `admin@test.com`
2. Navigate to **Events → Test Gala 2026 → Checkout** tab
3. Verify `is_open = false`, `processing_fee_rate` shows current global rate (2.9%)
4. Click **"Open Checkout"** button
5. Confirm `is_open = true`, `opened_at` timestamp shown, `processing_fee_rate` snapshotted

**Donor side** (Donor PWA at http://localhost:5174):
1. Log in as `donor@test.com`
2. Navigate to **My Event** page for Test Gala 2026
3. ✅ Checkout summary card appears at bottom showing ~$350 estimated total
4. Click the card's **"Review & Pay"** link
5. ✅ Full Checkout page loads with 2 line items: "Winning Bid – Lot #12" ($250), "Paddle Raise" ($100)
6. ✅ Payment method defaults to **Card**; processing fee checkbox is checked ($10.15 @ 2.9%)
7. ✅ Auctioneer Tip section shows $20/$50/$100 buttons; **$50** is pre-selected
8. ✅ FundrBolt Tip section shows $5/$10/$25 buttons; **$0** is pre-selected (none selected)
9. Select **$25** auctioneer tip and **$10** FundrBolt tip
10. Observe total updating: $350 + $10.15 + $25 + $10 = **$395.15**
11. First swipe slider → label changes to "Confirm Payment"
12. Second swipe slider → loading state → success screen
13. ✅ Success screen shows total paid, event details
14. ✅ Check `donor@test.com` inbox → receipt email received with event logo and PDF attachment
15. Navigate back to Checkout page
16. ✅ Page shows read-only receipt summary; swipe UI hidden
17. Click **"Download Receipt"** button → PDF downloads

### Expected API calls
- `GET /api/v1/events/{event_id}/checkout/session` → creates session lazily
- `PATCH /api/v1/events/{event_id}/checkout/session` (on tip change)
- `POST /api/v1/events/{event_id}/checkout/confirm`
- `GET /api/v1/events/{event_id}/checkout/receipt`

---

## Scenario 2: Admin Schedules Auto-Open → Celery Fires

### Steps
1. Admin: Navigate to **Checkout** tab for event
2. Click **"Schedule Auto-Open"**, set time to **+2 minutes from now**
3. Confirm `scheduled_open_at` shows in UI; `is_open = false`
4. Wait 2 minutes
5. ✅ `is_open` flips to `true` in admin UI (refresh or 10 s poll)
6. ✅ Donor My Event page shows checkout card

### Backend verification
```bash
cd backend && poetry run celery -A app.celery_app inspect active
```
Should show `auto_open_checkout_task` before it fires.

---

## Scenario 3: Admin Modifies Donor Items Mid-Checkout (Real-Time Banner)

### Setup
- Donor is on Checkout page, **has not confirmed** (status = in_progress)
- Admin is on donor status dashboard

### Steps
1. Donor opens Checkout page (leave browser tab open)
2. Admin: Navigate to **Checkout → Donors → `donor@test.com`**
3. Admin: Click **"+ Add Item"**, add "Extra raffle ticket" $25
4. Within 10 seconds, observe Donor PWA tab:
   - ✅ "Your items were updated by the organizer. Please review before confirming." banner appears
   - ✅ Swipe-to-confirm is disabled (grayed out)
   - ✅ Item list refreshes with new $25 line item
5. Donor clicks **"Got it"** to dismiss banner
6. ✅ Swipe-to-confirm re-enables
7. Verify admin audit log shows `item_added` entry with admin identity

---

## Scenario 4: Cash Payment Method Selected

### Steps
1. Donor opens Checkout page
2. Select **Cash** from payment method selector
3. ✅ Processing fee line item disappears; checkbox hidden
4. ✅ Booth instructions card appears: "Please visit the checkout booth to pay in cash. Make checks payable to: [NPO Name]."
5. ✅ Total recalculates (no processing fee)
6. ✅ Swipe-to-confirm still present and functional
7. Complete checkout — ✅ success screen shows "Cash payment recorded"

---

## Scenario 5: Empty State (No Items)

### Setup
- New test donor account: `noitems@test.com` (registered but has no bids/tickets)

### Steps
1. Admin opens checkout for event
2. Log in as `noitems@test.com`
3. Navigate to My Event page
4. ✅ Checkout card appears but shows: "You have no items to check out."
5. ✅ No "Review & Pay" link; no payment flow shown
6. Admin: Add manual item "Door prize selection" $50 to this donor's checkout
7. Within 10 s (or on next page load):
8. ✅ Checkout card updates to standard summary with $50 total and "Review & Pay" link

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Checkout card not appearing on My Event page | Verify `checkout_configurations.donor_visible = true` for the event |
| Swipe doesn't fire confirm | Check `acknowledged_items_updated_at` echoed in POST body matches session |
| PDF receipt not attached to email | Check WeasyPrint system deps: `docker exec backend dpkg -l libpango*` |
| Celery task not firing | Ensure Redis running: `make docker-logs | grep redis`; check `celery beat` is started |
| "Rate limit" error on Contact Admin | Wait 20 min; donor can send max 3 messages/hour |
