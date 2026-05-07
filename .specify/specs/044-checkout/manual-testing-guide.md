# Manual Testing Guide: Donor Event Checkout (Feature 044)

**Branch**: `044-checkout` | **PR**: #104
**Purpose**: Step-by-step instructions to verify this feature is production-ready before calling it complete.

---

## Prerequisites

### 1. Start the local stack

```bash
make docker-up          # PostgreSQL + Redis
make migrate            # Apply checkout migration (adds 5 new tables)
make db-seed            # Seed test accounts + test event data
make dev-backend        # FastAPI at http://localhost:8000
```

In two separate terminals:
```bash
cd frontend/fundrbolt-admin && pnpm dev   # Admin PWA at http://localhost:5173
cd frontend/donor-pwa && pnpm dev         # Donor PWA  at http://localhost:5174
```

### 2. Test accounts (created by db-seed)

| Role | Email | Password |
|------|-------|----------|
| NPO Admin | `admin@test.com` | `TestPass123!` |
| Donor (has items) | `donor@test.com` | `TestPass123!` |
| Donor (no items) | `noitems@test.com` | `TestPass123!` |

### 3. Verify migration ran

```bash
cd backend && poetry run alembic current
# Should show: co_001_add_checkout_tables (head)
```

You can also check:
```sql
\dt checkout_*   -- should show 3 tables
\dt processing_fee_configs
\dt checkout_configurations
```

---

## Test Suite

---

### TC-01 · Admin Opens Checkout (US2 — core flow)

**Goal**: Verify the admin can open checkout for an event and it appears for donors.

**Steps**:
1. Log into Admin PWA (`http://localhost:5173`) as `admin@test.com`
2. Navigate to **Events → Test Gala 2026**
3. Click the **Checkout** tab in the event detail view
4. Confirm `Status: Closed` and `Processing Fee Rate: 2.9%` (from global config)
5. Click **"Open Checkout"**
6. ✅ Status changes to `Open`, `Opened At` timestamp appears, fee rate shown as snapshotted value

**Donor verification**:
7. In a second browser/incognito, log into Donor PWA as `donor@test.com`
8. Navigate to **My Event → Test Gala 2026**
9. ✅ A checkout summary card appears at the bottom of the My Event home page
10. ✅ Card shows approximate total (auction wins + pledges) and a "Review & Pay" link

**Pass criteria**: Admin can open checkout; checkout card appears for donors within one page load.

---

### TC-02 · Donor Checkout — Card Payment Full Flow (US1 — happy path)

**Prerequisites**: TC-01 complete (checkout open). Donor has at least one auction win or paddle-raise.

**Steps**:
1. As `donor@test.com` in Donor PWA, click **"Review & Pay"** from the checkout card
2. ✅ Checkout page loads with itemized list (auction wins, paddle raises, etc.)
3. ✅ Payment method defaults to **Card**
4. ✅ "Cover the 2.9% processing fee" checkbox is **checked by default**
5. ✅ Processing fee line item appears in the total breakdown
6. ✅ Auctioneer Tip section shows preset buttons ($25, $50, $100); **$50 is pre-selected**
7. ✅ FundrBolt Tip section shows preset buttons; **$0 is pre-selected** (none selected)
8. Select a **custom auctioneer tip** using the wheel picker (e.g. $75)
   - ✅ Tip updates to $75; total recalculates
9. Select **$10** for FundrBolt tip
10. Perform the **first swipe** on the "Swipe to confirm" slider
    - ✅ Slider label changes to "Confirm payment"
    - ✅ A second swipe appears (double-confirm pattern)
11. Perform the **second swipe**
    - ✅ Loading/processing state appears briefly
    - ✅ Success screen appears with total paid and event name
12. ✅ Check email inbox for `donor@test.com` — receipt email arrives with:
    - Event name and logo
    - Itemized charges, tips, processing fee, and total
    - PDF receipt attached (or download link)
13. Navigate back to the **Checkout** page
    - ✅ Page renders in **read-only receipt mode** (no swipe UI)
    - ✅ Shows all items, total, payment method, date
    - ✅ "Download Receipt" link/button works

**Pass criteria**: Full card checkout completes end-to-end; email receipt received; page read-only after completion.

---

### TC-03 · Processing Fee — Uncheck to Opt Out

**Prerequisites**: TC-01 complete, donor on checkout page.

**Steps**:
1. Verify "Cover the 2.9% processing fee" checkbox is checked (default)
2. ✅ Processing fee amount shown in total breakdown
3. Uncheck the checkbox
4. ✅ Processing fee **disappears** from breakdown; total decreases
5. Re-check the checkbox
6. ✅ Processing fee reappears; total increases

**Pass criteria**: Fee dynamically appears/disappears; total recalculates correctly.

---

### TC-04 · Cash / Check / DAF Payment Method (US1 — offline payment)

**Prerequisites**: TC-01 complete, donor on checkout page.

