# Feature Specification: Auction Dashboard

**Feature Branch**: `040-auction-dashboard`
**Created**: 2026-04-07
**Status**: Draft
**Input**: User description: "auction-dashboard — I need a dashboard with visuals and charts to show details about the auctions and auction items. I want to see which items are getting the most bids, money, views, etc. I want to be able to drill down on an item and see more details, like all bid history. I want a timeline view of the bid value. I want to see items categorized by type (silent, live, buy now), and category (family, retail, etc). I want all tables to be sortable, searchable, and filterable like on the donor dashboard. I want to be able to see the tables in card view for mobile also. I want to be able to filter to this event only, or all events that the signed in user has access to."

## Clarifications

### Session 2026-04-07

- Q: Should the item detail drill-down be a slide-out panel, full separate page, or modal overlay? → A: Full-page detail view with its own route — user navigates away from dashboard and uses back navigation.
- Q: What bidder identity should be shown in the bid history table? → A: Bidder number + donor name (e.g., "#142 — Jane Smith").
- Q: Is the dashboard read-only analytics or does it include item/bid management actions? → A: Strictly read-only — view and analyze data only, no actions on items or bids.
- Q: What data refresh strategy should the dashboard use? → A: Auto-refresh every 60 seconds plus a manual refresh button (matches existing event dashboard).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Auction Items Overview Dashboard (Priority: P1)

As an event coordinator or admin, I want to see a high-level overview of all auction items and their performance so I can quickly identify which items are generating the most interest and revenue.

The dashboard landing view presents summary statistics (total items, total bids placed, total revenue, average bid amount) with visual charts breaking down performance by auction type (silent, live, buy now) and by category (experiences, dining, travel, wellness, sports, family, art, retail, services, other). A sortable, searchable, and filterable table lists all auction items with key metrics: item name, type, category, current bid, number of bids, number of views/watchers, and status. Users can switch between table view and card view. The scope toggle lets the user filter to the current event only or across all events they have access to.

**Why this priority**: This is the core value of the feature — giving admins immediate visibility into auction performance at a glance. Without this, no other drill-down or analysis features are useful.

**Independent Test**: Can be tested by navigating to the auction dashboard page for an event with auction items and verifying that summary stats, charts, and the item table all render with correct data.

**Acceptance Scenarios**:

1. **Given** an admin views the auction dashboard for an event with 20 auction items across 3 types and 5 categories, **When** the dashboard loads, **Then** summary cards display total items (20), total bids, total revenue, and average bid amount, and charts show breakdowns by type and category.
2. **Given** the item table is displayed, **When** the admin clicks a column header, **Then** the table sorts by that column in ascending order; clicking again reverses to descending.
3. **Given** the item table is displayed, **When** the admin types a search term into the search bar, **Then** only items whose name or donor name matches the search term are shown.
4. **Given** the admin is on a mobile device, **When** they toggle to card view, **Then** each auction item is displayed as a card with the same key metrics, and the cards are scrollable and filterable.
5. **Given** the scope is set to "This Event," **When** the admin switches to "All Events," **Then** the dashboard recalculates all stats, charts, and the item table to include auction items from every event the user has permission to view.

---

### User Story 2 — Item Detail Drill-Down with Bid History (Priority: P1)

As an event coordinator, I want to click on any auction item and see a detailed view including full bid history, so I can understand bidding behavior and identify trends for that specific item.

Clicking an item (either in the table row or the card) navigates to a dedicated detail page (with its own route) showing item details (name, description, category, type, starting bid, current bid, buy now price if applicable, donor, status), a complete bid history table (bidder, amount, timestamp, bid type, status), and a timeline chart showing bid value over time. The user returns to the dashboard via browser back or a breadcrumb link.

**Why this priority**: Drill-down capability is essential for actionable insights — the overview is only useful if admins can investigate individual items in depth.

**Independent Test**: Can be tested by selecting any auction item from the overview and verifying the detail view shows correct item info, a complete bid history table, and a timeline chart.

**Acceptance Scenarios**:

