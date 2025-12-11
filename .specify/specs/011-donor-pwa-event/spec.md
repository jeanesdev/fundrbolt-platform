# Feature Specification: Donor PWA Event Homepage

**Feature Branch**: `011-donor-pwa-event`
**Created**: December 9, 2025
**Status**: Draft
**Input**: User description: "donor-pwa-event-page - The main page for the donor-pwa should be the event homepage. When a donor logs in, they should be sent to the home page for whatever the next event they are registered for. There should be no side bar. In the top bar on the left they should see the name of the event and a thumbnail of the event's image. If the event doesn't have an image it should show the NPO's image. If they are registered for multiple events when they click on that component in the top left corner it should show them a dropdown of other events they have access to, and when they click on that, it should take them to the home page for that event. The home page for each event should use the background colors and theme colors of the event they have chosen. The details of the event should be shown in collapsible sections. If the event is upcoming that section should be expanded by default, otherwise it should be collapsed. If the event is future, the top of the event homepage should show a countdown timer to when the event starts. Prominently on the home page, all of the auction items should be shown, with a selector to choose between silent auction items and live auction. The auction items should show the thumbnail image with the main description, the current bid amount, and a button to bid. The items gallery should have at least two columns. I want it to look very similar to Amazon. The event home page should feel very branded to the event and NPO, not to Augeo."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Event-Centric Login Experience (Priority: P1)

A donor logs into the donor PWA and is automatically directed to the homepage of their next upcoming registered event. The app feels immediately immersive and branded to the event/NPO they're attending, with no Augeo branding visible.

**Why this priority**: This is the core entry point for the entire donor experience. Without automatic routing to the right event and proper branding, the app provides no value. This establishes the fundamental event-first paradigm.

**Independent Test**: Can be fully tested by logging in as a donor with at least one event registration. Delivers immediate value by showing them their event context.

**Acceptance Scenarios**:

1. **Given** a donor is logged in with one registered event, **When** they access the PWA, **Then** they are redirected to that event's homepage with full event branding applied
2. **Given** a donor is logged in with multiple registered events, **When** they access the PWA, **Then** they are redirected to the homepage of the chronologically next upcoming event
3. **Given** a donor is logged in with no registered events, **When** they access the PWA, **Then** they see a welcoming empty state with guidance to browse events
4. **Given** a donor is logged in and their only registered event has passed, **When** they access the PWA, **Then** they see the most recent past event with appropriate messaging

---

### User Story 2 - Event Switcher and Navigation (Priority: P1)

A donor registered for multiple events can easily switch between events using the event selector in the top navigation bar. Each event switch applies that event's branding immediately.

**Why this priority**: Multi-event donors need seamless navigation. This is critical for the app's usability when donors support multiple NPOs or attend multiple events.

**Independent Test**: Can be tested by creating a user with multiple event registrations and verifying the dropdown appears, populates correctly, and switches events with branding changes.

**Acceptance Scenarios**:

1. **Given** a donor is on an event homepage with multiple registrations, **When** they click the event name/image in the top bar, **Then** a dropdown appears showing all their registered events
2. **Given** the event dropdown is open, **When** they click on a different event, **Then** they are navigated to that event's homepage with its branding applied
3. **Given** a donor has only one registered event, **When** they click the event name/image in the top bar, **Then** no dropdown appears (single event, no switching needed)
4. **Given** an event has no logo/banner, **When** the event selector displays, **Then** the NPO's logo is shown as fallback

---

### User Story 3 - Event Countdown Timer (Priority: P2)

When viewing a future event's homepage, donors see a prominent countdown timer showing time remaining until the event starts, building anticipation and engagement.

**Why this priority**: Creates engagement and urgency for future events. Not blocking for core functionality but significantly enhances the experience.

**Independent Test**: Can be tested by viewing a future event and verifying the countdown displays and updates in real-time.

**Acceptance Scenarios**:

1. **Given** an event is scheduled for the future, **When** viewing its homepage, **Then** a countdown timer displays showing days, hours, minutes, and seconds until event start
2. **Given** the countdown is active, **When** one second passes, **Then** the countdown updates in real-time without page refresh
3. **Given** an event has started or passed, **When** viewing its homepage, **Then** no countdown timer is displayed
4. **Given** an event starts within 24 hours, **When** viewing its homepage, **Then** the countdown displays in an emphasized style (larger, more prominent)

---

### User Story 4 - Branded Event Details Section (Priority: P2)

Donors can view comprehensive event information (venue, date/time, attire, contact) in collapsible sections that respect event timing (expanded for upcoming, collapsed for past).

**Why this priority**: Essential information for attendees but can be collapsed to prioritize auction content. Provides value without blocking auction browsing.

**Independent Test**: Can be tested by viewing an event homepage and expanding/collapsing the details sections, verifying content and default states.

**Acceptance Scenarios**:

1. **Given** an upcoming event (within 30 days), **When** viewing its homepage, **Then** the event details section is expanded by default
2. **Given** a past event, **When** viewing its homepage, **Then** the event details section is collapsed by default
3. **Given** the event details section is visible, **When** viewing it, **Then** venue name, address, date/time, timezone, attire requirements, and contact info are displayed
4. **Given** the event details section, **When** a donor clicks the section header, **Then** it toggles between expanded and collapsed states

---

### User Story 5 - Auction Items Gallery with Type Filtering (Priority: P1)

Donors see a prominent, Amazon-style gallery of auction items with filtering between silent and live auction types. Items display thumbnail, description, current bid, and a bid action button.

**Why this priority**: Auction browsing is the primary revenue-generating activity. This is core to the donor engagement and fundraising mission.

**Independent Test**: Can be tested by viewing an event with auction items and verifying the gallery renders, filters work, and items display correctly.

**Acceptance Scenarios**:

1. **Given** an event has auction items, **When** viewing the homepage, **Then** auction items are displayed in a responsive grid (minimum 2 columns on mobile, more on larger screens) with infinite scroll loading
2. **Given** auction items are displayed, **When** viewing an item card, **Then** the thumbnail image, title, current bid amount, and bid button are visible
3. **Given** auction items exist in both silent and live categories, **When** the auction type selector is clicked, **Then** the gallery filters to show only items of the selected type
4. **Given** an auction item has no bids, **When** viewing its card, **Then** the starting bid amount is displayed instead of current bid
5. **Given** a donor clicks the bid button on an item, **When** the action completes, **Then** they are taken to the item's detail/bidding page

---

### User Story 6 - Event-Branded Visual Theme (Priority: P1)

The event homepage applies the event's custom colors (primary, secondary, background, accent) throughout the UI, with fallback to NPO branding if event colors are not set.

**Why this priority**: Brand immersion is explicitly required. The app must not feel like Augeo - it must feel like the NPO's event.

**Independent Test**: Can be tested by viewing events with different color schemes and verifying CSS variables and visual elements reflect the branding.

**Acceptance Scenarios**:

1. **Given** an event has custom colors defined, **When** viewing its homepage, **Then** all primary UI elements (buttons, headers, borders) use the event's colors
2. **Given** an event has no custom colors, **When** viewing its homepage, **Then** the NPO's branding colors are applied as fallback
3. **Given** neither event nor NPO have custom colors, **When** viewing the homepage, **Then** tasteful neutral defaults are applied
4. **Given** a donor switches events via the selector, **When** the new event loads, **Then** all branding colors update immediately to match the new event

---

### User Story 7 - Sidebar-Free Clean Layout (Priority: P2)

The donor PWA event homepage has no sidebar navigation, providing maximum screen real estate for event content and auction browsing.

**Why this priority**: Explicitly requested in requirements. Improves mobile experience and focuses attention on event content.

**Independent Test**: Can be tested by viewing the event homepage on various device sizes and verifying no sidebar is present.

**Acceptance Scenarios**:

1. **Given** a donor is on the event homepage, **When** viewing on any device size, **Then** no sidebar navigation is visible
2. **Given** a donor is on the event homepage, **When** they need to access navigation, **Then** primary actions are accessible via the top bar and/or bottom navigation
3. **Given** a donor is on the event homepage on mobile, **When** viewing, **Then** content uses the full viewport width

---

### Edge Cases

- What happens when a donor's event registration is cancelled after they've logged in?
  - *The event should be removed from their event switcher; if it was their current event, redirect to next available event*
- What happens when an event's branding colors are invalid hex values?
  - *Fall back to NPO branding, then to system defaults*
- What happens when all auction items are in draft status?
  - *Show "No auction items available yet" empty state*
- What happens when the countdown timer reaches zero while the user is viewing?
  - *Remove countdown, optionally show "Event is starting now!" message briefly*
- What happens when the event's images fail to load?
  - *Show placeholder image with event initials or generic event icon*

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST redirect authenticated donors to their next upcoming registered event's homepage upon login
- **FR-002**: System MUST display the event name and thumbnail image in the top navigation bar
- **FR-003**: System MUST show the NPO's image when an event has no image defined
- **FR-004**: System MUST provide an event switcher dropdown when a donor has multiple registered events
- **FR-005**: System MUST apply the event's theme colors (primary, secondary, background, accent) to the homepage UI
- **FR-006**: System MUST fall back to NPO branding colors when event colors are not defined
- **FR-007**: System MUST display a real-time countdown timer for future events
- **FR-008**: System MUST hide the countdown timer for events that have started or passed
- **FR-009**: System MUST display event details in collapsible sections
- **FR-010**: System MUST expand event details by default for upcoming events (within 30 days)
- **FR-011**: System MUST collapse event details by default for past events
- **FR-012**: System MUST display auction items in a responsive grid layout (minimum 2 columns) with infinite scroll lazy loading
- **FR-013**: System MUST show each auction item's thumbnail, title, current/starting bid, and bid button
- **FR-014**: System MUST provide a selector to filter between all items, silent auction, and live auction (default: all items)
- **FR-019**: System MUST sort auction items by highest current bid first (items with no bids sorted by starting bid)
- **FR-015**: System MUST NOT display a sidebar on the event homepage
- **FR-016**: System MUST use full viewport width for content on mobile devices
- **FR-017**: System MUST sort events in the switcher by event date (nearest first)
- **FR-018**: System MUST display past events in the switcher below upcoming events