**Steps**:
1. Click **"Cash"** in the payment method selector
2. ✅ Processing fee disappears (fee waived for offline payments)
3. ✅ "Cover processing fee" checkbox is **hidden**
4. ✅ Booth instruction card appears: e.g., "Please visit the checkout booth to pay in cash. Make checks payable to: [NPO Name]"
5. ✅ Swipe-to-confirm is still present and functional
6. Complete the double-swipe — ✅ success screen shows "Cash payment recorded"
7. Repeat steps with **Check** and **DAF** — same behavior expected

**Pass criteria**: Offline methods waive fee, show booth instructions, and complete normally.

---

### TC-05 · Card View & Change (US1 — FR-011)

**Prerequisites**: Donor on checkout page, Card payment method selected.

**Steps**:
1. With **Card** selected, look for the saved card display (last 4 digits, expiry)
2. ✅ Current card is shown (or prompt to add card if none saved)
3. Click **"Change"** or **"View / Change Card"** button
4. ✅ Card selector appears listing saved cards
5. Select a different card (or add a new one via the card entry form)
6. ✅ Selected card updates in the checkout UI
7. Proceed with checkout

**Pass criteria**: Donor can view and change their payment card before confirming.

---

### TC-06 · Real-Time Item Update Banner (US3 — FR-017)

**Goal**: Verify that admin item changes trigger a banner that blocks checkout until acknowledged.

**Setup**: Two browsers — Admin PWA and Donor PWA.

**Steps**:
1. Donor: Open Checkout page, **do NOT complete checkout** (leave in progress)
2. Admin: Navigate to **Checkout → Donors**, find `donor@test.com`, click **"Manage Items"**
3. Admin: Click **"+ Add Item"** and add "Extra raffle ticket" for $25, click Save
4. Wait up to **10 seconds** (polling interval) and watch the donor's browser:
   - ✅ Sticky banner appears: "Your items were updated by the organizer. Please review before confirming."
   - ✅ Swipe-to-confirm sliders are **disabled / grayed out**
   - ✅ New $25 line item appears in the item list
5. Donor: Click **"Got it"** (dismiss button)
   - ✅ Banner disappears
   - ✅ Swipe-to-confirm **re-enables**
6. Alternatively: **scroll past** the banner (scroll up quickly)
   - ✅ Banner auto-acknowledges when scrolled fully out of view (IntersectionObserver)

**Pass criteria**: Banner blocks checkout; dismiss and scroll-past both re-enable swipes.

---

### TC-07 · Admin Monitors Checkout Status (US3)

**Steps**:
1. Admin: Navigate to **Events → Test Gala 2026 → Checkout → Donors** tab
2. ✅ All registered donors are listed
3. ✅ Each row shows a **status badge**: `Not Started`, `In Progress`, or `Complete`
4. Have `donor@test.com` start (but not complete) checkout — status updates to **In Progress**
5. Complete checkout as donor — status updates to **Complete**
6. ✅ Completed rows show timestamp and payment method

**Pass criteria**: Dashboard accurately reflects per-donor checkout status.

---

### TC-08 · Admin Add / Remove / Reprice Items (US3)

**Steps**:
1. Admin: Open `donor@test.com`'s item list from the checkout dashboard
2. **Add item**: Click "+ Add Item", enter "Custom donation" $100, save
   - ✅ Item appears in donor's checkout (within 10 s)
3. **Reprice item**: Click edit on an existing item, change price, save
   - ✅ Price updates in donor's checkout
4. **Remove item**: Click remove/delete on an item, confirm
   - ✅ Item disappears from donor's checkout
5. ✅ Each action is visible in the **audit log** section of the admin panel

**Pass criteria**: All three item management operations work; audit trail is created.

---

### TC-09 · Admin Sends Checkout Link (US4)

**Steps**:
1. Admin: Navigate to **Checkout** tab for the event
2. Click **"Send Checkout Link"**
3. Choose **"All Incomplete Donors"** (or select specific donors)
4. Click **Send**
5. ✅ `donor@test.com` (if not yet complete) receives a push notification / email with a direct link to checkout
6. Click the link — ✅ Opens directly to the checkout page for the correct event

**Pass criteria**: Notification sent; link routes correctly.

---

### TC-10 · Donor Contacts Admin (US5)

**Prerequisites**: Checkout open, donor on checkout page.

**Steps**:
1. As donor on Checkout page, find the **"Contact Admin"** link/button (bottom of page)
2. Click it — ✅ A brief form appears (optional message, 500-char max)
3. Type a message: "I think my auction win total is incorrect"
4. Click **Send**
5. ✅ Confirmation appears; button disabled briefly (rate-limit: 3 messages/hour)
6. **Admin side**: ✅ Admin receives email notification and (if configured) push notification with donor's name, event, and message

**Pass criteria**: Message sent; admin receives notification.

---

### TC-11 · Scheduled Auto-Open (US2 — Celery)

**Prerequisites**: Checkout currently closed. Celery worker running.

```bash
# In a separate terminal:
cd backend && poetry run celery -A app.celery_app worker --loglevel=info
```

