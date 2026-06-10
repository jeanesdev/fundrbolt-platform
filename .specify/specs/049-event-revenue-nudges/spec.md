# Feature Specification: Event Revenue Nudges

**Feature Branch**: `049-event-revenue-nudges`
**Created**: 2026-06-09
**Status**: Draft
**Input**: User description: "nudges — a feature that generates and displays 'nudges': pieces of actionable intelligence shown to auctioneers and staff to help them maximize donor participation and revenue during live events. Each nudge has a description and optional action link. Displayed as a prominent card on the Event Dashboard and Auctioneer Dashboard. Swipe to complete or dismiss. Refresh the list. Nudge types: watchers of silent bid items who haven't bid, attendees with no bids or donations, top Pareto donors, revenue generator participation invitations, goal progress percent, items with no bids, items with most bids, and more. Expandable list. AI-style recommendations."

---

## Clarifications

### Session 2026-06-09

- Q: Should dismissed nudges reappear after a timeout, or stay hidden until manual refresh? → A: Dismissed nudges are suppressed per user per event for 30 minutes (a configurable TTL stored on the server); after expiry they reappear if still relevant. "Complete/Actioned" nudges are suppressed for the full event session (until the next login or explicit refresh-all).
- Q: Are nudges global (all events for an NPO) or per-event scoped? → A: Per-event only. The nudge panel appears inside an event context and all computation is scoped to that event.
- Q: Should "action" nudges send notifications directly or just link to the relevant admin page? → A: Action links deep-link to the relevant admin page (Notifications, Auction Items, etc.) — nudges do not send notifications directly. The link pre-populates context where possible (e.g., opens the Notifications page with the right audience filter).
- Q: Should the nudge list auto-refresh? → A: Yes — auto-refresh every 60 seconds when the panel is visible. Also has a manual refresh button.
- Q: How many nudges should be shown by default before the "expand" control? → A: Show the top 5 by priority; user can expand to see all active nudges.
- Q: Should nudge dismissal state be server-side or client-side? → A: Server-side, stored per user/event, so state persists across page refreshes and is shared across devices.
- Q: Should the auctioneer dashboard nudges be the same set as the event dashboard nudges? → A: Same data source. The auctioneer dashboard may show a more compact variant of the panel (collapsed by default with a count badge), but the same nudge types.

### Session 2026-06-09 (Clarification Pass)