### Key Entities *(include if feature involves data)*

- **Event**: The core entity containing branding colors, images, date/time, venue details, and relationships to auction items
- **NPO**: Parent organization providing fallback branding (logo, colors) when event-specific branding is not set
- **EventRegistration**: Links donors to events, used to determine which events appear in the switcher
- **AuctionItem**: Items displayed in the gallery with type (silent/live), images, bid amounts, and status
- **EventBranding**: Composite of event and NPO colors/images used to theme the UI

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Donors can navigate from login to viewing auction items in under 5 seconds
- **SC-002**: 90% of donors can successfully switch between events using the event selector on first attempt
- **SC-003**: Page renders fully (including auction items) within 3 seconds on standard mobile connection
- **SC-004**: Event branding is visually distinct - users can identify which event they're viewing without reading text
- **SC-005**: Auction item grid displays correctly on screens from 320px to 1920px width
- **SC-006**: Countdown timer accuracy within 1 second of actual event start time
- **SC-007**: Zero Augeo branding visible on the event homepage (event/NPO branding only)
- **SC-008**: 95% of auction item thumbnails load successfully without fallback images

## Clarifications

### Session 2025-12-09

- Q: Default auction filter when landing on event homepage? → A: Show all items (no filter active) - combined silent + live
- Q: Auction items pagination strategy? → A: Infinite scroll with lazy loading as user scrolls down
- Q: Auction item default sort order? → A: Highest current bid first (items with no bids sorted by starting bid)

### Session 2025-12-09 (UI/UX Enhancements)

**Auction Item Business Logic**:

- Q: Should bidding be disabled based on event status? → A: Yes, Place Bid button disabled when event status is not 'active' OR event datetime is in the future
- Q: Button text for different states? → A: "Place Bid" (active), "Event Not Started" (future), "Bidding Closed" (closed), "Event Not Active" (draft)
- Q: Apply to both card and modal? → A: Yes, consistent behavior on auction item cards and detail modal

**Image Quality**:

- Q: Why are auction item images low resolution? → A: Backend was serving 200x200 thumbnails; updated to use full-resolution images from Azure Blob Storage

**Auction Item Detail Modal**:

- Q: User interaction with auction items? → A: Entire card clickable to open modal with full details, image gallery, and bid information
- Q: Close button preference? → A: Keep subtle built-in Dialog close button, remove custom foreground button

**Contact Information Formatting**:

- Q: How should phone numbers display? → A: Format as (XXX) XXX-XXXX for US numbers, handles 10-digit and 11-digit (with leading 1)
- Q: Address link improvements? → A: Include full address (street, city, state, zip) in both link href and display text for Google Maps

**Time Display**:

- Q: Timezone display format? → A: Show short timezone abbreviation (EST, PST) but not full timezone name (America/New_York)

**Interactive Links**:

- Q: Make event name clickable? → A: Yes, event name (hero section) links to Google Maps with venue address
- Q: Make venue name clickable? → A: Yes, venue name (quick info section) links to Google Maps with venue address
- Q: Add to calendar functionality? → A: Yes, date/time clickable to download .ics file with event details (3-hour duration, full venue location)

**Visual Consistency**:

- Q: Auction item theming? → A: All auction components use event theme colors via CSS variables (--event-primary, --event-secondary, --event-card-bg, etc.)
- Q: Tab selector contrast? → A: Active tab uses event primary color for background with proper text contrast
- Q: Badge positioning? → A: Live/Silent badge positioned on left side to avoid overlap with modal close button
- Q: Quantity display? → A: Hidden when quantity equals 1 (only show when multiple available)
- Q: Bid number display? → A: Show "Item #XX" on cards and in modal for easy reference

## Assumptions

- Events and NPOs have existing branding infrastructure (colors, images) that can be queried
- The existing event branding context and CSS variable injection system will be extended
- Auction items already have thumbnail URLs and bid information available via API
- The donor PWA already has authentication and session management in place
- Event registration data is accessible to determine which events a donor can view
- Real-time bid updates are out of scope for this feature (page refresh for updated bids is acceptable)
- The "bid" button navigates to a detail page; actual bidding flow is a separate feature