**Steps**:
1. Admin: In the **Checkout** tab, click **"Schedule Auto-Open"**
2. Set time to **2 minutes from now**
3. ✅ Scheduled time appears in UI; status shows `Scheduled`
4. Wait 2 minutes
5. ✅ Status flips to `Open` in Admin UI (may require manual refresh or 10 s poll)
6. ✅ Donors can now see the checkout card in their My Event page

**Cancel test**:
7. Close checkout, schedule it again for 5 minutes from now
8. Click **"Cancel Schedule"**
9. ✅ Scheduled time cleared; status returns to `Closed`
10. Wait 5 minutes — checkout does NOT auto-open (Celery task cancelled)

**Pass criteria**: Checkout auto-opens at scheduled time; cancel prevents open.

---

### TC-12 · Empty State (No Items)

**Steps**:
1. Admin: Open checkout for event
2. Log in as `noitems@test.com` in Donor PWA
3. Navigate to My Event → Test Gala 2026
4. ✅ Checkout card appears but shows "You have no items to check out" (or similar)
5. ✅ No "Review & Pay" link; no payment flow
6. Admin: Add a manual item $50 to `noitems@test.com`'s checkout (TC-08 steps)
7. Donor: Refresh or wait 10 s
8. ✅ Checkout card now shows standard summary with "Review & Pay" link

**Pass criteria**: Empty state handled gracefully; admin can add items to get donor into checkout.

---

### TC-13 · Processing Fee Config (Super Admin)

**Steps**:
1. Log into Admin PWA as super-admin
2. Navigate to **Settings → Processing Fee**
3. ✅ Current global rate shows (e.g., 2.9%)
4. Change rate to **3.5%** and save
5. **Close** and re-**open** checkout for an event
6. ✅ Snapshotted rate on the new checkout configuration is **3.5%**
7. Note: Donors already in checkout with a previous rate are **not** affected (snapshot is taken at open time)

**Pass criteria**: Global fee configurable; new rate snapshotted correctly at checkout open.

---

### TC-14 · Re-Open Guard (C13 remediation)

**Goal**: Verify that re-opening a checkout doesn't overwrite the snapshotted fee rate.

**Steps**:
1. Open checkout for an event (fee snapshotted at 2.9%)
2. Close checkout
3. Change global fee to 3.5%
4. Re-open checkout for the **same event**
5. ✅ Admin UI shows the **original 2.9%** rate (not 3.5%) — rate snapshot from first open is preserved

**Pass criteria**: Processing fee rate is NOT overwritten on re-open.

---

### TC-15 · Read-Only State for Completed Checkout

**Steps**:
1. Complete checkout as `donor@test.com` (TC-02)
2. Return to Checkout page URL for the same event
3. ✅ Page shows completed receipt view with: all items, tips, fee, total, payment method, completion date
4. ✅ No swipe sliders, tip selectors, or payment method chooser visible
5. ✅ "Download Receipt" button/link works (downloads PDF or opens receipt email)
6. ✅ If admin modifies items after completion, NO update banner appears (session is complete)

**Pass criteria**: Completed checkout is strictly read-only; no re-submission possible.

---

## Edge Cases to Check

| Scenario | Expected Behaviour |
|----------|--------------------|
| Admin closes checkout while donor is mid-flow | Donor sees "Checkout is now closed" message; swipes disabled |
| Donor tries GET /checkout/session when checkout is closed | `403 Checkout not open` |
| Donor submits checkout twice (double-POST) | Second confirm returns `409 Checkout already complete` |
| Revenue generator entries in checkout | Items with source `revenue_generator` appear in itemized list |
| Donor selects DAF payment | Same UX as Cash/Check: fee waived, booth instructions shown |
| Custom tip via wheel picker (zero) | $0 is valid; no tip line item added to breakdown |
| Very large tip (e.g. $9,999) | Accepted; included in total; receipt shows correctly |

---

## Calling the Feature Complete

The feature is ready to ship when:

- [ ] TC-01 through TC-10 all pass (core user stories)
- [ ] TC-11 passes (or is deferred if Celery/Redis not in test scope)
- [ ] TC-12 through TC-15 pass (edge cases / guard rails)
- [ ] Receipt emails are delivered with accurate itemization
- [ ] Admin checkout dashboard accurately reflects real-time donor status
- [ ] No console errors or broken layouts on mobile screen sizes (375px viewport)
- [ ] Backend logs show no unhandled exceptions during the above flows

---

## Known Limitations / Deferred Items

- **Payment processing**: This implementation uses a **simulated** payment (stubbed). Real Stripe/payment processor integration is outside scope for this feature.
- **WeasyPrint system deps**: The PDF receipt generation requires `libpango` system libraries. In Docker, these are pre-installed. On bare-metal dev, install via `sudo apt-get install python3-weasyprint` or equivalent.
- **SMS for Contact Admin**: Twilio integration for SMS notifications requires valid credentials in environment variables (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`). If not configured, the contact-admin action still sends email + push notifications.
- **Celery beat**: Scheduled auto-open requires both a Celery worker AND Celery beat to be running. In development, start them separately with `poetry run celery -A app.celery_app beat` and `poetry run celery -A app.celery_app worker`.
