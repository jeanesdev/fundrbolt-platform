# Feature Specification: Admin PWA Mobile & Tablet UI

**Feature Branch**: `032-admin-pwa-mobile`
**Created**: 2026-03-04
**Status**: Draft
**Input**: User description: "admin-pwa-mobile-ui — Make the admin-pwa more mobile friendly, targeting tablets particularly. Add a card/list view toggle for tables at mobile breakpoints. Make the left sidebar collapsible. Add recommendations for tablet-friendliness."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Table/Card View Toggle on Narrow Screens (Priority: P1)

An event coordinator managing their event from an iPad (or similar tablet) navigates to any page that displays data in a table (e.g., attendee list, check-in list, user management, bid history, ticket sales). On a screen narrower than a desktop, the table is difficult to read because it overflows horizontally, requiring awkward scrolling. Instead, the coordinator can switch to a card/list view that stacks each record vertically, showing key fields in a scannable layout. The system remembers their preference.

**Why this priority**: Tables are the most data-heavy parts of the app and currently have zero responsive adaptation. Every table overflows horizontally on tablets and phones, making the most critical admin workflows (check-in, attendee management, bid tracking) nearly unusable on smaller screens.

**Independent Test**: Can be tested by loading any table view on a tablet-width viewport and verifying the toggle appears, switches to a card layout, and persists the choice on navigation and after closing/reopening the browser (via localStorage, per FR-003).

**Acceptance Scenarios**:

1. **Given** a user is viewing a data table page on a screen narrower than 1024px, **When** the page loads, **Then** a view toggle (table icon / card icon) is visible near the table toolbar, and the default view is "card" on narrow screens.
2. **Given** a user is in card view, **When** they tap an individual card, **Then** they can access the same actions (edit, delete, view details) available in the table row.
3. **Given** a user switches from card view to table view on a tablet, **When** they navigate to another table page and return—or close and later reopen the app on the same device—**Then** their view preference is persisted across pages and browser sessions (stored in localStorage).
4. **Given** a user is on a desktop-width screen (≥ 1024px), **When** they view a table page, **Then** the table renders as it does today and the toggle is still available but defaults to table view.
5. **Given** a user is in card view, **When** they use existing filters, search, sorting, or pagination, **Then** those controls continue to work identically.

---

### User Story 2 - Collapsible Sidebar on Tablets (Priority: P1)

An event coordinator using a tablet in landscape mode opens the admin app. The sidebar occupies significant screen width, leaving limited room for the main content area. The coordinator can collapse the sidebar to a narrow icon-only rail (or dismiss it entirely) to reclaim horizontal space, and expand it again when needed. On portrait tablets, the sidebar behaves as an overlay that slides in/out.

**Why this priority**: On tablets, the always-visible sidebar combined with data-dense pages creates a cramped layout. Collapsibility is essential to make the main content area usable, especially in portrait orientation.

**Independent Test**: Can be tested by loading the app at tablet width and verifying the sidebar collapses/expands via a toggle, and that the main content area adjusts to fill available space.

**Acceptance Scenarios**:

1. **Given** a user is on a tablet in landscape orientation (screen width 1024–1366px), **When** the app loads, **Then** the sidebar is collapsed to the icon rail by default, freeing space for content.
2. **Given** the sidebar is collapsed to icon rail, **When** the user taps the expand toggle or a sidebar icon, **Then** the sidebar expands as a temporary overlay without pushing the main content.
3. **Given** a user is on a tablet in portrait orientation (< 1024px), **When** the sidebar is accessed, **Then** it opens as a slide-over sheet (overlay) that can be dismissed by tapping outside or swiping.
4. **Given** the sidebar is expanded on a tablet, **When** the user taps the collapse control or taps outside the sidebar, **Then** the sidebar returns to its collapsed/hidden state.
5. **Given** a user collapses the sidebar on a tablet, **When** they navigate to another page, **Then** the sidebar remains in its collapsed state.

---

### User Story 3 - Touch-Friendly Interactive Elements (Priority: P2)

A coordinator using a tablet taps buttons, form controls, action menus, and interactive elements throughout the app. Currently, some controls are sized for mouse precision. On touch devices, all interactive targets meet comfortable touch sizes, and spacing between adjacent targets prevents accidental taps.

**Why this priority**: Even with responsive layouts, undersized tap targets cause frustration and errors on touch devices. This ensures the app feels native on tablets.

**Independent Test**: Can be tested by navigating the app on a touch device and verifying all interactive elements are comfortably tappable without accidentally hitting adjacent controls.

**Acceptance Scenarios**:

1. **Given** a user is on a touch device, **When** they interact with any button, link, or action menu, **Then** the tappable area is at least 44×44 points (per WCAG 2.5.8 / Apple HIG guidelines).
2. **Given** a user is viewing a card in mobile card view, **When** they tap an action button (edit, delete), **Then** the button is large enough to tap accurately and spaced away from other actions.
3. **Given** a user is using the pagination controls, **When** they tap page numbers or next/previous, **Then** the controls are comfortably spaced for touch input.
4. **Given** a user opens a dropdown or popover menu on a touch device, **When** the options appear, **Then** each option has adequate height and spacing for finger selection.

