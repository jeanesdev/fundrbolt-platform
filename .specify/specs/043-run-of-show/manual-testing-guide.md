# Run-of-Show Management — Manual Testing Guide

Feature: **043-run-of-show**  
Covers: US1 (Admin editor), US2 (NPO templates), US3 (Donor timeline), US4 (Auctioneer countdown), US5 (Event dashboard), US6 (Notifications)

---

## Prerequisites

1. Run DB migrations: `make migrate`
2. Start backend: `make dev-backend` (port 8000)
3. Start Admin PWA: `make dev-frontend` (port 5173)
4. Start Donor PWA: `cd frontend/donor-pwa && pnpm dev` (port 5174)
5. Have a test NPO and an event with a **start time set** (required for template apply + countdowns)

---

## US1 — Admin Run-of-Show Editor

### 1.1 Navigate to the editor
- Log in as NPO Admin or Super Admin
- Open an event → click **Run of Show** in the event sidebar
- **Expected**: Empty state with "No run-of-show items" message and an "Add Item" button

### 1.2 Add an item
- Click **Add Item**
- Fill in: Title (required), Description (optional), Scheduled Time, toggle Donor Visible ON, Auctioneer Visible ON
- Submit
- **Expected**: Item appears in the list with correct time displayed

### 1.3 Edit item title (inline)
- Click the title of an existing item
- Edit the text and press Enter or click away
- **Expected**: Title updates immediately; no page reload

### 1.4 Edit scheduled time (inline — NEW)
- Click the time badge on an item (e.g., "7:00 PM")
- A `datetime-local` input appears
- Change the time and press Enter or click away
- **Expected**: Time updates to the new value

### 1.5 Toggle visibility
- Click the **Donor** or **Auctioneer** toggle switch on an item
- **Expected**: Toggle state persists after page refresh

### 1.6 Mark complete / incomplete
- Click the **Todo** badge → it becomes **Done** (green)
- Click **Done** → it reverts to **Todo**
- **Expected**: `completed_at` sets/clears; item visually grays out when done

### 1.7 Drag to reorder
- Add 3+ items
- Drag one item to a different position using the grip handle
- **Expected**: Order persists after releasing drag and after page refresh (no snap-back)

### 1.8 Delete an item
- Click the trash icon on an item
- Confirm the browser dialog
- **Expected**: Item removed from list

### 1.9 Staleness warning banner
- Create items for an event that has **no start time set**
- **Expected**: Yellow/orange warning banner appears: "Event has no start time — countdowns may be inaccurate"
- Set event start time → **Expected**: Banner disappears

---

## US2 — NPO Templates

### 2.1 System default "3-Hour Gala" template
- Open the Apply Template dialog (button in the RoS editor)
- **Expected**: "3-Hour Gala" template appears in the list marked as "System default"
- **Expected**: 14 items with correct offsets (Cocktail Hour at +0 min, etc.)

### 2.2 Apply template to empty event
- Start with an event that has zero RoS items
- Open Apply Template dialog, select "3-Hour Gala", click Apply
- **Expected**: 14 items are created with `scheduled_time` = `event.start_time + offset_minutes`

### 2.3 Apply template to event with existing items (replace)
- Have an event with existing items
- Open Apply Template dialog, select a template
- **Expected**: Checkbox "Replace existing items when applying template" is shown
- Check the box and apply
- **Expected**: Existing items are deleted, template items created

### 2.4 Apply template without event start time
- Use an event with no `start_time`
- Try to apply a template
- **Expected**: HTTP 400 error shown as a toast: "Event must have a start time to apply a template"

### 2.5 System default template is immutable
- Attempt to edit the "3-Hour Gala" template (via API: `PATCH /admin/npos/.../run-of-show-templates/{id}`)
- **Expected**: 403 Forbidden

### 2.6 Save current RoS as template
- Build a run-of-show with 3+ items on an event with a start time
- Click **Save as Template**, enter a name, submit
- **Expected**: New NPO-scoped template appears in the Apply Template list

### 2.7 Template CRUD (NPO Admin)
- Via API or UI: Create, read, update, delete an NPO template
- **Expected**: All operations succeed; system default blocks edit/delete with 403

---

## US3 — Donor Timeline Card

### 3.1 Card hidden when no donor-visible items
- Log in as a Donor registered for the event
- Navigate to the event home in the Donor PWA (port 5174)
- Ensure no items have `donor_visible = true`
- **Expected**: Run-of-Show card does NOT appear on the Home tab

### 3.2 Card appears with donor-visible items
- In Admin PWA, toggle at least one item's **Donor Visible** to ON
- Refresh the Donor PWA
- **Expected**: "Event Schedule" (or "Run of Show") collapsed card appears

### 3.3 Expand / collapse
- Click the card header
- **Expected**: List of donor-visible items expands/collapses smoothly

### 3.4 Completed items display
- Mark an item complete in Admin PWA
- Refresh Donor PWA (or wait up to 30 seconds for polling)
- **Expected**: That item shows with strikethrough and reduced opacity

### 3.5 30-second polling
- Add a new donor-visible item in Admin PWA
- Wait up to 30 seconds in Donor PWA without refreshing
- **Expected**: New item appears automatically

### 3.6 Items are filtered to donor-only
- Have one item with `donor_visible=false` and one with `donor_visible=true`
- **Expected**: Donor PWA only shows the visible one

---

