# Feature Specification: Admin PWA Layout Redesign

**Feature Branch**: `017-admin-pwa-layout`
**Created**: 2026-01-22
**Status**: Draft
**Input**: User description: "admin-pwa-layout-redesign"

## Clarifications

### Session 2026-01-22

- Q: When should search/filter functionality appear in the event selector for users with many events? → A: Show search/filter when 10+ events (balances simplicity for small lists with utility for larger ones)
- Q: How should badge counts update when underlying data changes? → A: Poll on navigation (updates when user navigates between pages, simple and efficient for typical usage)
- Q: What is the default state and persistence behavior for collapsible navigation groups? → A: All groups expanded by default; state persists per user session (maximum initial visibility)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Dashboard-First Navigation (Priority: P1)

Admin users need quick access to their dashboard as the primary landing page after login, with all navigation consolidated in a single sidebar for simplified information architecture.

**Why this priority**: The dashboard is the most frequently accessed page and should be immediately accessible. Consolidating navigation reduces cognitive load and improves task completion speed.

**Independent Test**: Can be tested by logging in as any admin role and verifying the dashboard link appears at the top of the sidebar and navigates to the correct route.

**Acceptance Scenarios**:

1. **Given** an admin user logs in, **When** they land on the application, **Then** they see the dashboard link as the first item in the sidebar
2. **Given** an admin user is on any page, **When** they click the dashboard link in the sidebar, **Then** they navigate to the dashboard view
3. **Given** the sidebar is collapsed, **When** the user hovers over the dashboard icon, **Then** they see a tooltip indicating "Dashboard"

---

### User Story 2 - Event Selector with Smart Defaults (Priority: P1)

Admin users need to select an event to work with, and the system should intelligently default to the next active event or upcoming event to minimize clicks and reduce decision fatigue.

**Why this priority**: Event selection is a critical prerequisite for all event-specific tasks. Smart defaults reduce friction for the most common use case (working with current/upcoming events).

**Independent Test**: Can be tested by logging in with different event scenarios (active event exists, only future events, only past events) and verifying the correct event is auto-selected.

**Acceptance Scenarios**:

1. **Given** an NPO is selected and has an active event (status = active), **When** the event selector loads, **Then** the next active event is automatically selected
2. **Given** an NPO is selected with no active events but has upcoming events, **When** the event selector loads, **Then** the next chronologically upcoming event is selected
3. **Given** an NPO is selected with only past events, **When** the event selector loads, **Then** the most recent event is selected
4. **Given** a user selects a different NPO, **When** the NPO selection changes, **Then** the event selector refreshes to show only events for that NPO and applies the smart default logic
5. **Given** a user manually selects an event, **When** they navigate between pages, **Then** their manual selection persists until they change NPO or manually select a different event

---

### User Story 3 - Event-Specific Navigation in Sidebar (Priority: P1)

Admin users working on a specific event need quick access to all event-related sections (details, media, links, registrations, seating, tickets, sponsors, auction items) from the sidebar instead of horizontal tabs.

**Why this priority**: Moving event navigation to the sidebar eliminates tab navigation and provides consistent navigation patterns across the application. Users no longer need to remember which page has which tabs.

**Independent Test**: Can be tested by selecting an event and verifying all previously-tabbed sections appear in the sidebar under "Event: [Event Name]" with proper icons and badges.

**Acceptance Scenarios**:

1. **Given** an event is selected, **When** the sidebar renders, **Then** a new navigation group appears labeled "Event: [Event Name]" containing all event-specific sections
2. **Given** event-specific sections are displayed, **When** badges are applicable (media count, links count, food options count, sponsors count, auction items count, guest count), **Then** each navigation item shows the count badge next to its label
3. **Given** a user is on an event-specific page, **When** they click a different event section in the sidebar, **Then** they navigate to that section without page reload
4. **Given** no event is selected, **When** the sidebar renders, **Then** the "Event: [Name]" navigation group does not appear
5. **Given** a user switches events, **When** the event selector changes, **Then** the "Event: [Name]" label updates to reflect the new event name and all badge counts refresh

---

### User Story 4 - Admin Subgroup Navigation (Priority: P2)

Admin users with appropriate permissions need access to NPO management, event management (list of all events), and user management under a dedicated "Admin" section of the sidebar.

**Why this priority**: Grouping administrative functions improves navigation clarity and helps users distinguish between operational tasks (working on an event) and administrative tasks (managing resources).

