# Feature Specification: Admin PWA UI Cleanup & Role-Based Access Control

**Feature Branch**: `009-admin-pwa-ui`
**Created**: 2025-11-17
**Status**: Draft
**Input**: User description: "admin-pwa-ui-cleanup: I need to cleanup the ui for the PWA theres a lot of stuff from the template that doesn't need to be there, like Tasks, Chats, Apps, settings, appearance, help center. I don't want the user to be able to select between themes or dark mode/light mode. I need a SuperAdmin dashboard, an NPO dashboard, an Auctioneer Dashboard and an Event Dashboard, but these can be place holders. Right now the profile drop down in the top right corner only shows up on the dashboard page. I want that to be everywhere, but you can get rid of the billing, settings, new team drop downs. I do want the profile page, but I need that to be updated to allow the user to change their profile information according to my models. I don't think the search bar is working right now, but I do think it would be helpful if it actually worked. The hamburger menu can be removed. Make sure when an NPO admin logs in, they only see their NPO, events, and users. When an auctioneer signs in, he should only see the NPOs in read only, the ones he is registered with, and the events he is registered with and the users registered with the events (read only) he is registered with. The staff should only see their NPO in read only and their events. Just make sure whoever is logged in, they can only see what they are supposed to be able to see. Donors shouldn't be logging into the admin PWA. The Teams icon in the top left corner should show which NPO is selected and it should change what's available in the other menus and pages. The SuperAdmin should be able to select any NPO or Fundrbolt Platform which shows all NPOs."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Role-Based Dashboard Access (Priority: P1)

Users with different roles (SuperAdmin, NPO Admin, Event Coordinator, Staff) need to see dashboards and navigation items relevant to their role and permissions, ensuring they can only access data they're authorized to view.

**Why this priority**: This is the foundational security and user experience requirement. Without proper role-based access control, users could see data they shouldn't access, creating security vulnerabilities and confusion.

**Independent Test**: Can be fully tested by logging in as each role type and verifying the dashboard and navigation items match the role's permissions. Delivers immediate value by ensuring users only see relevant information.

**Acceptance Scenarios**:

1. **Given** a SuperAdmin logs into the admin PWA, **When** they view the dashboard, **Then** they see the SuperAdmin dashboard and can select any NPO or "Fundrbolt Platform" from the NPO selector
2. **Given** an NPO Admin logs into the admin PWA, **When** they view the dashboard, **Then** they see the NPO dashboard with only their assigned NPO, events, and users
3. **Given** an Event Coordinator logs into the admin PWA, **When** they view the dashboard, **Then** they see the Auctioneer dashboard with read-only access to NPOs they're registered with, and full access to events they're assigned to
4. **Given** a Staff member logs into the admin PWA, **When** they view the dashboard, **Then** they see the Event dashboard with read-only access to their NPO and full access to their assigned events
5. **Given** a Donor attempts to access the admin PWA, **When** they try to log in, **Then** they are denied access with a message indicating this is for administrators only

---

### User Story 2 - Template Cleanup & Simplified Navigation (Priority: P1)

Users need a clean, focused admin interface without unnecessary template features (Tasks, Chats, Apps, Settings, Appearance, Help Center, theme selectors, hamburger menu) so they can efficiently perform their administrative duties.

**Why this priority**: Removing clutter is essential for user productivity and reduces confusion. This must be done before adding new features to avoid rework.

**Independent Test**: Can be fully tested by navigating through all pages of the admin PWA and verifying removed features are no longer accessible. Delivers value by creating a cleaner, more focused interface.

**Acceptance Scenarios**:

1. **Given** any authenticated user is on any page in the admin PWA, **When** they view the navigation, **Then** they do not see options for Tasks, Chats, Apps, Settings, Appearance, or Help Center
2. **Given** any authenticated user is on any page in the admin PWA, **When** they view the interface, **Then** they do not see theme selector or dark mode/light mode toggle options
3. **Given** any authenticated user is on any page in the admin PWA, **When** they view the navigation, **Then** they do not see a hamburger menu icon
4. **Given** any authenticated user views the interface, **When** they look for navigation options, **Then** they see a streamlined menu with only relevant options for their role

