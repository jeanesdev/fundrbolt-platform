# Feature Specification: Donor PWA and Event Page

**Feature Branch**: `010-donor-pwa-and`
**Created**: 2025-11-20
**Status**: Draft
**Input**: User description: "donor pwa and event page - I need a new pwa that is specifically for donors. It should use the same templates, styles, standards, formats, etc as the admin pwa. I want to be able to send a registration link to a user specifying which event they are registering for. From there they should be able to register as a new user with the same stuff as is on the admin pwa. Then they should go to the event home page. The event home page should use the branding as defined in the database and created in the admin pwa. It should use the colors defined in the event, it should have a url using the event slug. I'll add the auction functionality in a separate feature."

## Clarifications

### Session 2025-11-20

- Q: When registrant provides guest information during registration, is it required or optional? → A: Guest count required, detailed guest information optional (can be added later)
- Q: When should guests select meal choices if the event has meal options? → A: All guests (including registrant) select meals during registration
- Q: What happens if a guest arrives at the event without having made a meal selection? → A: Guests who arrive without meal selection choose at event
- Q: When registrant provides guest email addresses, how does admin facilitate those guests' registration? → A: Admin sends individual registration links to each guest email (guests linked to original registrant)
- Q: Once registrant provides guest information, where/how does admin access this data to send registration links? → A: Registration stores guest list; admin views/exports from event registrations page

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Event Registration via Link (Priority: P1)

A donor receives an event registration link via email (e.g., `https://fundrbolt.com/events/spring-gala-2025/register`), clicks it, and completes registration to access the event page.

**Why this priority**: This is the primary entry point for donors and the core user flow. Without this, donors cannot access events.

**Independent Test**: Can be fully tested by sending a registration link to a test email, completing the registration form, and verifying redirect to the event page. Delivers immediate value by enabling donor onboarding.

**Acceptance Scenarios**:

1. **Given** a donor receives an event registration link, **When** they click the link, **Then** they see a registration form pre-filled with the event context
2. **Given** a donor on the registration page, **When** they complete all required fields (email, password, first name, last name, number of guests), **Then** their account is created and they are logged in
3. **Given** a donor registering with guests, **When** they specify number of guests (e.g., 3), **Then** they can optionally provide guest details (name, email, phone) or skip and add later
4. **Given** an event with meal options, **When** the donor registers, **Then** they must select a meal choice for themselves and each guest
5. **Given** a donor who provides guest email addresses, **When** registration completes, **Then** admin can view the guest list and send individual registration links to each guest
6. **Given** a newly registered donor, **When** registration completes successfully, **Then** they are redirected to the event home page for that specific event
7. **Given** a donor who already has an account, **When** they click an event registration link, **Then** they are prompted to log in instead of register
8. **Given** a registered donor on an event page, **When** they log out and return via the event link, **Then** they can log in and access the event page
9. **Given** a guest who receives a registration link from admin, **When** they register, **Then** their account is linked to the original donor who invited them

---

### User Story 2 - Branded Event Home Page (Priority: P1)

A donor views an event home page that displays event-specific branding (colors, logo, banner) and event information.

**Why this priority**: Critical for user experience and brand consistency. The event page is the primary interface donors interact with.

**Independent Test**: Can be tested by accessing an event URL with configured branding and verifying all branded elements display correctly. Delivers value by creating a professional, cohesive event experience.

**Acceptance Scenarios**:

1. **Given** an event with custom branding configured, **When** a donor accesses the event page, **Then** they see the event's primary color applied to headers, buttons, and accents
2. **Given** an event with a logo uploaded, **When** the event page loads, **Then** the event logo displays prominently in the header
3. **Given** an event with a banner image, **When** the donor views the page, **Then** the banner displays at the top of the event page
4. **Given** an event with event details (title, date, description, venue), **When** the page loads, **Then** all event information displays clearly
5. **Given** an event without custom branding, **When** the page loads, **Then** default Fundrbolt branding is used

---

### User Story 3 - Event Slug-Based URLs (Priority: P2)

Events are accessible via human-readable URLs using event slugs (e.g., `/events/spring-gala-2025`).

