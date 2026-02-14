# Feature Specification: Event Dashboard for Admin PWA

**Feature Branch**: `026-event-dashboard-for`
**Created**: 2026-02-07
**Status**: Draft
**Input**: User description: "Event Dashboard for Admin PWA: Provide an event-level dashboard that visualizes total funds raised vs goal, with breakdown by revenue source (tickets, sponsorships, silent auction, live auction, paddle raise, donations, fees/other). Include projections for each source and overall total, with admin-adjustable what-if controls that update projected totals. Show per-source gauges, progress-to-goal, and variance. Provide drilldowns to see funds raised by table, by guest, by registrant plus guests, and by guest company. Include filters for event, date range, and revenue source, and support comparison between actual vs projected vs goal. This dashboard excludes deep auction-item analytics and donor-giving details (handled in separate dashboards). Other helpful, interactive visuals to include: pacing line chart vs goal trajectory (on-track/off-track indicator), waterfall of actual + projected contributions to goal, scenario toggles (base/optimistic/conservative) for projections, top tables/companies leaderboard with contribution share, table/guest heatmap showing contribution density, conversion funnel: invited → registered → checked-in → donated/bid, alert cards for underperforming sources vs plan, cashflow timeline (daily/weekly trends)."

## Clarifications

### Session 2026-02-07

- Q: What pacing baseline should the goal trajectory use? → A: Linear pacing from start to goal by event end.
- Q: What refresh cadence should the dashboard use? → A: Auto-refresh every 60 seconds with manual refresh available.
- Q: When should underperformance alerts trigger? → A: Below 90% of pacing for 2+ consecutive refreshes.
- Q: How should projections be shared? → A: Projections are event-wide and shared for all admins.
- Q: Which admin roles can access the dashboard? → A: Super Admin, NPO Admin, and NPO Staff only.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Monitor event performance at a glance (Priority: P1)

As an admin, I need a single dashboard view that shows total funds raised versus the event goal with clear source breakdowns and pacing, so I can quickly understand whether the event is on track.

**Why this priority**: This is the primary daily decision-making view and delivers immediate value without any configuration.

**Independent Test**: Can be fully tested by opening the dashboard for a selected event and verifying that totals, goal comparison, and source breakdowns are visible and coherent.

**Acceptance Scenarios**:

1. **Given** an event with a defined goal and recorded revenue, **When** an admin opens the dashboard, **Then** the total raised, goal amount, and variance are displayed along with a breakdown by revenue source.
2. **Given** an event in progress, **When** the admin views pacing visuals, **Then** the dashboard indicates on-track or off-track status relative to the goal trajectory.

---

### User Story 2 - Explore projections and what-if scenarios (Priority: P2)

As an admin, I want to adjust projected amounts by revenue source and compare scenarios so I can understand what outcomes are needed to meet the goal.

**Why this priority**: Projection controls guide planning and help focus outreach and operational efforts.

**Independent Test**: Can be fully tested by adjusting a source projection and confirming that the projected total and variance update accordingly.

**Acceptance Scenarios**:

1. **Given** baseline projections, **When** an admin adjusts a source prediction, **Then** the overall projected total and per-source variance update immediately.
2. **Given** available scenario toggles, **When** an admin switches scenarios, **Then** all projection visuals update to reflect the selected scenario.

---

### User Story 3 - Drill into contributing segments (Priority: P3)

As an admin, I need drilldowns by table, guest, registrant plus guests, and company so I can identify high-performing and underperforming segments.

**Why this priority**: Segment insights enable targeted follow-up and operational adjustments.

**Independent Test**: Can be fully tested by selecting a segment view and verifying that totals and rankings are displayed with filters applied.

**Acceptance Scenarios**:

1. **Given** segment data exists, **When** an admin opens a drilldown (table, guest, registrant, or company), **Then** the dashboard shows totals and contribution share for that segment.
2. **Given** filters are applied, **When** the admin views any drilldown or visualization, **Then** results reflect the active filters consistently.

---

### Edge Cases