---

### User Story 3 - Persistent Profile Dropdown Access (Priority: P2)

Users need access to their profile dropdown menu from any page in the admin PWA (not just the dashboard) so they can quickly access their profile or log out from anywhere.

**Why this priority**: This is a critical usability feature but doesn't block core functionality. Users can still access profile from dashboard, but it's inconvenient.

**Independent Test**: Can be fully tested by navigating to different pages and verifying the profile dropdown appears consistently. Delivers value by improving user convenience.

**Acceptance Scenarios**:

1. **Given** an authenticated user is on the dashboard page, **When** they view the top right corner, **Then** they see a profile dropdown menu
2. **Given** an authenticated user is on any non-dashboard page (NPOs, Events, Users, etc.), **When** they view the top right corner, **Then** they see the same profile dropdown menu
3. **Given** an authenticated user clicks the profile dropdown, **When** they view the menu options, **Then** they see "Profile" and "Logout" options only (no Billing, Settings, or New Team)
4. **Given** an authenticated user clicks "Profile" in the dropdown, **When** the profile page loads, **Then** they can view and edit their profile information

---

### User Story 4 - Editable User Profile Page (Priority: P2)

Users need to update their profile information (first name, last name, email, phone, organization name, address fields) so they can keep their account information current.

**Why this priority**: Profile management is important for data accuracy but not critical for initial launch. Users can have their profiles updated by admins if needed initially.

**Independent Test**: Can be fully tested by navigating to the profile page and successfully updating each editable field. Delivers value by allowing users to self-manage their information.

**Acceptance Scenarios**:

1. **Given** an authenticated user is on the profile page, **When** they view the page, **Then** they see their current profile information including first name, last name, email, phone, organization name, and address fields (address_line1, address_line2, city, state, postal_code, country)
2. **Given** an authenticated user edits their profile information, **When** they save the changes, **Then** the system validates the data and updates their profile
3. **Given** an authenticated user enters invalid data (e.g., invalid email format), **When** they attempt to save, **Then** they see clear validation error messages
4. **Given** an authenticated user successfully updates their profile, **When** the save completes, **Then** they see a confirmation message and the updated data persists

---

### User Story 5 - NPO Context Selector (Priority: P2)

Users need an NPO selector (replacing the Teams icon) in the top left corner that displays the currently selected NPO and allows appropriate role-based selection, so they can switch between NPO contexts and see filtered data.

**Why this priority**: This is essential for multi-NPO management but can be implemented after basic role-based access is working.

**Independent Test**: Can be fully tested by users with different roles selecting NPOs and verifying data filtering works correctly. Delivers value by enabling multi-NPO workflows.

**Acceptance Scenarios**:

1. **Given** a SuperAdmin views the NPO selector, **When** they click it, **Then** they see a list of all NPOs plus an "Fundrbolt Platform" option
2. **Given** a SuperAdmin selects "Fundrbolt Platform", **When** they view NPO, Event, and User pages, **Then** they see data for all NPOs
3. **Given** a SuperAdmin selects a specific NPO, **When** they view NPO, Event, and User pages, **Then** they see data filtered to that NPO only
4. **Given** an NPO Admin views the NPO selector, **When** they click it, **Then** they see only their assigned NPO (non-editable)
5. **Given** an Event Coordinator views the NPO selector, **When** they click it, **Then** they see only NPOs they are registered with (if multiple)
6. **Given** a Staff member views the NPO selector, **When** they click it, **Then** they see only their assigned NPO (non-editable)
7. **Given** any user changes their NPO selection, **When** they navigate to other pages, **Then** the displayed data reflects the selected NPO context

---

### User Story 6 - Functional Search Bar (Priority: P3)

Users need a working search bar that helps them quickly find NPOs, events, users, or other resources across the admin PWA, so they can navigate efficiently without browsing through lists.

**Why this priority**: Search is a convenience feature that enhances productivity but isn't critical for core functionality. Users can navigate via menus initially.

**Independent Test**: Can be fully tested by entering search queries and verifying relevant results appear, respecting role-based permissions. Delivers value by reducing navigation time.