**Why this priority**: Important for shareable links and SEO, but the event page can function with IDs initially.

**Independent Test**: Can be tested by creating an event with a slug, accessing it via the slug URL, and verifying the correct event loads. Delivers value through better user experience and link sharing.

**Acceptance Scenarios**:

1. **Given** an event with slug "spring-gala-2025", **When** a user navigates to `/events/spring-gala-2025`, **Then** the correct event page loads
2. **Given** an invalid event slug, **When** a user navigates to the URL, **Then** they see a "Event not found" error page
3. **Given** multiple events with different slugs, **When** accessing each slug URL, **Then** the correct event loads for each
4. **Given** an event with both ID and slug, **When** accessing via either `/events/{id}` or `/events/{slug}`, **Then** the same event page loads

---

### User Story 4 - Donor Session Management (Priority: P2)

A donor's session persists across page refreshes and browser tabs within the donor PWA.

**Why this priority**: Essential for good UX but can initially rely on standard session behavior.

**Independent Test**: Can be tested by logging in, refreshing the page, opening new tabs, and verifying session persistence. Delivers value through seamless user experience.

**Acceptance Scenarios**:

1. **Given** a logged-in donor, **When** they refresh the page, **Then** they remain logged in and on the same event page
2. **Given** a logged-in donor, **When** they open a new tab and navigate to the donor PWA, **Then** they are still logged in
3. **Given** an inactive donor session, **When** the session expires (after 7 days), **Then** they are logged out and prompted to log in again
4. **Given** a donor logs out, **When** they close and reopen the browser, **Then** they must log in again to access event pages

---

### User Story 5 - Donor PWA Architecture (Priority: P3)

The donor PWA is built as a separate application following the same standards, templates, and styles as the admin PWA.

**Why this priority**: Ensures code quality and maintainability but doesn't directly impact user-facing functionality.

**Independent Test**: Can be tested through code review verifying shared components, style consistency, and architectural patterns match the admin PWA.

**Acceptance Scenarios**:

1. **Given** the donor PWA codebase, **When** reviewing the project structure, **Then** it follows the same folder organization as the admin PWA
2. **Given** shared UI components (buttons, forms, cards), **When** used in the donor PWA, **Then** they render identically to the admin PWA
3. **Given** the donor PWA styling, **When** comparing to admin PWA, **Then** typography, spacing, and design tokens are consistent
4. **Given** both PWAs, **When** comparing build configurations, **Then** they use the same tooling (Vite, TypeScript, React, TanStack Router)

---

### Edge Cases

- What happens when a donor tries to access an event that hasn't started yet or has ended?
- How does the system handle an event with no branding configured?
- What happens when a donor tries to register with an email that already exists?
- How does the system handle malformed or non-existent event slugs?
- What happens when event branding assets (logo, banner) fail to load?
- How does the system handle donors accessing events they aren't registered for?
- What happens when a donor uses the registration link after already registering for that event?
- What happens when a donor specifies guests but doesn't provide their contact information?
- How does the system handle guests who arrive at an event without pre-selecting a meal choice?
- What happens if a guest receives a registration link but doesn't complete registration before the event?
- How does the admin track which guests are linked to which primary registrant?
- What happens when a registrant changes their guest count after initial registration?

## Requirements *(mandatory)*

### Functional Requirements

#### Registration & Authentication

- **FR-001**: System MUST generate event-specific registration URLs in the format `/events/{event-slug}/register`
- **FR-002**: System MUST accept registration data including email, password, first name, last name, and number of guests (required)
- **FR-003**: System MUST optionally accept phone, organization name, and address fields during registration
- **FR-004**: System MUST optionally accept guest details (name, email, phone) for each specified guest during registration
- **FR-005**: System MUST allow registrant to skip guest details and add them later before the event
- **FR-006**: System MUST validate email uniqueness during registration
- **FR-007**: System MUST create donor accounts with role "donor" by default
- **FR-008**: System MUST associate registered donors with the event they registered for
- **FR-009**: System MUST redirect newly registered donors to the event home page after successful registration
- **FR-010**: System MUST allow existing users to log in via event registration links instead of creating duplicate accounts
- **FR-011**: System MUST maintain donor sessions across page refreshes and browser tabs
- **FR-012**: System MUST expire donor sessions after 7 days of inactivity
- **FR-013**: System MUST support email/password authentication for donors
- **FR-014**: System MUST link guest registrations to the original donor who invited them
- **FR-015**: System MUST store guest list data for admin access and management