1. **Given** the items table is displayed, **When** the admin clicks on an item row, **Then** the browser navigates to a dedicated item detail page showing full item information, the bid history table, and the bid value timeline chart, with a breadcrumb or back link to return to the dashboard.
2. **Given** the detail view is open for an item with 15 bids, **When** viewing the bid history table, **Then** all 15 bids are listed with bidder number and donor name (e.g., "#142 — Jane Smith"), bid amount, timestamp, bid type (regular, buy now, proxy auto), and bid status (active, outbid, winning, cancelled).
3. **Given** the detail view is open, **When** viewing the bid value timeline chart, **Then** a line chart shows bid amounts on the Y-axis and timestamps on the X-axis, with each bid plotted chronologically, showing the progression of bid value over time.
4. **Given** an item has a buy now price, **When** viewing the timeline chart, **Then** a horizontal reference line shows the buy now price threshold.
5. **Given** the admin is on a mobile device, **When** they open an item detail, **Then** the detail view is fully responsive with the timeline chart and bid history table stacked vertically.

---

### User Story 3 — Charts and Visual Breakdowns (Priority: P2)

As an event coordinator, I want visual charts showing auction performance by type and category, so I can quickly compare how different segments of the auction are performing.

The dashboard includes:
- A bar or pie chart showing total revenue by auction type (silent, live, buy now).
- A bar or pie chart showing total revenue by category.
- A bar chart showing bid count by auction type.
- A bar chart showing the top 10 items by total bid amount.
- A bar chart showing the top 10 items by bid count.
- A bar chart showing the top 10 items by watcher/view count.

**Why this priority**: Visualizations make the data immediately digestible and help identify patterns that are hard to spot in tabular data alone. However, the tables from US1 provide the same data in a different form, so charts are secondary.

**Independent Test**: Can be tested by viewing the dashboard for an event with diverse auction items and verifying each chart renders with accurate data matching what the tables show.

**Acceptance Scenarios**:

1. **Given** an event has items across silent, live, and buy now types, **When** viewing the type revenue chart, **Then** each type segment reflects the correct total revenue and the chart includes labels or a legend.
2. **Given** an event has items across 5+ categories, **When** viewing the category revenue chart, **Then** each category segment reflects the correct total revenue.
3. **Given** an event has 30 auction items, **When** viewing the top 10 items by revenue chart, **Then** only the top 10 items are shown ranked by total bid amount, with item names as labels.
4. **Given** the scope toggles from "This Event" to "All Events," **When** viewing any chart, **Then** chart data updates to reflect the aggregated data across all accessible events.

---

### User Story 4 — Filtering by Type and Category (Priority: P2)

As an event coordinator, I want to filter the auction items table and charts by auction type and category, so I can focus on specific segments of the auction.

Filters are available for auction type (silent, live, buy now — multi-select) and category (all 10 categories — multi-select). Applying a filter updates both the table and the charts simultaneously. Active filters are visually indicated and easily clearable.

**Why this priority**: Filtering makes the dashboard usable for events with large numbers of items. It extends the core table functionality from US1 with more targeted analysis.

**Independent Test**: Can be tested by applying type and category filters and verifying the table and charts reflect only the filtered subset of items.

**Acceptance Scenarios**:

1. **Given** the dashboard shows all items, **When** the admin selects "Silent" from the type filter, **Then** only silent auction items appear in the table, and all charts update to reflect only silent auction data.
2. **Given** the "Silent" and "Live" type filters are active, **When** the admin also selects the "Family" category, **Then** only silent and live items in the family category appear.
3. **Given** filters are active, **When** the admin clicks "Clear Filters," **Then** all filters are removed and the full dataset is displayed again.
4. **Given** filters are active, **When** the admin switches between table and card view, **Then** the same filters remain applied.

---

### User Story 5 — Event Scope Toggle (Priority: P2)

As an admin with access to multiple events, I want to toggle between viewing auction data for the current event only or across all events I have access to, so I can compare performance across events or focus on a single event.