**Acceptance Scenarios**:

1. **Given** an authenticated user enters a search query in the search bar, **When** they submit the search, **Then** they see relevant results filtered by their role permissions
2. **Given** a SuperAdmin searches for an NPO name, **When** results appear, **Then** they see all matching NPOs
3. **Given** an NPO Admin searches for a user name, **When** results appear, **Then** they see only users associated with their NPO
4. **Given** an Event Coordinator searches for an event, **When** results appear, **Then** they see only events they're registered with
5. **Given** a user enters a search query with no results, **When** the search completes, **Then** they see a "No results found" message with helpful suggestions

---

### Edge Cases

- What happens when a SuperAdmin has "Fundrbolt Platform" selected and tries to edit an NPO-specific resource? System allows editing with inline NPO selection in the edit form, providing a streamlined workflow where the NPO can be selected while editing.
- How does the system handle users with multiple role assignments (e.g., both NPO Admin and Event Coordinator)? System displays the highest privilege role and allows role switching if multiple roles exist.
- What happens when an Event Coordinator is removed from an event while viewing that event's page? System immediately redirects to dashboard with a notification message explaining access was revoked.
- How does the system handle NPO selection persistence across sessions (should it remember the last selected NPO)? System remembers the last selected NPO across sessions for convenience.
- What happens when an NPO Admin's NPO is deactivated while they're logged in? System logs them out automatically with a message explaining their NPO has been deactivated.
- How does the search bar handle partial matches and typos? System supports partial matching and provides "Did you mean?" suggestions for close matches.
- What happens when a user tries to access a direct URL for a resource they don't have permission to view? System shows a 403 Forbidden page with a message and redirects to their dashboard after 3 seconds.

## Requirements *(mandatory)*

### Functional Requirements

**Navigation & UI Cleanup**

- **FR-001**: System MUST remove all template navigation items including Tasks, Chats, Apps, Settings, Appearance, and Help Center from the admin PWA
- **FR-002**: System MUST remove theme selection and dark mode/light mode toggle functionality
- **FR-003**: System MUST remove the hamburger menu from all pages
- **FR-004**: System MUST display a profile dropdown menu in the top right corner on all pages (not just dashboard)
- **FR-005**: Profile dropdown MUST contain only "Profile" and "Logout" options (Billing, Settings, and New Team options removed)

**Dashboard & Role-Based Views**

- **FR-006**: System MUST provide a SuperAdmin dashboard accessible only to users with SuperAdmin role
- **FR-007**: System MUST provide an NPO dashboard accessible to NPO Admin users
- **FR-008**: System MUST provide an Auctioneer dashboard accessible to Event Coordinator users
- **FR-009**: System MUST provide an Event dashboard accessible to Staff users
- **FR-010**: System MUST prevent Donor role users from accessing the admin PWA entirely

**Role-Based Data Access**

- **FR-011**: SuperAdmin users MUST be able to view all NPOs, events, and users across the entire platform
- **FR-012**: NPO Admin users MUST be able to view only their assigned NPO, its events, and its users
- **FR-013**: Event Coordinator users MUST be able to view NPOs they're registered with in read-only mode
- **FR-014**: Event Coordinator users MUST be able to view and manage events they're registered with
- **FR-015**: Event Coordinator users MUST be able to view users registered with events they're assigned to in read-only mode
- **FR-016**: Staff users MUST be able to view their assigned NPO in read-only mode
- **FR-017**: Staff users MUST be able to view and manage events they're assigned to
- **FR-018**: System MUST enforce read-only access by preventing edit/delete actions on read-only resources

**NPO Context Selector**

- **FR-019**: System MUST display an NPO selector in the top left corner (replacing Teams icon)
- **FR-020**: NPO selector MUST show the currently selected NPO name
- **FR-021**: SuperAdmin users MUST be able to select any NPO or "Fundrbolt Platform" from the NPO selector
- **FR-022**: When "Fundrbolt Platform" is selected, SuperAdmin MUST see data for all NPOs
- **FR-023**: When a specific NPO is selected, users MUST see data filtered to that NPO only
- **FR-024**: NPO Admin users MUST see only their assigned NPO in the selector (non-selectable)
- **FR-025**: Event Coordinator users MUST see only NPOs they're registered with in the selector
- **FR-026**: Staff users MUST see only their assigned NPO in the selector (non-selectable)
- **FR-027**: System MUST update displayed data when NPO selection changes