**Independent Test**: Can be tested by logging in as different roles (Super Admin, NPO Admin, NPO Staff) and verifying the correct admin menu items appear with proper icons.

**Acceptance Scenarios**:

1. **Given** a user with admin permissions logs in, **When** the sidebar renders, **Then** an "Admin" navigation group appears containing NPO, Events, and Users links
2. **Given** "Fundrbolt Platform All Organizations" is NOT selected, **When** the sidebar renders, **Then** the NPO link within the Admin group is hidden
3. **Given** "Fundrbolt Platform All Organizations" IS selected, **When** the sidebar renders, **Then** the NPO link within the Admin group is visible and navigates to the NPO list page
4. **Given** a user without admin permissions logs in, **When** the sidebar renders, **Then** the Admin navigation group only shows items they have permission to access (if any)

---

### User Story 5 - Event Display in Top Bar (Priority: P2)

Admin users need to see the currently selected event prominently displayed in the top bar to maintain context awareness when working on event-specific tasks.

**Why this priority**: Context awareness is critical when managing multiple events. Displaying the selected event in the top bar provides constant visual confirmation of which event the user is currently working on.

**Independent Test**: Can be tested by selecting different events and verifying the event name appears in the top bar with visual prominence.

**Acceptance Scenarios**:

1. **Given** an event is selected, **When** any page loads, **Then** the event name is displayed prominently in the top bar (larger font, bold, or highlighted)
2. **Given** no event is selected, **When** the top bar renders, **Then** no event name is displayed or a placeholder like "No Event Selected" appears
3. **Given** a user switches events, **When** the event selector changes, **Then** the top bar updates immediately to show the new event name
4. **Given** the viewport is narrow (mobile/tablet), **When** the top bar renders, **Then** the event name is abbreviated or truncated with ellipsis to fit available space

---

### User Story 6 - Icon/Logo Fallbacks with Initials (Priority: P2)

Admin users need visual identifiers (logos/icons) for NPOs and events in the selectors, with graceful fallbacks to initial-based avatars when no image has been uploaded.

**Why this priority**: Visual identifiers improve recognition speed and make the interface more scannable. Consistent fallback patterns ensure the UI never looks broken or incomplete.

**Independent Test**: Can be tested by creating NPOs/events with and without logo uploads and verifying the correct visual representation appears in selectors.

**Acceptance Scenarios**:

1. **Given** an NPO has an uploaded logo, **When** the NPO selector renders, **Then** the logo image is displayed as the icon
2. **Given** an NPO does NOT have an uploaded logo, **When** the NPO selector renders, **Then** a circular avatar with the NPO's initials is generated using branding colors (or default theme colors if no branding)
3. **Given** an event has an uploaded logo/image, **When** the event selector renders, **Then** the event image is displayed as the icon
4. **Given** an event does NOT have an uploaded logo/image, **When** the event selector renders, **Then** a circular avatar with the event name's initials is generated using branding colors (or default theme colors if no branding)
5. **Given** initials are generated, **When** the NPO/event name has multiple words, **Then** the initials use the first letter of the first two words (max 2 characters)
6. **Given** branding colors are configured, **When** generating an initial avatar, **Then** the system uses the primary branding color as background and contrasting text color for readability

---

### User Story 7 - Remove Redundant Header Elements on Settings Pages (Priority: P3)

Admin users on the settings pages should see a clean interface without duplicate navigation elements (hamburger menu, search bar) that are already present in the main application layout.

**Why this priority**: Removing redundant UI elements reduces visual clutter and prevents user confusion. This is a polish improvement that doesn't affect core functionality.

**Independent Test**: Can be tested by navigating to profile settings pages and verifying no duplicate hamburger menu or search bar appears.

**Acceptance Scenarios**:

1. **Given** a user navigates to any settings page (profile, password, consent), **When** the page renders, **Then** no duplicate hamburger menu button appears
2. **Given** a user navigates to any settings page, **When** the page renders, **Then** no duplicate search bar appears
3. **Given** the main application layout already provides navigation, **When** settings pages render, **Then** they use only the main layout's navigation elements

---

### Edge Cases