---

### User Story 4 - Responsive Form Layouts (Priority: P2)

A coordinator creating or editing an event, auction item, or ticket package on a tablet encounters multi-column form layouts that may be too narrow in each column on medium screens. Forms adapt to single-column on portrait tablets and two-column on landscape tablets, with fields sized for comfortable text entry.

**Why this priority**: Forms are the primary input mechanism for event setup. Cramped multi-column layouts on tablets lead to input errors and slow data entry.

**Independent Test**: Can be tested by opening any create/edit form at tablet widths and verifying fields reflow to appropriate column counts and text inputs are comfortably sized.

**Acceptance Scenarios**:

1. **Given** a user opens an event creation form on a tablet in portrait mode, **When** the form renders, **Then** it uses a single-column layout with full-width fields.
2. **Given** a user opens the same form on a tablet in landscape mode, **When** the form renders, **Then** it uses a two-column layout where both columns are wide enough for comfortable input.
3. **Given** a user is filling in a form on a tablet, **When** they tap a text input, **Then** the on-screen keyboard does not obscure the active field (content scrolls to keep the field visible).
4. **Given** date pickers, dropdowns, or selectors in a form, **When** a user interacts with them on a tablet, **Then** they render appropriately sized for touch and do not clip off-screen.

---

### User Story 5 - Responsive Dashboard and Summary Cards (Priority: P3)

A coordinator views the event dashboard on a tablet. Summary/stat cards and charts reflow gracefully at tablet widths, stacking or adjusting columns so no content is cut off or requires horizontal scrolling.

**Why this priority**: The dashboard is the first screen coordinators see. While not as data-dense as tables, clipped charts or overflowing stat grids make a bad first impression.

**Independent Test**: Can be tested by loading the event dashboard at tablet widths and verifying all stat cards and charts are fully visible without horizontal scrolling.

**Acceptance Scenarios**:

1. **Given** a user views the event dashboard on a tablet in portrait, **When** the dashboard renders, **Then** stat cards stack in a 2-column grid (instead of 4-column).
2. **Given** a user views charts on a tablet, **When** the charts render, **Then** they resize proportionally within their container without clipping or horizontal overflow.
3. **Given** a user views the event dashboard on a tablet in landscape, **When** the dashboard renders, **Then** stat cards use a 3-column or 4-column grid as space allows.

---

### User Story 6 - Quick Entry Optimization for Tablets (Priority: P3)

During a live event, staff use tablets at check-in stations or bid-entry stations. The quick-entry interface (live bid, paddle raise, buy now) should be optimized for rapid input on touch devices, with large input areas, prominent submit buttons, and a recent-entries list that works well at tablet widths.

**Why this priority**: Live event workflows are time-critical. Tablet-optimized quick entry is a competitive advantage for on-site usage.

**Independent Test**: Can be tested by loading the quick-entry forms at tablet width and verifying large touch targets, comfortable input areas, and a readable recent-entries list.

**Acceptance Scenarios**:

1. **Given** a user opens the live bid entry on a tablet, **When** the form renders, **Then** the bidder number input, amount input, and submit button are prominently sized for rapid one-handed entry.
2. **Given** a user is viewing the recent bids list on a tablet, **When** the list renders, **Then** entries are displayed in a scannable vertical list without horizontal overflow.
3. **Given** a user submits a bid entry on a tablet, **When** they tap submit, **Then** success/error feedback is clearly visible and the form resets for the next entry within 1 second.

---

### Edge Cases

