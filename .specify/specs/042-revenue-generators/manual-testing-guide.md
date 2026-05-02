# Manual Testing Guide — Revenue Generators (042)

This guide walks you through all scenarios needed to call the Revenue Generators feature complete. Follow them in order; each section builds on the state set up by the previous one.

---

## Prerequisites

Before starting, ensure you have:

- **Local stack running**: backend (`make dev-backend`), admin PWA (`make dev-frontend`), and donor PWA running
- **Database migrated**: `make migrate` (applies the `revenue_generator_*` tables)
- **An active event** with at least one donor registered and assigned a bidder number
- **Admin credentials** and at least one donor account registered to that event

---

## 1. Admin Setup — Create Revenue Generator Items

**Goal**: Verify admins can create, edit, and manage RG items.

1. Log in to the **Admin PWA** (`http://localhost:5173`) as an admin
2. Navigate to the event → **Revenue Generators** tab (sidebar)
3. Click **Create Item**
   - Enter a name (e.g., "50/50 Raffle")
   - Enter a description (e.g., "Win half the pot!")
   - Enter a buy-in price (e.g., `$10.00`)
   - Leave visibility as **Visible** and entry status as **Open**
4. Save — confirm the item appears in the list

5. Create a **second item** (e.g., "Prize Basket — $25 each") with a different price
6. Create a **third item** that starts as **Hidden** (toggle the visibility control to hidden before saving)

**Expected results**:
- All three items appear in the admin Revenue Generators list
- The hidden item shows a "Hidden" badge; the others show "Visible"
- Editing an item (click Edit) and clearing the description field → description saves as blank (not the previous value)

---

## 2. Donor View — Play Tab Appears Only When Items Exist

**Goal**: The "Play" tab in the donor bottom navigation is conditional.

1. Log in to the **Donor PWA** (`http://localhost:5174`) as a registered donor for this event
2. Navigate to the event home page
3. Observe the bottom navigation bar

**Expected results**:
- The **Play** tab is visible (because at least one visible RG item exists)
- Tap the Play tab — you see items 1 and 2 (the visible ones)
- Item 3 (hidden) is **not** listed

**Edge case — no visible items**:
4. In the Admin PWA, hide both visible items (toggle each to hidden)
5. Refresh the Donor PWA event home page
6. The **Play** tab should disappear from the bottom navigation
7. Restore both items to Visible before continuing

---

## 3. Donor Purchases Entries

**Goal**: Donors can buy entries; their personal count increments; no other entries are displaced.

1. In the Donor PWA, go to the **Play** tab
2. Find item 1 ("50/50 Raffle") — note "You have 0 entries" (or similar initial state)
3. Tap **Buy Entry** (or equivalent purchase button)
4. Confirm the purchase completes and a success toast appears
5. Observe that your entry count on the card increments to **1**
6. Tap **Buy Entry** again — count increments to **2**

**Expected results**:
- Entry count on the card reflects only _your_ entries, not a total across all donors
- No aggregate/total count is shown