- What happens when a user has no events in their organization? (Show empty state in event selector)
- What happens when event counts change while the user is on a page? (Badge counts update on navigation - when user navigates to a different page, counts refresh)
- What happens when a user switches from an event-specific page to a non-event page (e.g., dashboard) without explicitly deselecting the event? (Event remains selected but event-specific navigation is contextually shown/hidden)
- What happens when the event name is extremely long? (Truncate with ellipsis and provide tooltip on hover)
- What happens when NPO/event branding colors have poor contrast? (System enforces minimum contrast ratio for accessibility)
- What happens when a user has access to many events? (Event selector displays search/filter functionality when 10 or more events are present)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display the Dashboard link as the first item in the sidebar navigation
- **FR-002**: System MUST provide an event selector dropdown in the sidebar immediately below the NPO selector
- **FR-003**: Event selector MUST filter events by the currently selected NPO
- **FR-004**: Event selector MUST automatically select the next active event (status = "active") if one exists
- **FR-005**: Event selector MUST automatically select the next chronologically upcoming event if no active events exist
- **FR-006**: Event selector MUST automatically select the most recent event if only past events exist
- **FR-006a**: Event selector MUST display search/filter functionality when the filtered event list contains 10 or more events
- **FR-007**: System MUST display a navigation group labeled "Admin" containing NPO, Events, and Users links
- **FR-008**: NPO link in the Admin group MUST only be visible when "Fundrbolt Platform All Organizations" is selected in the NPO selector
- **FR-009**: System MUST display a navigation group labeled "Event: [Event Name]" when an event is selected
- **FR-010**: Event navigation group MUST contain all event-specific sections: Details, Media, Links, Food Options, Registrations, Seating, Tickets, Sponsors, Auction Items
- **FR-011**: Each event navigation item MUST display an appropriate icon
- **FR-012**: Event navigation items MUST display badge counts where applicable (media count, links count, food options count, sponsors count, auction items count, guest count)
- **FR-013**: System MUST display the selected event name prominently in the top bar when an event is selected
- **FR-014**: NPO selector MUST display the NPO's logo if uploaded, or a circular avatar with NPO initials using branding colors
- **FR-015**: Event selector MUST display the event's image/logo if uploaded, or a circular avatar with event name initials using branding colors
- **FR-016**: Initial avatars MUST use the first letter of the first two words (maximum 2 characters)
- **FR-017**: Initial avatars MUST use branding primary color as background if configured, otherwise use default theme colors (navy on white)
- **FR-018**: Initial avatars MUST ensure sufficient contrast ratio (WCAG AA minimum 4.5:1) between background and text
- **FR-019**: Settings pages MUST NOT display duplicate hamburger menu buttons
- **FR-020**: Settings pages MUST NOT display duplicate search bars
- **FR-021**: Event selector MUST persist the user's manual event selection across page navigation until NPO changes or user manually selects a different event
- **FR-022**: Badge counts MUST update via polling on navigation (when user navigates between pages, badge counts refresh to reflect current data)
- **FR-023**: Event name in top bar MUST truncate with ellipsis if it exceeds available space and provide full name on tooltip hover
- **FR-024**: System MUST remove existing horizontal tab navigation from event detail pages (tabs are now sidebar navigation items)
- **FR-025**: Navigation groups (Admin, Event) MUST be expanded by default and MUST persist their collapsed/expanded state per user session

### Key Entities *(include if feature involves data)*

- **Event Selector State**: Tracks currently selected event ID, event name, NPO filter, and whether selection is automatic (smart default) or manual
- **Navigation Group**: Represents a collapsible section in the sidebar (Dashboard, Admin, Event: [Name]) with child navigation items; expanded by default with state persisted per user session
- **Navigation Item**: Represents a single link in the sidebar with title, icon, URL, optional badge count, and permission requirements
- **Initial Avatar**: Represents a generated visual identifier with initials text, background color, text color, and ensures accessibility contrast

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Admin users can access the dashboard in one click from any page via the sidebar
- **SC-002**: 90% of event-specific tasks begin with the correct event already selected (smart default success rate)
- **SC-003**: Time to navigate between event-specific sections reduces by 40% compared to horizontal tab navigation (measured by click count and time)
- **SC-004**: Users can identify which event they're working on within 2 seconds by glancing at the top bar
- **SC-005**: 95% of NPO and event selectors display visual identifiers (logo or initial avatar) without broken image placeholders
- **SC-006**: All initial avatars meet WCAG AA contrast requirements (4.5:1 minimum) for accessibility compliance
- **SC-007**: Zero duplicate navigation elements (hamburger menu, search bar) appear on settings pages after redesign
- **SC-008**: Admin users with multiple events can switch between events in under 3 clicks from any page