**Profile Management**

- **FR-028**: System MUST provide a profile page accessible from the profile dropdown
- **FR-029**: Profile page MUST display user's first name, last name, email, phone, organization name, address_line1, address_line2, city, state, postal_code, and country
- **FR-030**: Users MUST be able to edit all profile fields except email (email changes require separate verification flow)
- **FR-031**: System MUST validate all profile field inputs before saving
- **FR-032**: System MUST display clear validation error messages for invalid inputs
- **FR-033**: System MUST display a confirmation message after successful profile update
- **FR-034**: System MUST persist profile changes to the database

**Search Functionality**

- **FR-035**: System MUST provide a working search bar accessible from all pages
- **FR-036**: Search results MUST respect role-based permissions (users only see results they're authorized to access)
- **FR-037**: Search MUST support querying NPOs, events, and users
- **FR-038**: Search MUST display "No results found" message when query returns no matches
- **FR-039**: Search results MUST be clickable and navigate to the relevant resource detail page

### Key Entities

- **User**: Represents authenticated admin PWA users with fields: first_name, last_name, email, phone, organization_name, address_line1, address_line2, city, state, postal_code, country, role (SuperAdmin, NPO Admin, Event Coordinator, Staff)
- **NPO (Nonprofit Organization)**: Represents organizations managed in the platform, has events and users associated with it
- **Event**: Represents fundraising events, belongs to an NPO, has assigned Event Coordinators and Staff
- **Role Assignment**: Links users to their NPOs and events with specific permission levels (read-only vs full access)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can log in and see their role-appropriate dashboard without seeing unauthorized data (100% role compliance verified through access control tests)
- **SC-002**: Users can access the profile dropdown from any page and navigate to their profile in 2 clicks or less
- **SC-003**: Template features (Tasks, Chats, Apps, Settings, Appearance, Help Center, theme toggle, hamburger menu) are completely removed and inaccessible
- **SC-004**: Users can update their profile information and see changes persist within 5 seconds
- **SC-005**: SuperAdmin can switch between NPO contexts and see filtered data update within 2 seconds
- **SC-006**: Search returns relevant results in under 1 second and respects role-based permissions (0 unauthorized results shown)
- **SC-007**: NPO Admins can complete their primary workflows without ever seeing data from other NPOs (0% cross-NPO data leakage)
- **SC-008**: Event Coordinators can view their assigned events and users without edit access to NPOs (100% read-only enforcement on NPO data)
- **SC-009**: Donor role users receive clear access denial with 100% prevention of admin PWA access
- **SC-010**: Users report improved clarity and ease of navigation compared to template version (target: 80% user satisfaction in post-cleanup survey)

## Assumptions

- User authentication and role assignment are already implemented and functioning correctly
- The existing user model supports all required profile fields (first_name, last_name, email, phone, organization_name, address fields)
- NPO-to-user and event-to-user relationships are already defined in the database
- The current admin PWA is built on a modern framework with component-based architecture allowing for selective feature removal
- Event Coordinators and Staff are already assigned to specific NPOs and events in the database
- The system uses a fixed theme (no dark mode toggle needed indicates a preferred default theme exists)

## Dependencies

- User authentication system must support role-based access control
- Database must have relationships established between users, NPOs, and events
- Backend API must provide endpoints for role-based data filtering
- Backend API must provide search functionality with permission filtering

## Out of Scope

- Design/styling of the new dashboards (they are explicitly placeholders)
- Email verification flow for email address changes
- Implementing new features beyond cleanup and role-based access
- Mobile-specific responsive design improvements (unless already part of template)
- Internationalization/localization of UI text
- Audit logging of user actions (though recommended for security)
- Password change functionality (unless already on profile page)