A scope toggle control (matching the pattern used on the donor dashboard) lets the user switch between "This Event" and "All Events." When "All Events" is selected, all summary stats, charts, and the items table aggregate data across every event the signed-in user has permission to access. An additional event column appears in the table when in "All Events" mode so the user can see which event each item belongs to.

**Why this priority**: Multi-event aggregation is a unique and valuable capability, but most users will primarily use the single-event view. It complements rather than replaces the single-event dashboard.

**Independent Test**: Can be tested by having a user with access to 3+ events, toggling scope, and verifying data aggregation changes correctly.

**Acceptance Scenarios**:

1. **Given** the user has access to 3 events each with auction items, **When** they select "All Events," **Then** the dashboard totals reflect the combined data from all 3 events.
2. **Given** "All Events" is selected, **When** viewing the items table, **Then** an "Event" column is visible showing which event each item belongs to, and the table can be sorted and filtered by event.
3. **Given** "All Events" is selected, **When** the user switches back to "This Event," **Then** the dashboard returns to showing only the current event's data and the "Event" column is hidden.

---

### User Story 6 — Export Auction Data (Priority: P3)

As an event coordinator, I want to export the auction items table to CSV, so I can share data with stakeholders or perform further analysis offline.

A download button exports the current view (respecting active filters and scope) as a CSV file including all visible columns.

**Why this priority**: Export is a convenience feature that adds value but is not required for the dashboard to be useful.

**Independent Test**: Can be tested by applying filters, clicking export, and verifying the downloaded CSV contains the correct filtered dataset.

**Acceptance Scenarios**:

1. **Given** the table shows 15 filtered items, **When** the admin clicks CSV export, **Then** a CSV file downloads with exactly those 15 items and all visible columns.
2. **Given** the scope is "All Events," **When** exporting, **Then** the CSV includes the event name column.

---

### Edge Cases

- What happens when an event has zero auction items? The dashboard displays an empty state with a message and a prompt to create auction items.
- What happens when an item has zero bids? The item appears in the table with bid count of 0, and the detail view shows an empty bid history with a message.
- What happens when the user has access to only one event? The scope toggle is still visible but "All Events" produces the same result as "This Event."
- What happens when a bid is cancelled or withdrawn? Cancelled/withdrawn bids still appear in the bid history with their status clearly marked but do not count toward revenue or active bid summary statistics.
- What happens when a large number of items exist (100+)? The table paginates (25 items per page, matching the donor dashboard pattern) and charts remain performant.
- What happens when bid data changes while the admin is viewing the dashboard? The dashboard auto-refreshes every 60 seconds and also provides a manual refresh button for immediate updates.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a dashboard landing view with summary statistics: total auction items, total bids placed, total revenue (sum of winning/current bids), and average bid amount.
- **FR-002**: System MUST display a sortable, searchable, and paginated table of all auction items with columns: item name, auction type, category, current bid amount, bid count, watcher/view count, status, and (in "All Events" mode) event name.
- **FR-003**: System MUST allow users to toggle between table view and card view for the items listing.
- **FR-004**: System MUST allow sorting by any column in the items table (ascending and descending).
- **FR-005**: System MUST provide a search bar that filters items by name or donor name with debounced input.
- **FR-006**: System MUST provide multi-select filter controls for auction type (silent, live, buy now) and category (experiences, dining, travel, wellness, sports, family, art, retail, services, other).
- **FR-007**: Applying filters MUST update both the items table/cards and all charts simultaneously.
- **FR-008**: System MUST provide a scope toggle to switch between "This Event" and "All Events" — where "All Events" aggregates data across every event the signed-in user has access to.
- **FR-009**: When "All Events" scope is selected, the items table MUST include an "Event" column that is sortable and filterable.
- **FR-010**: System MUST display visual charts: revenue by auction type, revenue by category, bid count by type, top 10 items by revenue, top 10 items by bid count, and top 10 items by watcher count.
- **FR-011**: Clicking an item in the table or card view MUST navigate to a dedicated detail page (with its own route) showing full item information, complete bid history table, and a bid value timeline chart. A breadcrumb or back link MUST be provided to return to the dashboard.
- **FR-012**: The bid history table in the detail view MUST show: bidder number with donor name (e.g., "#142 — Jane Smith"), bid amount, timestamp, bid type, and bid status — sortable by any column.
- **FR-013**: The bid value timeline chart MUST plot bid amounts over time as a line chart, with a reference line for the buy now price when applicable.
- **FR-014**: System MUST allow exporting the current filtered/scoped items table as a CSV file.
- **FR-015**: System MUST paginate the items table (25 items per page, matching the donor dashboard pattern).
- **FR-016**: The dashboard MUST be fully responsive, with card view as the default on mobile-width screens and all charts readable on smaller viewports.
- **FR-017**: System MUST display an appropriate empty state when no auction items exist for the selected scope/filters.
- **FR-018**: Cancelled and withdrawn bids MUST appear in the bid history with their status clearly marked but MUST NOT count toward revenue or active bid summary statistics.
- **FR-019**: The dashboard MUST be accessible to users with event admin, NPO admin, or super admin roles for the relevant event(s).
- **FR-020**: The dashboard MUST auto-refresh data every 60 seconds and provide a manual refresh button for on-demand updates.