## US4 — Auctioneer Countdown Badge

### 4.1 Countdown badge on Auctioneer Dashboard
- Log in as a user with the Auctioneer role
- Navigate to the Auctioneer Dashboard
- Have at least one auctioneer-visible item with a future `scheduled_time`
- **Expected**: Sticky countdown badge at the top shows "Next: [item title] in Xh Xm Xs"

### 4.2 Countdown ticks every second
- Observe the badge for at least 5 seconds
- **Expected**: seconds tick down live

### 4.3 Badge on Live Auction tab (all auctioneer pages)
- Navigate to the Live Auction tab / any other auctioneer page
- **Expected**: Countdown badge is still visible (sticky)

### 4.4 No future items
- Mark all auctioneer-visible items as complete, or set all times in the past
- **Expected**: Badge shows "No upcoming items" or is hidden (check exact spec)

### 4.5 Full RoS card
- Auctioneer Dashboard should have a Run-of-Show card listing auctioneer-visible items
- **Expected**: Complete/incomplete toggle works per item

---

## US5 — Event Dashboard Cards

### 5.1 Summary card
- Navigate to the Event Dashboard (Admin PWA)
- **Expected**: "Run of Show" summary card shows: completed count / total count with a progress bar

### 5.2 Next-item countdown card
- **Expected**: "Next Up" card shows the next incomplete auctioneer-visible item with a live countdown

### 5.3 All complete
- Mark all items complete
- **Expected**: Summary shows 100% progress; countdown card shows "All items complete" or similar

---

## US6 — Scheduled Notifications

### 6.1 Schedule a notification
- Open a RoS item in the Admin editor
- Click the **bell icon** to open the notification form
- Enter a message, select recipient type (Donors / Auctioneer / All Attendees), save
- **Expected**: Bell icon turns active/filled; notification row shows status "pending" with the Celery task ID

### 6.2 Cancel a notification
- Click the bell icon on an item with a scheduled notification
- Delete / cancel the notification
- **Expected**: Status changes to "cancelled"; Celery task is revoked

### 6.3 Notification fires at scheduled time (integration test)
- Set a notification scheduled time 1–2 minutes in the future
- Ensure Celery worker is running (`make docker-up` or `celery -A app.celery_app worker`)
- Wait for the time
- **Expected**: Target user(s) receive an in-app notification; status changes to "delivered" with `delivered_at` timestamp

### 6.4 Cancel-on-close
- Schedule a notification, then close the event via `/close`
- **Expected**: Notification status changes to "cancelled"

### 6.5 Cancel-on-delete
- Schedule a notification, then delete the event
- **Expected**: Notification status changes to "cancelled" (new fix from review comments)

### 6.6 Auctioneer recipient type
- Schedule a notification with recipient_type = "auctioneer"
- **Expected**: Only users with `AuctioneerEventSettings` for this event receive the notification

---

## Edge Cases & Error Scenarios

| Scenario | Expected Behavior |
|----------|------------------|
| Two admins edit the same item simultaneously | Last write wins (no optimistic lock for RoS items) |
| Drag reorder with network error | Items snap back; error toast shown |
| Apply template when event.start_time is null | HTTP 400 with "Event must have a start time" |
| Delete item with a scheduled notification | Notification row deleted via cascade |
| Celery unavailable when scheduling notification | HTTP 500 shown in UI; notification saved as `failed` |
| Template item count = 0 | Template can be saved; applying creates 0 items |

---

## Performance Acceptance Criteria (from UAT targets)

| Flow | Target |
|------|--------|
| RoS editor initial load (50 items) | < 1 second |
| Drag reorder (PATCH + refetch) | < 500ms round-trip |
| Donor PWA timeline initial render | < 500ms |
| Auctioneer countdown initial load | < 1 second |

---

## API Smoke Tests (optional with curl/Postman)

```bash
# Get event RoS (admin)
GET /api/v1/admin/events/{event_id}/run-of-show

# Create item
POST /api/v1/admin/events/{event_id}/run-of-show
{"title": "Welcome", "scheduled_time": "2025-11-01T19:00:00Z", "donor_visible": true, "auctioneer_visible": true}

# Reorder items
PATCH /api/v1/admin/events/{event_id}/run-of-show/reorder
{"item_ids": ["<id1>", "<id2>", "<id3>"]}

# Mark complete
POST /api/v1/admin/events/{event_id}/run-of-show/{item_id}/complete

# Donor view (registered user)
GET /api/v1/donor/events/{event_id}/run-of-show

# Auctioneer view
GET /api/v1/auctioneer/events/{event_id}/run-of-show

# List NPO templates
GET /api/v1/admin/npos/{npo_id}/run-of-show-templates
```

---

## Feature Complete Checklist

- [ ] Admin can create, edit, reorder, complete, and delete RoS items
- [ ] Scheduled time is inline-editable in the item row
- [ ] "3-Hour Gala" system default template exists and is immutable
- [ ] Templates can be applied (replace) and saved
- [ ] Donor timeline card: hidden when empty, shows only donor-visible items, polls every 30s
- [ ] Auctioneer countdown badge visible on all auctioneer pages, ticks every second
- [ ] Event dashboard shows RoS summary card and next-item countdown
- [ ] Notifications: schedule, cancel, deliver at correct time to correct recipients
- [ ] Notifications cancelled when event is closed or deleted
- [ ] Staleness warning shown when event has no start time