- What happens when a user rotates their tablet mid-session (portrait ↔ landscape)? Layout must reflow without losing form data or scroll position.
- What happens when a table has zero rows in card view? An appropriate empty-state message displays consistently with the table view empty state.
- What happens when a data table has expandable rows (e.g., attendee list with guests)? Card view must support expanding to show nested details.
- What happens when the sidebar is open and the user rotates from landscape to portrait? The sidebar transitions to the overlay mode without content jump.
- What happens with bulk selection in card view? Cards support selection checkboxes and the bulk action toolbar displays consistently.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a view toggle on all data table pages allowing users to switch between a traditional table view and a mobile-friendly card/list view.
- **FR-002**: System MUST default to card view on viewports narrower than 1024px and to table view on viewports 1024px and wider.
- **FR-003**: System MUST remember the user's view preference (table vs. card) independently per page, persisted in browser localStorage (survives browser close; cleared only when the user clears site data).
- **FR-004**: Card view MUST display 3–5 primary fields prominently per card, with remaining fields accessible via an expandable "More details" section on each card. Primary fields are determined per table based on the most frequently referenced columns.
- **FR-005**: Card view MUST support all the same interactions as table view: row actions (edit, delete, details), selection/checkboxes, sorting, filtering, search, and pagination.
- **FR-006**: The left sidebar MUST be collapsible to an icon-only rail on screens between 1024px and 1366px (tablet landscape). When expanded from the rail, the sidebar MUST open as an overlay floating over the content (content remains full-width underneath), not push the content narrower.
- **FR-007**: The left sidebar MUST behave as an overlay/sheet on screens below 1024px (tablet portrait and phone).
- **FR-008**: The sidebar collapsed/expanded state MUST persist across page navigation within the session.
- **FR-009**: All interactive elements (buttons, links, menu items, form controls) MUST have a minimum touch target size of 44×44 CSS pixels on screens narrower than 1366px.
- **FR-010**: Form layouts MUST reflow to single-column on screens narrower than 768px and two-column on screens between 768px and 1024px.
- **FR-011**: Dashboard summary cards MUST reflow to a responsive grid: 2-column on portrait tablets, 3–4 column on landscape tablets.
- **FR-012**: Charts and data visualizations MUST resize proportionally within their containers on all supported screen widths.
- **FR-013**: Orientation changes (portrait ↔ landscape) MUST trigger layout reflow without data loss, scroll position reset, or visual glitches.
- **FR-014**: Card view for tables with expandable rows (e.g., attendee list with guest details) MUST support an expand/collapse interaction to reveal nested data.
- **FR-015**: The quick-entry interface (bid entry, paddle raise, buy now) MUST render with enlarged input areas and buttons optimized for touch interaction on tablets.
- **FR-016**: Text inputs on screens narrower than 768px MUST use a minimum font size of 16px to prevent automatic zoom on iOS/Safari.

### Key Entities

- **View Preference**: Stores the user's choice of table vs. card view across browser sessions, scoped per page (each table page remembers its own preference independently). Persisted in browser local storage keyed by page path.
- **Breakpoint Configuration**: Defines the screen width thresholds that trigger layout changes — phone (< 768px), tablet portrait (768–1023px), tablet landscape (1024–1366px), desktop (≥ 1367px).
- **Card Layout Definition**: Per-table configuration specifying which 3–5 fields are shown as primary on the card, which fields appear in the expandable "More details" section, their display order, and how actions are presented. Derived from the existing table column definitions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 12 existing data table views render without horizontal overflow on screens as narrow as 768px when card view is active.
- **SC-002**: Users can complete common tablet workflows (event check-in, attendee lookup, bid entry) without needing to scroll horizontally at any point.
- **SC-003**: The sidebar can be collapsed and expanded on tablets in under 0.5 seconds with a smooth animation.
- **SC-004**: All interactive elements pass WCAG 2.5.8 target size requirements (≥ 44×44 CSS pixels) on tablet viewports.
- **SC-005**: View toggle preference persists correctly across 10+ consecutive page navigations and survives browser close/reopen (localStorage persistence).
- **SC-006**: Orientation changes on tablets complete layout reflow within 0.3 seconds without any visible content jump or data loss.
- **SC-007**: The app achieves a "Mobile Friendly" pass when tested at 1024px and 768px screen widths in browser dev tools or on actual tablet devices.
- **SC-008**: Form completion time on a tablet does not exceed 1.5x the completion time on desktop for the same form.
- **SC-009**: Quick-entry workflows (bid submission, paddle raise) can be completed in under 5 seconds per entry on a tablet, matching desktop performance.
- **SC-010**: Card view rendering for a table with 50+ records completes initial paint in under 1 second.

## Clarifications

### Session 2026-03-04

- Q: Should the table/card view preference be stored globally (one toggle for all pages) or per-page (each table page remembers independently)? → A: Per-page — each table page remembers its own table/card preference independently.
- Q: Should card view show all table fields equally, or emphasize a subset of primary fields with the rest expandable? → A: Primary fields prominent (3–5 key fields) with remaining fields in a collapsible "More details" section.
- Q: When sidebar is expanded on tablet landscape (1024–1366px), should it overlay content or push content narrower? → A: Overlay — sidebar floats over content; content stays full-width underneath.

## Assumptions

- The existing sidebar component already supports overlay behavior on mobile; this feature extends that to tablet breakpoints rather than rebuilding sidebar behavior from scratch.
- The current mobile breakpoint hook (768px) may need to be supplemented with additional breakpoint hooks (e.g., tablet detection) rather than replaced, to avoid breaking existing mobile-specific behavior.
- Card view will reuse existing column definitions from the table (column header as label, cell renderer for value), not require separate card templates for each table.
- The existing data-table components (pagination, toolbar, filter, bulk actions) will be reused in card view with layout adjustments, not rebuilt.
- iOS Safari is a primary target browser given iPad prevalence in event-staff workflows.
- Performance optimization for large table datasets (100+ rows) is handled by existing pagination; card view does not introduce virtual scrolling.