- What happens when an event has no revenue yet or no goal defined?
- How does the dashboard behave when a revenue source has zero values or is not used in a given event?
- What happens when filter selections produce no data?
- How are partial or delayed updates shown when source data arrives late?
- How are deleted or merged guest/company records handled in drilldowns?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display total funds raised, event goal, and variance (difference and percentage).
- **FR-002**: System MUST show a breakdown of actual and projected totals by revenue source (tickets, sponsorships, silent auction, live auction, paddle raise, donations, fees/other).
- **FR-003**: System MUST display per-source gauges or progress indicators showing current progress toward each source target.
- **FR-004**: System MUST show overall projections and allow comparison between actual, projected, and goal values.
- **FR-005**: Admins MUST be able to adjust projected amounts per revenue source and see projected totals update immediately.
- **FR-006**: System MUST provide base, optimistic, and conservative projection scenarios with a way to reset adjustments.
- **FR-006a**: Projection adjustments MUST be event-wide and shared across admins.
- **FR-007**: System MUST provide drilldowns for funds raised by table, by guest, by registrant plus guests, and by guest company.
- **FR-008**: System MUST provide filters for event, date range, and revenue source that apply consistently across all visuals.
- **FR-009**: System MUST provide a pacing line chart that compares current progress to a linear goal trajectory from event start to event end and indicates on-track/off-track status.
- **FR-010**: System MUST provide a waterfall view of actual and projected contributions to goal.
- **FR-011**: System MUST provide a leaderboard view for top tables and top companies by contribution share.
- **FR-012**: System MUST provide a heatmap view for table and guest contribution density.
- **FR-013**: System MUST provide a conversion funnel view for invited → registered → checked-in → donated/bid.
- **FR-014**: System MUST surface alert cards when a revenue source is below 90% of pacing for 2+ consecutive refreshes.
- **FR-015**: System MUST provide a cashflow timeline with daily or weekly trends.
- **FR-016**: System MUST auto-refresh dashboard data every 60 seconds and provide a manual refresh control.
- **FR-017**: Only Super Admin, NPO Admin, and NPO Staff roles MUST be able to access the dashboard.
- **FR-018**: The dashboard MUST exclude auction-item analytics and donor-giving detail views.

### Key Entities *(include if feature involves data)*

- **Event**: The specific fundraising event being monitored, including goal amount and schedule.
- **Revenue Source**: A category of funds (tickets, sponsorships, silent auction, live auction, paddle raise, donations, fees/other).
- **Revenue Snapshot**: Actual totals by source and time window for the event.
- **Projection Scenario**: A named set of projected values (base, optimistic, conservative).
- **Projection Adjustment**: Admin-entered changes to projected values by source.
- **Segment Breakdown**: Aggregated totals by table, guest, registrant plus guests, and company.
- **Funnel Stage**: Counts for invited, registered, checked-in, and donated/bid stages.
- **Alert**: A flagged underperformance condition tied to a source or segment.
- **Time Window**: The date range filter used to aggregate totals.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of admins can identify total raised versus goal within 30 seconds of opening the dashboard.
- **SC-002**: Admins can adjust a projection and see the updated total within 2 seconds.
- **SC-003**: Admins can reach any segment drilldown (table, guest, registrant, company) in 3 steps or fewer.
- **SC-004**: The dashboard remains responsive and usable for events with up to 5,000 guests and 500 tables.
- **SC-005**: 90% of surveyed admins report the dashboard improves their ability to prioritize follow-up actions.

## Assumptions

- Each event has a defined fundraising goal or the dashboard will clearly indicate when the goal is missing.
- Projection adjustments are session-based and can be reset to baseline; long-term persistence is not required for MVP.
- Revenue sources may be unused for some events and should still appear with zero values.
- Pacing comparisons use a linear goal trajectory unless explicitly changed in a future enhancement.
- Dashboard data refreshes automatically every 60 seconds with a manual refresh option.
- Projection adjustments are shared across admins for the event.

## Out of Scope

- Auction-item analytics and donor-giving detail dashboards.
- Editing of underlying transaction data or guest records from this dashboard.