#### Meal Selection

- **FR-016**: System MUST display meal selection options during registration when event has meal options configured
- **FR-017**: System MUST require meal selection for the registrant when event has meal options
- **FR-018**: System MUST require meal selection for each guest when event has meal options
- **FR-019**: System MUST allow guests who arrive without meal selection to choose at the event
- **FR-020**: System MUST store meal selections per attendee (registrant and each guest)

#### Event Pages & Branding

- **FR-021**: System MUST generate unique, human-readable slugs for each event (e.g., "spring-gala-2025")
- **FR-022**: System MUST route requests to `/events/{event-slug}` to the correct event page
- **FR-023**: System MUST display event home pages using event-specific branding from the database
- **FR-024**: System MUST apply event primary color to page headers, buttons, and UI accents
- **FR-025**: System MUST display event logo in the page header if configured
- **FR-026**: System MUST display event banner image at the top of the page if configured
- **FR-027**: System MUST display event details including title, date, time, description, and venue
- **FR-028**: System MUST fall back to default Fundrbolt branding when event branding is not configured
- **FR-029**: System MUST handle missing or failed-to-load branding assets gracefully
- **FR-030**: System MUST support both slug-based URLs (`/events/{slug}`) and ID-based URLs (`/events/{id}`)

#### Admin Guest Management

- **FR-031**: Admin PWA MUST display guest lists for each event registration on the event registrations page
- **FR-032**: Admin PWA MUST show which guests are linked to which primary registrant
- **FR-033**: Admin PWA MUST provide ability to export guest lists with contact information
- **FR-034**: Admin PWA MUST enable sending individual registration links to guest email addresses
- **FR-035**: Admin PWA MUST display meal selections for each attendee (registrant and guests)

#### Donor PWA Architecture

- **FR-036**: Donor PWA MUST be a separate application from the admin PWA
- **FR-037**: Donor PWA MUST use the same technology stack as admin PWA (React, Vite, TypeScript, TanStack Router, Radix UI, Tailwind CSS)
- **FR-038**: Donor PWA MUST share UI component library with admin PWA
- **FR-039**: Donor PWA MUST use the same design tokens (colors, typography, spacing) as admin PWA
- **FR-040**: Donor PWA MUST follow the same code organization and architectural patterns as admin PWA
- **FR-041**: Donor PWA MUST be deployable as a separate Azure Static Web App
- **FR-042**: Donor PWA MUST communicate with the same backend API as admin PWA

#### Access Control

- **FR-043**: System MUST restrict donor access to only events they are registered for
- **FR-044**: System MUST require authentication to view event pages
- **FR-045**: System MUST display appropriate error messages when donors access non-existent events
- **FR-046**: System MUST display appropriate error messages when donors access events without proper registration

### Key Entities

- **Donor**: A user with role "donor" who registers for and participates in events. Includes standard user fields (email, name, phone, organization, address) plus event registrations and guest information.

- **Event Registration**: Links a donor to an event, tracking their registration status, timestamp, number of guests, and guest details. Stores optional guest information (names, emails, phones) and meal selections for all attendees. Represents the relationship between a donor and the event they're attending, including their party.

- **Guest**: An attendee associated with a primary registrant. Can have optional contact details (name, email, phone) and meal selection. May receive individual registration link from admin to create their own account, linking back to the primary registrant.

- **Meal Selection**: Choice made by an attendee (registrant or guest) from event-defined meal options. Required during registration if event has meal options configured. Guests arriving without meal selection can choose at the event.

- **Event Page**: A public-facing page for a specific event, displaying event information and branding. Uses event slug for URL routing and applies event-specific branding (colors, logo, banner).

- **Event Branding**: Visual customization for an event including primary color, secondary color, logo URL, banner URL. Already exists in the database from admin PWA feature.

