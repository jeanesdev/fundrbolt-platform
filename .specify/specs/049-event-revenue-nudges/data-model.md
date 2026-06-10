# Data Model — 049 Event Revenue Nudges

## New Tables

### `event_nudge_dismissals`

Tracks per-user, per-event nudge dismissals and actioned state. Used to suppress nudges from reappearing before their TTL expires.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `event_id` | UUID | FK→events.id CASCADE, NOT NULL, INDEX | |
| `user_id` | UUID | FK→users.id CASCADE, NOT NULL, INDEX | |
| `nudge_key` | VARCHAR(200) | NOT NULL | Stable nudge identifier (e.g., `watchers_no_bid:abc-uuid`) |
| `action` | VARCHAR(20) | NOT NULL, CHECK IN ('dismissed','actioned') | `dismissed` = 30min TTL; `actioned` = session-level TTL |
| `expires_at` | TIMESTAMPTZ | nullable | NULL = suppressed until end of event; NOT NULL = suppressed until this timestamp |
| `created_at` | TIMESTAMPTZ | NOT NULL | |

**Unique constraint:** `(event_id, user_id, nudge_key)` — ON CONFLICT DO UPDATE (upsert on re-dismiss)

**Index:** `(event_id, user_id, expires_at)` — primary query pattern: filter all active dismissals for a user/event

**Notes:**
- No `updated_at` — rows are upserted (replaced) on re-dismiss, not updated.
- TTL logic: `dismissed` action → `expires_at = NOW() + INTERVAL '30 minutes'`; `actioned` action → `expires_at = NULL` (session-level, cleared only on explicit reset or 24h hardcap)
- "Goal progress" nudge (`goal_progress` key) is exempt from dismissal — the backend ignores dismissal records for this key type.

---

### `event_nudge_notification_log`

Tracks which nudge_keys have already triggered in-app notifications for an event. Used to deduplicate notifications across Celery task runs.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `event_id` | UUID | FK→events.id CASCADE, NOT NULL, INDEX | |
| `nudge_key` | VARCHAR(200) | NOT NULL | Same key space as dismissals |
| `notified_at` | TIMESTAMPTZ | NOT NULL | When the notification batch was dispatched |
| `created_at` | TIMESTAMPTZ | NOT NULL | |

**Unique constraint:** `(event_id, nudge_key)` — prevents duplicate notification batches

**Usage:** Before dispatching notifications for a new nudge, check if a row exists for `(event_id, nudge_key)`. If present → skip. If not → insert row + dispatch notifications.

**Cleanup:** When a nudge's underlying condition resolves (e.g., item now has bids), the corresponding log row is deleted by the scan task so the notification fires again if the condition re-occurs.

---

## No Other New Tables

All nudge computation queries are over **existing tables only**:

| Data Needed | Source Tables |
|---|---|
| Watchers without bids | `watch_list_entries`, `auction_bids`, `auction_items` |
| Items with no bids | `auction_items`, `auction_bids` |
| Closing soon items | `auction_items` (auction_close_datetime) |
| Outbid watchers | `auction_bids`, `watch_list_entries` |
| Non-participating attendees | `event_registrations`, `registration_guests`, `auction_bids`, `quick_entry_donations`, `revenue_generator_entries` |
| Revenue generator participation | `revenue_generator_items`, `revenue_generator_entries`, `event_registrations` |
| Goal progress | `events.fundraising_goal` + aggregated revenue (reuse EventDashboardService logic) |
| Pareto donors | `auction_bids`, `quick_entry_donations`, `npo_donations`, `quick_entry_buy_now_bids` |
| Paddle raise momentum | `paddle_raise_contributions`, `auction_bids` |

---

## Python Models

```python
class NudgeDismissalAction(str, Enum):
    DISMISSED = "dismissed"    # 30-minute TTL
    ACTIONED = "actioned"      # session-level (NULL expires_at)

class EventNudgeDismissal(Base, UUIDMixin):
    __tablename__ = "event_nudge_dismissals"

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    nudge_key: Mapped[str] = mapped_column(VARCHAR(200), nullable=False)
    action: Mapped[str] = mapped_column(VARCHAR(20), nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(TIMESTAMPTZ, nullable=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMPTZ, nullable=False, default=func.now())

    __table_args__ = (
        UniqueConstraint("event_id", "user_id", "nudge_key", name="uq_event_nudge_dismissals"),
        Index("ix_event_nudge_dismissals_event_user_expires", "event_id", "user_id", "expires_at"),
        CheckConstraint("action IN ('dismissed', 'actioned')", name="ck_nudge_dismissal_action"),
    )


class EventNudgeNotificationLog(Base, UUIDMixin):
    __tablename__ = "event_nudge_notification_logs"

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    nudge_key: Mapped[str] = mapped_column(VARCHAR(200), nullable=False)
    notified_at: Mapped[datetime] = mapped_column(TIMESTAMPTZ, nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMPTZ, nullable=False, default=func.now())

    __table_args__ = (
        UniqueConstraint("event_id", "nudge_key", name="uq_event_nudge_notification_log"),
    )
```

