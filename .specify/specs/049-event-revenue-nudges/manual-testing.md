# Manual Testing Guide — 049 Event Revenue Nudges

**Branch**: `feature/049-event-revenue-nudges`  
**PR**: https://github.com/jeanesdev/fundrbolt-platform/pull/146

---

## Prerequisites

1. Backend running: `make dev-backend` (http://localhost:8000)
2. Frontend running: `make dev-frontend` (http://localhost:5173)
3. Migration applied: `make migrate` — confirms `nudge_001_add_event_nudge_tables` is present
4. A test event with `status = 'active'` in your local database
5. Log in as an NPO Admin or Super Admin

---

## 1. Smoke Test — Panel Renders

**Goal**: Confirm the NudgesPanel doesn't break the Event Dashboard.

1. Navigate to **Admin → Events → [your event] → Dashboard**
2. ✅ Page loads without error
3. ✅ "Revenue Nudges" card appears near the top of the page (above Summary Cards)
4. ✅ If the event has no qualifying data: displays "No active nudges — your event is running smoothly 🎉"
5. ✅ The refresh button (↻) is visible in the panel header

---

## 2. Smoke Test — Auctioneer Dashboard Compact Badge

1. Navigate to **Admin → Events → [your event] → Auctioneer Dashboard**
2. ✅ Compact "Revenue Nudges" badge appears near the top of the page
3. ✅ Click the badge — panel expands inline to show the full NudgesPanel
4. ✅ Click again — panel collapses

---

## 3. Seeding Test Data for Nudges

Use the following SQL against your local PostgreSQL dev database to trigger specific nudges.

### 3a. `watchers_no_bid` (rank 2)

Requires: auction items with watch list entries and no corresponding bids.

```sql
-- Verify you have items and watchers
SELECT ai.title, COUNT(wle.id) AS watchers
FROM auction_items ai
JOIN watch_list_entries wle ON wle.item_id = ai.id
WHERE ai.event_id = '<your-event-id>'
GROUP BY ai.title;
```

If none exist, add a watch list entry for an item that has no active bids:
```sql
INSERT INTO watch_list_entries (id, event_id, item_id, user_id, created_at, updated_at)
VALUES (gen_random_uuid(), '<event-id>', '<item-id>', '<donor-user-id>', NOW(), NOW())
ON CONFLICT DO NOTHING;
```

**Expected**: "Watchers Without Bids" nudge appears with rank **2** (amber left border, "2" badge).

---

### 3b. `closing_soon_watchers` (rank 1)

Requires: an auction item with `auction_close_datetime` within the next 20 minutes (configurable), with watchers, and no active bids.

```sql
UPDATE auction_items
SET auction_close_datetime = NOW() + INTERVAL '15 minutes'
WHERE id = '<item-id>';
```

After adding a watch list entry (see above), refresh the nudges panel.

**Expected**: "Item Closing Soon — No Bids!" nudge appears with rank **1** (red left border, "1" badge, pulsing dot in compact view).

---

### 3c. `items_no_bids` (rank 3)

Requires: auction items with no bids.

```sql
SELECT title FROM auction_items
WHERE event_id = '<event-id>'
AND id NOT IN (
  SELECT DISTINCT auction_item_id FROM auction_bids
  WHERE event_id = '<event-id>'
);
```

**Expected**: "Items With No Bids" nudge appears.  
**Note**: Rank bumps to 2 if >5 items have no bids or the event closes within 60 minutes.

---

### 3d. `goal_progress` + `goal_milestone_approaching` (rank 5 + rank 2)

Requires: `events.fundraising_goal` to be set.

```sql
-- Set a fundraising goal
UPDATE events SET fundraising_goal = 10000 WHERE id = '<event-id>';

-- Check current raised amount vs goal
-- nudge always shows progress; milestone fires at 75/85/90/95/100%
```

**Expected**:
- "Fundraising Goal Progress" nudge always appears at the bottom (rank 5, slate, no dismiss button)
- If raised amount ≥ 75% of goal: "🎯 75% of Goal Reached!" nudge (rank 2, amber) also appears

---

### 3e. `non_participating_attendees` (rank 2 or 3)

Requires: guests with `checked_in = true` and no bids/donations/RG entries.

```sql
-- Check who's checked in but not participating
SELECT rg.first_name, rg.last_name
FROM registration_guests rg
JOIN event_registrations er ON rg.registration_id = er.id
WHERE er.event_id = '<event-id>'
AND rg.checked_in = true
AND rg.user_id NOT IN (
  SELECT DISTINCT user_id FROM auction_bids WHERE event_id = '<event-id>'
);
```

**Expected**: "Non-Participating Attendees" nudge. Rank 2 if ≥5 people, rank 3 if <5.

---

### 3f. `rg_not_started` (rank 2)

Requires: active revenue generators with zero entries.

```sql
SELECT name FROM revenue_generator_items
WHERE event_id = '<event-id>' AND is_open_for_entries = true;
```

If no entries exist for those RGs, the nudge fires automatically.

**Expected**: "Revenue Generators Not Started" nudge.

---

## 4. Dismiss Nudge (Swipe + Button)

1. With at least one dismissible nudge visible:
2. **Button dismiss**: Click the **×** button on a nudge card  
   ✅ Card disappears immediately (optimistic update)  
   ✅ After 30 minutes (or click "Reset all"), card reappears
3. **Button done**: Click the **✓** (green checkmark) button  
   ✅ Card disappears (actioned — suppressed for 24h)
4. **Swipe dismiss** (on touch/pointer device):  
   - Drag the card **left** past 80px threshold → card dismisses  
   - Drag the card **right** past 80px threshold → card is actioned  
   - Background turns red (left) or green (right) when threshold is crossed

---

## 5. Goal Progress Is Not Dismissible

1. With `fundraising_goal` set, confirm the "Fundraising Goal Progress" nudge is visible
2. ✅ No × button is visible on that card
3. API test — attempting to dismiss it should fail:
   ```bash
   curl -X POST http://localhost:8000/api/v1/admin/events/<event-id>/nudges/goal_progress/dismiss \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"action": "dismissed"}'
   ```
   ✅ Returns `422 Unprocessable Entity` with message "Goal progress nudge is not dismissible"

---

## 6. Reset All Dismissals

1. Dismiss 2–3 nudges
2. Click **"Reset all"** in the panel header  
   ✅ All dismissed nudges reappear immediately  
   ✅ Badge count updates

---

## 7. Auto-Refresh

1. Open the Event Dashboard
2. In another terminal, run SQL to create a new nudge condition (e.g., add a watch list entry for a bid-free item)
3. Wait up to 60 seconds  
   ✅ The new nudge appears without a manual page reload

---

## 8. Rank Color Verification

Confirm the left border and badge background match:

| Rank | Expected Color | Example Nudge |
|------|---------------|---------------|
| 1    | Red           | `closing_soon_watchers` |
| 2    | Amber/orange  | `watchers_no_bid`, `goal_milestone_*` |
| 3    | Blue          | `items_no_bids`, `outbid_still_watching` |
| 4    | Slate/gray    | `pareto_donors` |
| 5    | Light slate   | `goal_progress`, `items_most_bids` |

---

## 9. Expand/Collapse Long Lists

1. Seed enough nudge conditions to trigger >5 active nudges
2. ✅ Panel shows only 5 nudges with a "Show N more nudges" button
3. Click "Show N more" → all nudges expand
4. Click "Show less" → collapses back to 5

---

## 10. Celery Background Task (Optional)

To test the async scan and in-app notification dispatch:

```bash
# Start Celery worker in dev
cd backend && poetry run celery -A app.celery_app worker -Q notifications -l info

# Manually trigger fan-out (from python shell)
cd backend && poetry run python -c "
from app.tasks.nudge_tasks import fan_out_nudge_scans_task
fan_out_nudge_scans_task.delay()
"
```

**Expected**:
- Worker logs show `fan_out_nudge_scans: dispatched N event scan tasks`
- For each active event: `nudge_scan_task` runs
- Any rank 1 or 2 nudges that are newly appearing: in-app notification created for NPO Admins and Auctioneers of that event
- Check `event_nudge_notification_logs` table: one row per newly-fired nudge
- Check `notifications` table: rows with `notification_type = 'nudge_alert'`

---

## 11. Access Control

Verify that non-authorized roles cannot access nudges:

```bash
# Donor token (should return 403)
curl -X GET http://localhost:8000/api/v1/admin/events/<event-id>/nudges \
  -H "Authorization: Bearer <donor-token>"
# Expected: 403 Forbidden
```

NPO Admin, Event Coordinator, Staff, and Auctioneer (with AuctioneerEventSettings for the event) should all get 200.

---

## 12. API Endpoints Summary

| Method | URL | Auth | Notes |
|--------|-----|------|-------|
| GET | `/api/v1/admin/events/{id}/nudges` | NPO Admin+ | `?include_dismissed=true` to see dismissed |
| POST | `/api/v1/admin/events/{id}/nudges/{key}/dismiss` | NPO Admin+ | Body: `{"action": "dismissed" \| "actioned"}` |
| DELETE | `/api/v1/admin/events/{id}/nudges/dismissals` | NPO Admin+ | Clears all dismissals for current user |

---

## Known Limitations / Future Work

- `nudge_closing_soon_minutes` field is not yet exposed in the Event settings admin UI — it defaults to 20 and can only be changed via direct DB update for now
- `pareto_donors` computation only uses auction bid data (not paddle raise + donations combined) in this version
- The Auctioneer Dashboard placement puts NudgesCompact before the header — can be repositioned after design review
