# Data Model: Event Dashboard for Admin PWA

## Entities

### Event
- **Represents**: A fundraising event.
- **Key Fields**: id, npo_id, name, starts_at, ends_at, goal_amount, timezone.
- **Relationships**: Has many Revenue Snapshots, Projection Scenarios, Segment Breakdowns, Funnel Stages, Alerts.

### Revenue Source
- **Represents**: Category of funds.
- **Key Fields**: code (tickets, sponsorships, silent_auction, live_auction, paddle_raise, donations, fees_other), label.
- **Relationships**: Used by Revenue Snapshots and Projection Adjustments.
- **Validation**: Code must be one of the enumerated values.

### Revenue Snapshot
- **Represents**: Aggregated actual totals by source within a time window.
- **Key Fields**: event_id, source_code, time_window_start, time_window_end, actual_amount, as_of.
- **Relationships**: Belongs to Event and Revenue Source.
- **Validation**: actual_amount ≥ 0; time_window_start ≤ time_window_end.

### Projection Scenario
- **Represents**: A named projection set (base, optimistic, conservative).
- **Key Fields**: event_id, scenario_type, is_active, created_at, updated_at.
- **Relationships**: Has many Projection Adjustments.
- **Validation**: scenario_type must be base/optimistic/conservative.

### Projection Adjustment
- **Represents**: Admin-updated projected amount for a revenue source.
- **Key Fields**: event_id, scenario_type, source_code, projected_amount, updated_by, updated_at.
- **Relationships**: Belongs to Event and Projection Scenario; references Revenue Source.
- **Validation**: projected_amount ≥ 0; one adjustment per (event_id, scenario_type, source_code).

### Segment Breakdown
- **Represents**: Aggregated totals for a segment (table, guest, registrant, company).
- **Key Fields**: event_id, segment_type, segment_id, segment_label, total_amount, contribution_share, guest_count.
- **Relationships**: Belongs to Event.
- **Validation**: segment_type must be table/guest/registrant/company; contribution_share between 0 and 1.

### Funnel Stage
- **Represents**: Counts for the conversion funnel.
- **Key Fields**: event_id, stage (invited, registered, checked_in, donated_bid), count, as_of.
- **Relationships**: Belongs to Event.
- **Validation**: count ≥ 0; stage must be one of the defined funnel stages.

### Alert
- **Represents**: An underperformance alert for a revenue source.
- **Key Fields**: event_id, source_code, status (active/resolved), threshold_percent, consecutive_refreshes, triggered_at, resolved_at.
- **Relationships**: Belongs to Event; references Revenue Source.
- **Validation**: threshold_percent = 90; consecutive_refreshes ≥ 2.

### Time Window
- **Represents**: Filter window for aggregation.
- **Key Fields**: start_date, end_date, granularity (day/week).
- **Validation**: start_date ≤ end_date.

## Notes
- Revenue Snapshots, Segment Breakdowns, Funnel Stages, and Alerts may be derived aggregates rather than fully persisted tables, depending on backend implementation decisions.
- Projection Adjustments are shared across admins at the event level.