- **Event Slug**: A unique, URL-friendly identifier for an event (e.g., "spring-gala-2025"). Used for generating shareable registration links and event page URLs.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Donors can complete event registration with guest information and meal selections in under 5 minutes
- **SC-002**: Event pages load with correct branding within 2 seconds
- **SC-003**: 95% of donors successfully navigate from registration link to event page on first attempt
- **SC-004**: Event slug URLs are 100% functional and resolve to correct event pages
- **SC-005**: Donor PWA maintains visual consistency with admin PWA (same design system, components, spacing)
- **SC-006**: System prevents duplicate registrations for the same donor/event combination
- **SC-007**: Event pages gracefully handle missing branding assets without breaking
- **SC-008**: Donors remain logged in across page refreshes and browser tabs during active sessions
- **SC-009**: Registration links are shareable and work correctly when accessed from different devices
- **SC-010**: Event pages are accessible via both slug-based and ID-based URLs without errors
- **SC-011**: Admin can view complete guest lists with contact information and meal selections for any event
- **SC-012**: Admin can export guest lists in under 10 seconds for events with up to 500 guests
- **SC-013**: Guest registration links sent by admin successfully link guests to primary registrant 100% of the time

## Dependencies & Assumptions *(mandatory)*

### Dependencies

- **DEP-001**: Existing user authentication system (OAuth2 + JWT) from feature 001-user-authentication-role
- **DEP-002**: Existing event creation and management functionality from feature 003-event-creation-ability
- **DEP-003**: Existing event branding system from admin PWA feature 009-admin-pwa-ui
- **DEP-004**: Existing event meal options configuration from admin PWA feature (event food options)
- **DEP-005**: Backend API endpoints for user registration and event retrieval
- **DEP-006**: Azure Static Web Apps for hosting the donor PWA separately from admin PWA
- **DEP-007**: Shared component library and design system from admin PWA
- **DEP-008**: Email delivery system for sending guest registration links

### Assumptions

- **ASM-001**: Event slugs are unique across all events (enforced at database level)
- **ASM-002**: Event branding data structure already exists in the database with fields for primary_color, secondary_color, logo_url, banner_url
- **ASM-003**: Email delivery system exists for sending registration links to donors and guests
- **ASM-004**: Event meal options are already configured in the database (from admin PWA event creation)
- **ASM-005**: Donors only need to register once per event (no multiple ticket types in this feature)
- **ASM-006**: Event pages are publicly accessible via shareable links (no additional access codes or passwords)
- **ASM-007**: Registration links do not expire (donors can use them at any time before/during the event)
- **ASM-008**: The admin PWA already has the component library, design tokens, and architectural patterns to be shared
- **ASM-009**: Backend API supports creating users with role "donor" and associating them with events
- **ASM-010**: Session management uses the same Redis-backed approach as admin PWA
- **ASM-011**: Event registration creates a user account for the primary registrant (not just an event attendee record)
- **ASM-012**: Guests can optionally create their own accounts via admin-sent registration links, but can also attend without accounts (on-site registration)
- **ASM-013**: Meal selections are stored per attendee and linked to event registrations
- **ASM-014**: Guest information (names, emails, phones) is optional and can be added/updated before the event

## Out of Scope

- **OOS-001**: Auction functionality (will be added in a separate feature)
- **OOS-002**: Payment processing or ticket purchasing
- **OOS-003**: Event check-in or attendance tracking at the venue
- **OOS-004**: Email template customization for registration links
- **OOS-005**: Multi-language support for event pages
- **OOS-006**: Social sharing features for events
- **OOS-007**: Event calendar integration (iCal, Google Calendar)
- **OOS-008**: Donor profile management (editing profile after registration)
- **OOS-009**: Event waitlist or capacity management
- **OOS-010**: Push notifications for event updates
- **OOS-011**: Offline support for donor PWA
- **OOS-012**: Event feedback or rating system
- **OOS-013**: Modifying guest count or guest list after initial registration (handled in future iteration)
- **OOS-014**: Automated reminder emails for guests to complete meal selections
- **OOS-015**: Dietary restriction notes or special meal requests (beyond selecting from predefined options)