---

## Nudge Schema (no DB backing — computed in-memory)

```python
class NudgeType(str, Enum):
    WATCHERS_NO_BID = "watchers_no_bid"
    ITEMS_NO_BIDS = "items_no_bids"
    ITEMS_MOST_BIDS = "items_most_bids"
    CLOSING_SOON_WATCHERS = "closing_soon_watchers"
    OUTBID_STILL_WATCHING = "outbid_still_watching"
    NON_PARTICIPATING_ATTENDEES = "non_participating_attendees"
    REVENUE_GENERATOR_LOW_PARTICIPATION = "revenue_generator_low_participation"
    REVENUE_GENERATORS_NOT_STARTED = "revenue_generators_not_started"
    GOAL_PROGRESS = "goal_progress"
    GOAL_MILESTONE_APPROACHING = "goal_milestone_approaching"
    PARETO_DONORS = "pareto_donors"
    CHECKED_IN_NO_ACTIVITY = "checked_in_no_activity"
    PADDLE_RAISE_MOMENTUM = "paddle_raise_momentum"


# Base ranks per nudge type (1=highest revenue impact, 5=informational)
NUDGE_BASE_RANKS: dict[NudgeType, int] = {
    NudgeType.CLOSING_SOON_WATCHERS: 1,
    NudgeType.WATCHERS_NO_BID: 2,
    NudgeType.NON_PARTICIPATING_ATTENDEES: 2,
    NudgeType.REVENUE_GENERATORS_NOT_STARTED: 2,
    NudgeType.GOAL_MILESTONE_APPROACHING: 2,
    NudgeType.PADDLE_RAISE_MOMENTUM: 2,
    NudgeType.OUTBID_STILL_WATCHING: 3,
    NudgeType.ITEMS_NO_BIDS: 3,
    NudgeType.REVENUE_GENERATOR_LOW_PARTICIPATION: 3,
    NudgeType.CHECKED_IN_NO_ACTIVITY: 3,
    NudgeType.PARETO_DONORS: 4,
    NudgeType.ITEMS_MOST_BIDS: 5,
    NudgeType.GOAL_PROGRESS: 5,
}

# Nudge types that trigger in-app notifications (rank ≤ 2, ranks 1 and 2 only)
NOTIFYING_NUDGE_TYPES: frozenset[NudgeType] = frozenset(
    k for k, v in NUDGE_BASE_RANKS.items() if v <= 2
)


@dataclass
class NudgeItem:
    nudge_key: str              # Stable dismissal key
    nudge_type: NudgeType
    rank: int                   # 1 (highest impact) to 5 (informational), clamped
    title: str
    description: str
    action_url: str | None      # Relative frontend URL
    action_label: str | None    # Button label for action
    affected_count: int         # Primary count (e.g., number of watchers)
    metadata: dict              # Type-specific extra data
    is_dismissible: bool        # False for goal_progress
    notifies_on_appear: bool    # True if rank ≤ 2 (ranks 1 and 2 only; set automatically by NudgeService)
```

---

## Migration Summary

```
alembic/versions/nudge_001_add_event_nudge_tables.py
```

- CREATE TABLE `event_nudge_dismissals` (id, event_id, user_id, nudge_key, action, expires_at, created_at)
- ADD UNIQUE CONSTRAINT `uq_event_nudge_dismissals` on (event_id, user_id, nudge_key)
- ADD INDEX `ix_event_nudge_dismissals_event_user_expires` on (event_id, user_id, expires_at)
- ADD CHECK CONSTRAINT on action column
- CREATE TABLE `event_nudge_notification_logs` (id, event_id, nudge_key, notified_at, created_at)
- ADD UNIQUE CONSTRAINT `uq_event_nudge_notification_log` on (event_id, nudge_key)