**Second donor verification** (optional but recommended):
7. Log in as a second donor in another browser session
8. That donor should also see 0 entries for themselves (their own count, not affected by donor 1's purchases)
9. Second donor purchases 3 entries — their count shows 3
10. First donor's count still shows 2 (unchanged)

---

## 4. Closed Items — Entries Disabled, Item Still Visible

**Goal**: Admins can independently control open/closed state without hiding the item.

1. In the Admin PWA, **close** item 1 for entries (toggle entry status to Closed, leave visible)
2. In the Donor PWA, refresh/wait for the Play tab to update (polling every 5 seconds)
3. Observe item 1 — it should still appear but the buy button is disabled with a "Entries closed" indicator

**Expected results**:
- Item is visible in donor Play tab
- Purchase action is disabled
- Existing entry counts for each donor are still displayed

5. In the Admin PWA, **re-open** item 1 — confirm the Buy Entry button reactivates in the donor view

---

## 5. Admin Views Entry List

**Goal**: Admin can see the full entry list per item.

1. In the Admin PWA, navigate to item 1 → click to view entries (or click an "Entries" button/tab)
2. Confirm you see each donor who purchased entries, with their name and entry count
3. The list should be sorted by entry count (descending) — the donor with the most entries appears first
4. Donor 1 should show 2 entries; Donor 2 (if used) should show 3 entries

---

## 6. Quick Entry — Record Entries on Behalf of Donors

**Goal**: Staff can rapidly record raffle entries at event tables.

1. In the Admin PWA, navigate to **Quick Entry**
2. Select the **Revenue Generators** tab within Quick Entry
3. Select item 2 ("Prize Basket") from the item selector
4. Enter a valid bidder number for Donor 1
5. Submit — confirm success message appears
6. Submit again (same bidder number) — confirm a second entry is recorded (count becomes 1+)

**Error case**:
7. Enter an invalid/non-existent bidder number (e.g., `99999`)
8. Submit — confirm an error message is shown and no entry is recorded

**Rapid submission**:
9. Perform 5 quick sequential submissions for different bidder numbers — verify the form resets after each submission without navigating away

---

## 7. Winner Selection — Random Draw

**Goal**: Admin can draw a random winner; the winner appears in the donor view.

1. Ensure item 1 has entries from multiple donors (at least 2 donors, one with more entries)
2. In the Admin PWA, open item 1 → click **Random Draw**
3. Confirm a winner is displayed with their name

**Expected results**:
- A winner is selected from the entry pool
- Each individual entry (not unique donor) counts as one ticket — a donor with 5 entries has 5× higher probability than a donor with 1 entry
- The winner's name is saved and persisted

4. In the Donor PWA, refresh the Play tab
5. Confirm the winning donor's name appears on the item 1 card
6. Both donor 1 and donor 2 see the same winner name displayed

**Zero entries edge case**:
7. For item 3 (hidden, no entries yet): make it visible temporarily, open the entries view
8. Attempt Random Draw — confirm an error/info message prevents the draw ("No entries recorded")
9. Re-hide item 3

---

## 8. Winner Selection — Manual Override

**Goal**: Admin can manually pick a winner and override a previous selection.

1. In the Admin PWA, open item 2 (Prize Basket) which has entries from Quick Entry
2. From the entry list, **manually select** a specific donor as winner
3. Confirm the winner is saved

4. Now click **Draw Again** or use the manual override to pick a different winner
5. Confirm the new winner replaces the old one in the display
6. Confirm the **winner history** shows both selections (with timestamps and the admin username for each)

7. Check the donor PWA — item 2 now shows the new (most recent) winner name

---

## 9. Notification Shortcut

**Goal**: After selecting a winner, admin is offered a quick link to send a notification.

1. After drawing a winner for item 1, look for a **"Notify Winner"** shortcut button or link
2. Click it — confirm it navigates to (or opens) the event Notifications page with the winning donor pre-populated
3. (You don't need to send the notification — just verify the shortcut works and pre-fills correctly)

---

## 10. Event Dashboard — Revenue Generator Totals

**Goal**: Dashboard shows correct RG revenue and entry counts.

**Setup**: Ensure you have:
- Item 1: 5 total entries at $10 = $50 revenue
- Item 2: 3 total entries at $25 = $75 revenue

1. In the Admin PWA, navigate to the **Event Dashboard** for this event
2. Look for a **Revenue Generators** section

**Expected results**:
- Combined: 8 total entries, $125 total revenue
- Per item: Item 1 shows 5 entries / $50; Item 2 shows 3 entries / $75
- These figures are shown separately from silent auction and live auction totals — they do not inflate auction numbers

---

## 11. Auctioneer Dashboard — Revenue Generator Tab

**Goal**: Auctioneer has dedicated visibility into RG activity.

1. Log in with an **Auctioneer** account (or switch roles) and navigate to the **Auctioneer Dashboard**
2. Select the **Revenue Generators** tab

**Expected results**:
- Each RG item is listed with its entry count and revenue total
- The full entry list per item (donor names + entry counts) is visible
- The sticky header shows a compact summary card for each item (item name, entry count, revenue)
- Auctioneer can also trigger **Random Draw** or select a manual winner from this view

---

## 12. Dashboard Real-time Updates

**Goal**: Dashboards reflect entries recorded after they load.

1. Open the Admin Event Dashboard
2. In a second window, record a new entry via Quick Entry for item 2
3. Refresh (or wait for polling) the Event Dashboard — confirm totals update
4. Open the Auctioneer Dashboard Revenue Generators tab — confirm entry count updates

---

## 13. Edge Cases

### Hiding an item after entries exist

1. Item 1 has entries; hide it from the Admin PWA
2. Donor PWA: item 1 no longer appears in Play tab
3. Re-show item 1 — all existing entries and the winner are still intact

### Bidder not found in Quick Entry

Already covered in section 6 step 7-8, but confirm:
- The error message is user-friendly (not a raw 422 JSON)
- No partial entry is created

### Re-draw history

1. For item 1, draw 3 winners in sequence
2. Open the winner history view
3. Confirm all 3 draws are listed with timestamps and the admin who drew each one
4. Only the most recent winner's name is shown in the donor PWA

---

## Feature Complete Checklist

| # | Scenario | Pass? |
|---|----------|-------|
| 1 | Admin can create/edit/delete RG items | ☐ |
| 2 | Play tab is conditionally shown based on visible RG items | ☐ |
| 3 | Donor can purchase entries; personal count increments | ☐ |
| 4 | Multi-donor entries are independent (no displacement) | ☐ |
| 5 | Closed items remain visible but disable purchase | ☐ |
| 6 | Admin entry list is sorted by entry count descending | ☐ |
| 7 | Quick Entry records entries rapidly by bidder number | ☐ |
| 8 | Quick Entry shows error for invalid bidder number | ☐ |
| 9 | Random draw selects a winner; winner appears in donor view | ☐ |
| 10 | Draw blocked when no entries exist | ☐ |
| 11 | Manual winner selection and override work | ☐ |
| 12 | Winner history records all draws with timestamps | ☐ |
| 13 | Notification shortcut pre-fills winning donor | ☐ |
| 14 | Event dashboard shows RG totals separate from auction | ☐ |
| 15 | Auctioneer dashboard has RG tab with entry lists | ☐ |
| 16 | Dashboard totals update after new entries | ☐ |
| 17 | Hiding item preserves entries for winner selection | ☐ |
