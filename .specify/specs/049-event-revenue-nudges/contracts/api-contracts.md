# API Contracts — 049 Event Revenue Nudges

## Base URL

All endpoints are under `/api/v1`

---

## GET /admin/events/{event_id}/nudges

Returns the list of active nudges for the event, with dismissed/actioned nudges filtered out (unless their TTL has expired).

**Auth:** NPO Admin, NPO Staff, Auctioneer (event-scoped)

**Path Parameters:**
- `event_id` (UUID) — event identifier

**Query Parameters:**
- `include_dismissed` (bool, default: false) — if true, include dismissed nudges with a `is_dismissed: true` flag (for debugging / "show all" mode)

**Response 200:**
```json
{
  "nudges": [
    {
      "nudge_key": "watchers_no_bid:3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "nudge_type": "watchers_no_bid",
      "rank": 2,
      "title": "Watchers Not Bidding",
      "description": "8 people are watching 'Signed Guitar' but haven't placed a bid yet.",
      "action_url": "/events/3fa85f64-5717-4562-b3fc-2c963f66afa6/notifications?audience=watchers_no_bid&item_id=abc123",
      "action_label": "Notify Watchers",
      "affected_count": 8,
      "metadata": {
        "item_id": "abc123...",
        "item_name": "Signed Guitar",
        "watcher_ids": ["user-uuid-1", "user-uuid-2"]
      },
      "is_dismissible": true,
      "notifies_on_appear": true,
      "is_dismissed": false
    },
    {
      "nudge_key": "goal_progress",
      "nudge_type": "goal_progress",
      "rank": 5,
      "title": "Fundraising Goal Progress",
      "description": "You've reached 68% of your $50,000 goal ($34,000 raised).",
      "action_url": null,
      "action_label": null,
      "affected_count": 0,
      "metadata": {
        "goal_cents": 5000000,
        "raised_cents": 3400000,
        "percent": 68
      },
      "is_dismissible": false,
      "notifies_on_appear": false,
      "is_dismissed": false
    }
  ],
  "total_count": 7,
  "active_count": 5,
  "computed_at": "2026-06-09T20:15:30Z"
}
```

**Response 404:** Event not found or not accessible

**Sort order:** rank ascending (1 first), then `affected_count` descending within same rank; `goal_progress` (rank 5) always pinned last.

---

## POST /admin/events/{event_id}/nudges/{nudge_key}/dismiss

Dismiss or mark a nudge as actioned for the current user.

**Auth:** NPO Admin, NPO Staff, Auctioneer (event-scoped)

**Path Parameters:**
- `event_id` (UUID)
- `nudge_key` (string, URL-encoded if it contains `:`) — e.g., `watchers_no_bid:abc-123`

**Request Body:**
```json
{
  "action": "dismissed"
}
```

or

```json
{
  "action": "actioned"
}
```

**Response 200:**
```json
{
  "nudge_key": "watchers_no_bid:abc-123",
  "action": "dismissed",
  "expires_at": "2026-06-09T20:45:30Z"
}
```

**Response 400:** Invalid action value
**Response 422:** Cannot dismiss a non-dismissible nudge type (e.g., `goal_progress`)
**Response 404:** Event not found

**Upsert behavior:** If a dismissal record already exists for this key, it is replaced (ON CONFLICT DO UPDATE). This allows re-dismissing an expired dismissal without error.

---

## DELETE /admin/events/{event_id}/nudges/dismissals

Clear all dismissals for the current user on this event. Used for "reset all" / "see all nudges again".

**Auth:** NPO Admin, NPO Staff, Auctioneer (event-scoped)

**Response 204:** No content (all dismissals cleared)
**Response 404:** Event not found

---

## TypeScript Client Types

```typescript
export type NudgeType =
  | 'watchers_no_bid'
  | 'items_no_bids'
  | 'items_most_bids'
  | 'closing_soon_watchers'
  | 'outbid_still_watching'
  | 'non_participating_attendees'
  | 'revenue_generator_low_participation'
  | 'revenue_generators_not_started'
  | 'goal_progress'
  | 'goal_milestone_approaching'
  | 'pareto_donors'
  | 'checked_in_no_activity'
  | 'paddle_raise_momentum';

export interface NudgeItem {
  nudge_key: string;
  nudge_type: NudgeType;
  rank: number;          // 1 (highest revenue impact) to 5 (informational)
  title: string;
  description: string;
  action_url: string | null;
  action_label: string | null;
  affected_count: number;
  metadata: Record<string, unknown>;
  is_dismissible: boolean;
  notifies_on_appear: boolean;
  is_dismissed: boolean;
}

export interface NudgesResponse {
  nudges: NudgeItem[];
  total_count: number;
  active_count: number;
  computed_at: string; // ISO datetime
}

export interface DismissNudgeRequest {
  action: 'dismissed' | 'actioned';
}

export interface DismissNudgeResponse {
  nudge_key: string;
  action: 'dismissed' | 'actioned';
  expires_at: string | null;
}
```

---

## Frontend API Client (`features/nudges/api.ts`)

```typescript
const NUDGES_BASE = (eventId: string) => `/admin/events/${eventId}/nudges`;

export const nudgesApi = {
  list: (eventId: string, includeDismissed?: boolean) =>
    apiClient.get<NudgesResponse>(NUDGES_BASE(eventId), {
      params: { include_dismissed: includeDismissed },
    }),

  dismiss: (eventId: string, nudgeKey: string, action: 'dismissed' | 'actioned') =>
    apiClient.post<DismissNudgeResponse>(
      `${NUDGES_BASE(eventId)}/${encodeURIComponent(nudgeKey)}/dismiss`,
      { action }
    ),

  clearAll: (eventId: string) =>
    apiClient.delete(`${NUDGES_BASE(eventId)}/dismissals`),
};
```