- Q: Which rank threshold triggers in-app notifications? → A: **Ranks 1 and 2 only** (strictly urgent). Rank 3 and above never trigger notifications; they are panel-only.
- Q: Should `watchers_no_bid` generate one card per item or a single summary card? → A: **Single summary card** — "N auction items have watchers with no bids" — with a link to the Auction Dashboard. This prevents the panel from being flooded when many items have watchers. (`closing_soon_watchers` remains per-item because each has a distinct deadline.)
- Q: Should the `closing_soon_watchers` window (20 min) be fixed or configurable? → A: **Configurable per event**, set on the Event settings page alongside other auction settings. Default: 20 minutes.
- Q: What counts as "active" for the Celery nudge scan fan-out? → A: **`EventStatus.ACTIVE` only.** Recently-closed events in checkout do not receive nudge scans.
- Q: Which users receive nudge notifications? → A: **NPO Admins (for the event's NPO) + users with an `AuctioneerEventSettings` row for this specific event.** NPO Staff (check-in staff) do not receive nudge notifications.
- Q: Should `pareto_donors` have an action link? → A: **Yes** — link to Donor Dashboard sorted by total giving (current behavior retained).
- Q: Should `goal_milestone_approaching` fire at a fixed 90% or configurable threshold? → A: **Fire at 75%, 85%, 90%, 95%, and 100%** — one notification per milestone crossing (each milestone gets its own `nudge_key` so they are independently tracked). The `goal_progress` nudge (rank 5) always shows current percent in the panel regardless of milestones.

---

## Nudge Catalogue

Each nudge has: `nudge_type`, `rank` (1–5, where **1 = highest revenue impact**), `title`, `description`, `action_url` (optional), `metadata` (dict of supporting data for rendering), `affected_count` (integer), `nudge_key` (stable string used for dismissals), `notifies_on_appear` (bool — whether a new appearance triggers an in-app notification to admins/auctioneers).

**Rank scale:**
- **1** — Critical: direct, immediate revenue loss if ignored (e.g., high-value item closing with watchers who haven't bid)
- **2** — Urgent: strong revenue opportunity, act soon
- **3** — Important: meaningful engagement gap, act within the hour
- **4** — Helpful: moderate improvement opportunity
- **5** — Informational: awareness only, no required action

The NudgeService may adjust a nudge's rank by ±1 based on live context (e.g., proximity to event close, size of affected group). Rank is clamped to [1, 5].

Nudges with base rank ≤ 3 also have a corresponding `NudgeDisplayPriority` used for UI color (rank 1 = red, rank 2 = amber, rank 3 = blue, rank 4/5 = slate).

In-app notifications are sent when a nudge **first appears** (not on each poll cycle) and only for nudges where `notifies_on_appear = True` (**rank 1 and 2 only**).

### Auction Intelligence

| Nudge Type | Key Pattern | Base Rank | Notifies | Description Template |
|---|---|---|---|---|
| `closing_soon_watchers` | `closing_soon:{item_id}` | **1** | ✅ | "**{item_name}** closes in {minutes} min and {N} watchers still haven't bid." |
| `watchers_no_bid` | `watchers_no_bid` | **2** | ✅ | "{N} auction items have watchers who haven't placed a bid yet." *(one summary card, not per-item)* |
| `outbid_still_watching` | `outbid_watching:{item_id}` | **3** | ❌ | "{N} donors were outbid on **{item_name}** and are still watching — they may rebid if prompted." |
| `items_no_bids` | `items_no_bids` | **3** | ❌ | "{N} auction items have received no bids. Consider highlighting them." |
| `items_most_bids` | `items_most_bids` | **5** | ❌ | "**{item_name}** has the most bidding activity ({bid_count} bids) — announce it to drive excitement." |

Notes:
- `closing_soon_watchers` remains **per-item** (each has a distinct deadline); the closing window threshold (default: 20 min) is configurable on the Event settings page as `nudge_closing_soon_minutes`.
- `watchers_no_bid` is now a **single summary card** — "N auction items have watchers who haven't bid" — to prevent panel flooding. Action link goes to Auction Dashboard.

### Participation Intelligence

| Nudge Type | Key Pattern | Base Rank | Notifies | Description Template |
|---|---|---|---|---|
| `non_participating_attendees` | `non_participating` | **2** | ✅ | "{N} checked-in attendees haven't bid, donated, or entered any revenue generators yet." |
| `revenue_generators_not_started` | `rg_not_started` | **2** | ✅ | "{N} revenue generators are active but have received zero entries." |
| `revenue_generator_low_participation` | `rg_participation:{rg_id}` | **3** | ❌ | "**{rg_name}** only has {pct}% participation from registered attendees. Invite more entries." |

### Revenue Goal Intelligence

| Nudge Type | Key Pattern | Base Rank | Notifies | Description Template |
|---|---|---|---|---|
| `goal_milestone_approaching` | `goal_milestone_{pct}` (e.g., `goal_milestone_75`) | **2** | ✅ | "🎯 You've reached {pct}% of your ${goal} goal! Keep pushing!" |
| `goal_progress` | `goal_progress` | **5** | ❌ | "You've reached {pct}% of your ${goal} fundraising goal (${raised} raised)." |
| `pareto_donors` | `pareto_donors` | **4** | ❌ | "{N} donors are responsible for {pct}% of total revenue so far — give them personal attention." |

Notes:
- `goal_milestone_approaching` fires **separately at 75%, 85%, 90%, 95%, and 100%** — each milestone has its own key (e.g., `goal_milestone_75`), so each fires exactly once per event. All 5 are rank 2 and trigger in-app notifications.
- `goal_progress` (rank 5) is **always present** in the panel when a goal is set, showing live percent. It is not dismissible.

### Donor Segment Intelligence

| Nudge Type | Key Pattern | Base Rank | Notifies | Description Template |
|---|---|---|---|---|
| `paddle_raise_momentum` | `paddle_raise_momentum` | **2** | ✅ | "Paddle raise is active — {N} donors at the ${level} level. Announce to encourage others." |
| `checked_in_no_activity` | `checkin_no_activity` | **3** | ❌ | "{N} guests have checked in but have no bids or donations. Engage them now." |

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Auctioneer Sees Nudges on Event Dashboard (Priority: P1)

An auctioneer opens the Event Dashboard for their active event. Prominently displayed near the top is a "Revenue Nudges" panel with 5 color-coded nudge cards. The first card shows "14 people are watching Silent Bid #12 but haven't placed a bid yet" with an "Notify Watchers" action link that opens the Notifications page pre-filtered for those donors. The auctioneer taps the link, sends a "last chance to bid" notification, then returns and swipes the nudge right to mark it as actioned. The panel automatically refreshes in 60 seconds and reflects the updated bidding state.

**Why this priority**: This is the core value proposition — surfacing the right intelligence at the right moment during a live event to directly increase revenue. Without this working end-to-end, the feature has no value.

**Independent Test**: Configure an event with auction items and watchlist entries (no bids), open the Event Dashboard, verify the nudge panel appears with the correct watcher count, click the action link, verify it navigates to Notifications with the right pre-filter. Delivers standalone value.

**Acceptance Scenarios**:

1. **Given** an event has auction items with watchers and no bids, **When** an admin/auctioneer opens the Event Dashboard, **Then** a "Revenue Nudges" panel is visible near the top of the page showing at least the watcher-without-bid nudge.
2. **Given** the nudge panel is visible, **When** the user swipes a nudge card left (or clicks the dismiss button), **Then** the nudge disappears from the panel and does not reappear for 30 minutes.
3. **Given** the nudge panel is visible, **When** the user swipes right (or clicks the "Done" button), **Then** the nudge is marked as actioned and suppressed for the event session.
4. **Given** 8 active nudges exist, **When** the panel loads, **Then** only the top 5 by rank (lowest number = highest priority) are shown initially with a "Show 3 more" expand button.
5. **Given** the panel is open, **When** 60 seconds pass, **Then** the nudge list refreshes automatically without a full page reload.
6. **Given** a nudge with an action link, **When** the user clicks the action link, **Then** they are navigated to the correct admin page with the appropriate context pre-filled.
7. **Given** a rank-1 nudge card, **When** it renders, **Then** it displays a red left border and a "1" rank badge. A rank-5 nudge card shows a slate left border with a "5" badge.

---

### User Story 2 — Auctioneer Dashboard Shows Compact Nudge Badge (Priority: P1)

An auctioneer opens the dedicated Auctioneer Dashboard (`/events/$eventId/auctioneer/`). At the top of the page a compact nudge summary card shows "5 Revenue Nudges" with a pulsing indicator. Clicking "View Nudges" expands the full nudge panel inline. The badge count updates in real time as nudges are dismissed or new ones appear.

**Why this priority**: The Auctioneer Dashboard is a dedicated action center during live events — nudges must be immediately visible there without navigating away.

**Independent Test**: Open the Auctioneer Dashboard with active nudges, verify the compact badge shows the correct count, click to expand, verify the full nudge list renders correctly.

**Acceptance Scenarios**:

1. **Given** active nudges exist for the event, **When** the Auctioneer Dashboard loads, **Then** a compact nudge badge is visible showing the count of active nudges.
2. **Given** the compact badge is visible, **When** the user clicks "View Nudges", **Then** the full nudge panel expands inline.
3. **Given** a nudge is dismissed, **When** the dismissal is saved, **Then** the badge count decrements by 1.
4. **Given** zero active nudges, **When** the Auctioneer Dashboard loads, **Then** the badge shows "0 nudges" with a success color and a message "Event running smoothly 🎉".

---

### User Story 3 — Admin and Auctioneer Receive In-App Notification When a High-Rank Nudge Appears (Priority: P1)

An NPO Admin is not currently looking at the Event Dashboard. In the background, the Celery periodic task runs and detects that a new `closing_soon_watchers` nudge (rank 1) has appeared — "Silent Bid Item #7 closes in 12 minutes and 9 watchers haven't bid." A few seconds later, the admin's app notification bell lights up with a new message: "⚡ Revenue Nudge: 'Silent Bid Item #7' closes in 12 min — 9 watchers haven't bid yet." They tap the notification, which opens the Nudges panel on the Event Dashboard.

**Why this priority**: The whole value of async generation is ensuring staff are alerted even when not actively watching the dashboard. Without notifications, critical rank-1 and rank-2 nudges may be missed during the busiest moments of an event.

**Independent Test**: Set up an event with an auction item closing in 15 minutes and add watchlist entries with no bids. Trigger the Celery task manually (`nudge_scan_task` for the event). Verify a `Notification` row was created for each NPO Admin and Auctioneer assigned to the event. Verify the notification body matches the nudge description. Verify the notification is NOT re-created on the next task run (deduplication).

**Acceptance Scenarios**:

1. **Given** a rank 1 or 2 nudge appears for the first time in the async scan, **When** the scan task completes, **Then** an in-app notification is created for each NPO Admin and Auctioneer with access to the event.
2. **Given** the same nudge_key has already triggered a notification in this event, **When** the scan task runs again, **Then** NO duplicate notification is created.
3. **Given** a rank 4 or 5 nudge appears, **When** the scan task runs, **Then** NO in-app notification is created for that nudge.
4. **Given** a nudge was present in a previous scan, **When** the nudge disappears (e.g., the item now has bids) and then reappears in a later scan, **Then** a new notification IS created (the dedup record is cleared when the nudge resolves).
5. **Given** a notification is created, **When** the admin taps it in the app, **Then** they are navigated to the Event Dashboard with the nudge panel open.

---

### User Story 4 — Staff Member Sees Non-Participating Attendee Nudge (Priority: P2)

A staff member at check-in sees the Event Dashboard showing a nudge: "37 checked-in attendees haven't bid, donated, or entered any revenue generators yet." They click "View Attendees" which opens the Donor Dashboard filtered to show only unengaged donors. The staff member uses this list to identify donors to personally approach on the floor.

**Why this priority**: This nudge type is high-value because it identifies the entire untapped segment, but it depends on P1 (panel and API working) and isn't needed for MVP validation.

**Independent Test**: Register and check in test attendees without creating any bids/donations, open Event Dashboard, verify the nudge appears with the correct count, click "View Attendees" and verify the Donor Dashboard opens with the correct filter applied.

**Acceptance Scenarios**:

1. **Given** N checked-in guests have zero engagement, **When** the nudge panel loads, **Then** the non-participating attendee nudge appears with the correct count.
2. **Given** the non-participating nudge is visible, **When** the user clicks "View Attendees", **Then** the Donor Dashboard opens filtered to non-participating donors.
3. **Given** a guest places a bid after the nudge was displayed, **When** the nudge panel auto-refreshes, **Then** the count decrements (and the nudge disappears if count reaches 0).

---

### User Story 5 — Admin Refreshes Nudges After Taking Action (Priority: P2)

An NPO Admin on the Event Dashboard takes action on a nudge (sends a notification to non-bidding watchers). They then click the refresh button on the nudge panel. After a few seconds, the panel reloads with updated data — the watcher nudge count has dropped from 14 to 6 (8 donors have now bid after receiving the notification). The admin feels confident the nudge system is giving them real-time intelligence.

**Why this priority**: Manual refresh and live count updates are essential to the "real-time intelligence" value. Without this, the panel feels static and untrustworthy.

**Acceptance Scenarios**:

1. **Given** the nudge panel is visible, **When** the user clicks the refresh button, **Then** the panel fetches fresh nudge data and updates within 2 seconds.
2. **Given** a nudge's underlying data has changed (e.g., the watcher has now bid), **When** the panel refreshes, **Then** the nudge count reflects the current state.
3. **Given** all nudges for a type are resolved, **When** the panel refreshes, **Then** that nudge card disappears from the list.

---

### User Story 6 — Goal Progress Nudge Shown Throughout Event (Priority: P2)

An NPO Admin has set a fundraising goal of $50,000 on their event. As the event progresses, the nudge panel always shows a "Goal Progress" nudge (rank 5, always pinned at bottom): "You've reached 68% of your $50,000 goal ($34,000 raised)." When they're within $5,000 of the goal, a separate rank-2 `goal_milestone_approaching` nudge appears and triggers an in-app notification: "You're $5,000 away from your fundraising goal — push hard!"

**Acceptance Scenarios**:

1. **Given** an event has a fundraising goal, **When** the nudge panel loads, **Then** the `goal_progress` nudge (rank 5) is always present and pinned last (it is not dismissible).
2. **Given** revenue is below 90% of goal, **When** the nudge renders, **Then** it uses rank-5 (slate) styling.
3. **Given** revenue exceeds 90% of goal, **When** the scan task next runs, **Then** a `goal_milestone_approaching` nudge (rank 2) appears and an in-app notification is sent to admins/auctioneers.
4. **Given** an event has no fundraising goal set, **When** the nudge panel loads, **Then** neither goal nudge is shown.

---

## Non-Goals

- Nudge async task does NOT auto-send donor-facing notifications (only admin/auctioneer in-app alerts).
- Nudges are NOT AI-generated text — they use templated descriptions populated with real event data.
- There is no nudge configuration UI in this spec — all nudge types are always computed (future feature: toggle individual nudge types per event).
- Nudge history / audit trail is out of scope.
- No SMS or email delivery for nudge alerts (future feature).

---

## Priority Summary

| Story | Priority | Complexity |
|---|---|---|
| US1 — Event Dashboard nudge panel (swipe, dismiss, refresh, expand, rank) | P1 — MVP | High |
| US2 — Auctioneer Dashboard compact badge + expand | P1 — MVP | Medium |
| US3 — Async Celery task + in-app notifications for rank 1 and 2 nudges | P1 — MVP | Medium |
| US4 — Non-participating attendee nudge + Donor Dashboard link | P2 | Medium |
| US5 — Manual refresh + live count updates | P2 | Low |
| US6 — Goal progress nudge (pinned rank 5 + rank-2 milestone alert) | P2 | Low |