### Key Entities

- **Auction Item**: The individual item being auctioned. Key attributes: name, auction type (silent/live), buy now flag, category, starting bid, current bid, bid count, watcher count, status, associated event.
- **Auction Bid**: A bid placed on an item. Key attributes: bidder, amount, timestamp, type (regular/buy now/proxy auto), status (active/outbid/winning/cancelled/withdrawn).
- **Event**: The fundraising event that auction items belong to. The dashboard aggregates across events based on the user's access permissions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Admins can identify the highest-performing auction item (by revenue, bid count, or views) within 10 seconds of loading the dashboard.
- **SC-002**: Admins can view the complete bid history for any item within 2 clicks from the dashboard landing view.
- **SC-003**: Filtering by auction type or category updates the dashboard (table and charts) within 1 second.
- **SC-004**: The dashboard loads and renders all summary stats, charts, and the first page of items within 3 seconds for events with up to 200 auction items.
- **SC-005**: The dashboard is fully usable on mobile devices (320px width and above) with card view and responsive charts.
- **SC-006**: Switching between "This Event" and "All Events" scope produces accurate aggregated data within 2 seconds.
- **SC-007**: CSV export produces a correctly formatted file that includes all currently visible columns and respects active filters and scope.
- **SC-008**: 90% of admin users can find specific auction item performance data without external help on their first use.

## Assumptions

- "Buy now" items are identified by the `buy_now_enabled` flag on auction items, not as a separate auction type. However, for dashboard grouping and filtering purposes, items with buy now enabled are treated as a distinct visual category alongside silent and live types.
- The 10 predefined categories (experiences, dining, travel, wellness, sports, family, art, retail, services, other) are the complete set of categories used for filtering and charting.
- "Views" for auction items correspond to the existing watcher count field rather than page-view analytics.
- Revenue is calculated from current bid amounts for active/winning bids and buy now amounts for completed buy now transactions. Cancelled and withdrawn bids are excluded from revenue calculations.
- The donor dashboard's table/card toggle and scope toggle patterns are used as the reference implementation for consistency.
- Pagination follows the existing 25-items-per-page pattern from the donor dashboard.
- The dashboard does not require real-time WebSocket updates; it auto-refreshes every 60 seconds (matching the event dashboard pattern) and provides a manual refresh button.
- User access to events follows the existing permission model: users see only events they are assigned to, except super admins who see all events.

## Out of Scope

- **Item management actions**: Creating, editing, deleting, or changing the status of auction items (handled by existing auction item management pages).
- **Bid management actions**: Placing, cancelling, adjusting, or marking bids as winning (handled by existing auctioneer dashboard and bid management interfaces).
- **Bidding controls**: Opening or closing bidding on items.
- **Real-time WebSocket push updates**: The dashboard uses polling or manual refresh, not live push.
- **Donor-facing views**: This dashboard is admin-only; donor-facing auction browsing is a separate feature.
