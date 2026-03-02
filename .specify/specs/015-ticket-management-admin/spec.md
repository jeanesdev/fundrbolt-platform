# Feature Specification: Ticket Package Management (Admin PWA)

**Feature Branch**: `015-ticket-management-admin`
**Created**: January 6, 2026
**Status**: Draft
**Input**: User description: "ticket-management-admin - I need to be able to set up my ticket packages in the Admin PWA as Super Admin or Event Coordinator. Each ticket gets one donor in the event. I want to be able to create different ticket packages. Each package will have a name, price, number of seats, description, and up to 4 user defined options that can have a name and value (boolean, multi select, or input). Each packages should also have a boolean for if that package includes a sponsorship. For example, the default ticket package would be Name: Individual Ticket, Number of tickets: 1, Price: $100, Description: Standard Entrance includes dinner. There might be another package called 'VIP Individual Ticket' that might have a price of $500 and have other privileges. There might be another ticket that is called 'Gold Sponsorship' for $10,000. It includes 10 tickets, with swag bags, etc. I also want to be able to mark if there are limited quantity available and enter how many are available. I also want to be able to set up promo codes for the event that will dictate either a dollar amount off the ticket price, or a percent off. I also want to be able to add custom ticket options, where the donor will have to make a selection when they purchase the ticket and that will be logged with the ticket. I want to be able to optionally upload an image for the ticket package. I want to see a list of available ticket packages on the ticket tab in the event. I want to be able to drag and sort the package options to change the order they are displayed on the purchase tickets page that I will generate in a future feature. I also want to be able to see on the ticket tab how many of each type of tickets have been sold, who they were sold to, and who they were assigned to, including a sum total of the money raised from that."

## Clarifications

### Session 2026-01-06

- Q: When a promo code is applied to a ticket package that includes multiple seats (e.g., "Gold Sponsorship" with 10 tickets), does the discount apply once to the total package price, or does it apply per seat/ticket? → A: Apply once to total package price (individual seats are not priced individually)
- Q: After the first ticket is sold, which specific fields (if any) should remain editable vs. completely locked? → A: Allow all edits but create audit trail and warn coordinator of implications. Event Coordinators should also be able to disable packages to prevent future purchases even if tickets have already been sold.
- Q: Should promo codes have usage limits (e.g., can only be used X times total, or X times per donor)? → A: Optional usage limits per code (coordinator can set max total uses and/or max uses per donor). Coordinators should also be able to define an expiration date/time when the promo code is no longer effective.
- Q: Should each custom option have a configurable "required" flag, or should all custom options always be required? → A: Each custom option has a "required" checkbox that coordinators can toggle for maximum flexibility.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create and Configure Basic Ticket Packages (Priority: P1)

As an Event Coordinator, I need to create ticket packages with essential details (name, price, quantity of seats, description) so that donors can purchase tickets to attend my fundraising event.

**Why this priority**: This is the core functionality that enables the entire ticketing system. Without the ability to create basic ticket packages, no other ticket-related features can function. This represents the minimum viable product for ticket management.

**Independent Test**: Can be fully tested by creating a ticket package with name "Individual Ticket", price $100, 1 seat, and a description, then verifying it appears in the ticket packages list. This delivers immediate value by establishing the foundation for event ticketing.

**Acceptance Scenarios**:

1. **Given** I am logged in as an Event Coordinator, **When** I navigate to the Tickets tab for my event, **Then** I see a "Create Ticket Package" button
2. **Given** I click "Create Ticket Package", **When** I enter required fields (name, price, number of seats, description), **Then** the package is created and appears in my ticket packages list
3. **Given** I have created a ticket package, **When** I view the tickets list, **Then** I see the package name, price, number of seats, and 0 tickets sold
4. **Given** I create a ticket package with a negative price, **When** I attempt to save, **Then** I see a validation error indicating price must be positive
5. **Given** I create a ticket package with 0 or negative seats, **When** I attempt to save, **Then** I see a validation error indicating seats must be at least 1

---

### User Story 2 - Edit and Delete Ticket Packages (Priority: P1)

As an Event Coordinator, I need to edit or delete ticket packages before sales begin so that I can correct mistakes or adjust offerings based on changing event requirements.

**Why this priority**: Editing capabilities are essential for real-world event planning where details often change. Without this, coordinators would need to delete and recreate packages for minor corrections, creating a poor user experience.

**Independent Test**: Can be fully tested by creating a ticket package, editing its details, verifying the changes persist, then deleting it and confirming it's removed from the list. This delivers value by enabling flexible event planning.

**Acceptance Scenarios**:

1. **Given** I have created a ticket package, **When** I click "Edit" on the package, **Then** I see a form with current package details pre-filled
2. **Given** I am editing a package, **When** I change the price and description, **Then** the changes are saved and reflected in the ticket packages list
3. **Given** I edit a package that has tickets already sold, **When** I change critical fields (price, seats, name), **Then** I see a warning about implications and the change is logged in an audit trail
4. **Given** I am viewing a ticket package with 0 tickets sold, **When** I click "Delete", **Then** I see a confirmation dialog
5. **Given** I confirm deletion of a package with 0 tickets sold, **When** the deletion completes, **Then** the package is removed from the list
6. **Given** I attempt to delete a package with tickets already sold, **When** I click "Delete", **Then** I see an error message preventing deletion and explaining why
7. **Given** I have a ticket package (with or without tickets sold), **When** I disable the package, **Then** it no longer appears as purchasable to donors but remains visible in admin view with "Disabled" indicator
8. **Given** I have a disabled ticket package, **When** I re-enable it, **Then** it becomes available for purchase again

---

### User Story 3 - Configure Limited Quantity and Availability (Priority: P2)

As an Event Coordinator, I need to set quantity limits on ticket packages so that I can control capacity, create scarcity for premium offerings, and prevent overselling.

**Why this priority**: Quantity management is critical for managing event capacity and creating urgency for premium packages. While not required for basic ticketing, it's essential for realistic fundraising scenarios.

**Independent Test**: Can be fully tested by creating a ticket package with a quantity limit of 10, simulating 8 sales, and verifying the remaining count shows 2 available. This delivers value by enabling capacity management.

**Acceptance Scenarios**:

1. **Given** I am creating a ticket package, **When** I enable "Limited Quantity", **Then** I see a field to enter the maximum quantity available
2. **Given** I set a quantity limit of 50, **When** I save the package, **Then** the ticket list shows "0/50 sold" for that package
3. **Given** a package has a quantity limit of 100 and 75 tickets sold, **When** I view the package, **Then** I see "75/100 sold" with a visual indicator showing 75% capacity
4. **Given** a package has reached its quantity limit, **When** a donor attempts to purchase, **Then** they see a "Sold Out" indicator
5. **Given** I disable "Limited Quantity" on an existing package, **When** I save, **Then** the package shows as unlimited availability

---

### User Story 4 - Add Custom Ticket Options (Priority: P2)

As an Event Coordinator, I need to add up to 4 custom options to each ticket package (with name, type, and choices) so that I can collect additional information or offer personalized selections during ticket purchase.

**Why this priority**: Custom options enable personalization and data collection beyond basic ticket sales. While not required for minimal functionality, this significantly enhances the flexibility and value of the ticketing system.

**Independent Test**: Can be fully tested by creating a ticket package with 2 custom options (one boolean "Dietary Restriction?", one multi-select "T-Shirt Size"), purchasing a ticket with selections, and verifying the choices are stored. This delivers value by enabling customized ticket experiences.

**Acceptance Scenarios**:

1. **Given** I am creating/editing a ticket package, **When** I click "Add Custom Option", **Then** I see fields for option name, option type (Boolean, Multi-Select, or Text Input), and a "Required" checkbox
2. **Given** I select "Multi-Select" as option type, **When** I configure the option, **Then** I can enter multiple choice values (e.g., "Small, Medium, Large, XL")
3. **Given** I have added 4 custom options, **When** I try to add another, **Then** I see a message indicating the maximum of 4 options has been reached
4. **Given** I configure a required custom option, **When** a donor purchases a ticket and leaves it blank, **Then** they see a validation error and cannot proceed
5. **Given** I configure an optional custom option, **When** a donor purchases a ticket and leaves it blank, **Then** the purchase proceeds successfully with no response recorded for that option
6. **Given** I configure a custom option with type "Boolean", **When** a donor purchases a ticket, **Then** they see a checkbox for that option (unchecked by default for optional, must check for required)
7. **Given** I configure a custom option with type "Text Input", **When** a donor purchases a ticket, **Then** they see a text field to enter their response
8. **Given** I delete a custom option that was selected on sold tickets, **When** I save the package, **Then** I see a warning that existing responses will be retained but future purchases won't include this option

---

### User Story 5 - Configure Sponsorship Indicator (Priority: P3)

As an Event Coordinator, I need to mark ticket packages as including sponsorship so that I can track which donors are also sponsors and recognize their higher contribution level.

**Why this priority**: The sponsorship flag provides important categorization for donor recognition and reporting. While valuable, this can be managed through package naming conventions initially, making it lower priority than core ticketing features.

**Independent Test**: Can be fully tested by creating two packages (one marked as sponsorship, one not), verifying the sponsorship indicator appears in the admin view, and confirming sponsorship status appears in reporting. This delivers value by enabling sponsor tracking.

**Acceptance Scenarios**:

1. **Given** I am creating/editing a ticket package, **When** I see the "Includes Sponsorship" checkbox, **Then** I can toggle it on or off
2. **Given** I mark a package as "Includes Sponsorship", **When** I save, **Then** the package displays a sponsorship badge in the tickets list
3. **Given** I view tickets sold for a sponsorship package, **When** I review sales data, **Then** I see a visual indicator that these buyers are also sponsors
4. **Given** I generate a revenue report, **When** viewing totals, **Then** I can filter to see revenue from sponsorship packages separately

---

### User Story 6 - Upload Ticket Package Images (Priority: P3)

As an Event Coordinator, I need to optionally upload images for ticket packages so that I can make the ticket selection page more visually appealing and help donors understand package benefits.

**Why this priority**: Images enhance the user experience but are not essential for functionality. The ticketing system works perfectly well with text descriptions alone, making this a nice-to-have enhancement.

**Independent Test**: Can be fully tested by uploading a JPG image to a ticket package, verifying it displays in the ticket list and (future) purchase page, then removing the image and confirming the package still functions without it. This delivers value by improving visual presentation.

**Acceptance Scenarios**:

1. **Given** I am creating/editing a ticket package, **When** I see the "Package Image" section, **Then** I can click to upload an image
2. **Given** I select an image file, **When** I upload, **Then** the image is validated for format (JPG, PNG, WebP) and size (max 5MB)
3. **Given** I have uploaded an image, **When** I view the ticket package, **Then** I see a thumbnail preview of the image
4. **Given** I have uploaded an image, **When** I click "Remove Image", **Then** the image is deleted and the package continues to function normally
5. **Given** I upload an image that exceeds size limits, **When** validation occurs, **Then** I see an error message with the maximum allowed size

---

### User Story 7 - Create and Manage Promo Codes (Priority: P2)

As an Event Coordinator, I need to create promo codes that offer dollar amount or percentage discounts on tickets so that I can incentivize early purchases, reward special groups, or run promotional campaigns.

**Why this priority**: Promo codes are a common expectation for modern ticketing systems and provide significant fundraising and marketing value. While not strictly required for basic sales, they're important enough to prioritize relatively high.

**Independent Test**: Can be fully tested by creating a promo code "EARLY25" for 25% off, applying it during a simulated ticket purchase, and verifying the discount is calculated correctly. This delivers value by enabling promotional campaigns.

**Acceptance Scenarios**:

1. **Given** I navigate to the Tickets tab, **When** I click "Manage Promo Codes", **Then** I see a list of existing promo codes and a "Create Promo Code" button
2. **Given** I click "Create Promo Code", **When** I enter code name, discount type (Dollar Amount or Percentage), and discount value, **Then** the promo code is created
3. **Given** I create a promo code, **When** I set an expiration date and time, **Then** the code automatically becomes invalid after that date/time
4. **Given** I create a promo code, **When** I set a maximum total usage limit of 50, **Then** the code can only be used 50 times across all donors
5. **Given** I create a promo code, **When** I set a maximum usage per donor limit of 2, **Then** each donor can only use the code a maximum of 2 times
6. **Given** a promo code reaches its total usage limit, **When** a donor tries to apply it, **Then** they see an error message indicating the code has reached its usage limit
7. **Given** I create a promo code with percentage discount, **When** I set it to 25%, **Then** ticket prices are reduced by 25% when the code is applied
8. **Given** I create a promo code with dollar amount discount, **When** I set it to $50, **Then** ticket prices are reduced by $50 when the code is applied (minimum final price $0)
9. **Given** I view promo codes, **When** a code has been used, **Then** I see usage statistics (times used, total discount given, remaining uses if limit set)
10. **Given** I deactivate a promo code, **When** a donor tries to use it, **Then** they see an error message indicating the code is no longer valid

---

### User Story 8 - Reorder Ticket Packages (Priority: P3)

As an Event Coordinator, I need to drag and drop ticket packages to reorder them so that I can control which packages appear first on the donor-facing ticket purchase page.

**Why this priority**: Display order is a presentation enhancement that affects user experience but doesn't impact core functionality. Packages can be listed in any order and still function correctly, though strategic ordering can influence purchase behavior.

**Independent Test**: Can be fully tested by creating 3 ticket packages, dragging the third package to the first position, and verifying the new order persists and will be reflected on the purchase page. This delivers value by enabling strategic presentation.

**Acceptance Scenarios**:

1. **Given** I have multiple ticket packages, **When** I view the tickets list, **Then** I see a drag handle icon on each package card
2. **Given** I click and drag a ticket package, **When** I drop it in a new position, **Then** the packages reorder immediately
3. **Given** I have reordered packages, **When** I refresh the page, **Then** the new order persists
4. **Given** I reorder packages, **When** I note the display order, **Then** I understand this order will be used on the donor-facing ticket purchase page

---

### User Story 9 - View Ticket Sales and Revenue Data (Priority: P1)

As an Event Coordinator, I need to view comprehensive sales data for each ticket package (quantity sold, purchasers, assigned guests, revenue) so that I can track event capacity, revenue progress, and understand who is attending.

**Why this priority**: Sales visibility is critical for event management and decision-making. Without this reporting, coordinators would have no way to track progress toward goals or manage event logistics. This is essential functionality alongside package creation.

**Independent Test**: Can be fully tested by creating a ticket package, simulating 3 ticket purchases by different donors, and verifying the display shows "3 sold", lists the 3 purchasers with assigned guests, and displays the correct revenue total. This delivers value by providing essential oversight.

**Acceptance Scenarios**:

1. **Given** I view the Tickets tab, **When** I look at each package, **Then** I see the number of tickets sold (e.g., "12 sold")
2. **Given** I click on a ticket package's sales details, **When** the expanded view opens, **Then** I see a list of all purchasers with their names and purchase dates
3. **Given** I view sales details, **When** tickets have been assigned to specific guests, **Then** I see both the purchaser and the assigned guest names
4. **Given** I view the Tickets tab, **When** I look at the summary section, **Then** I see a total revenue amount from all ticket sales
5. **Given** I view sales details for a package, **When** promo codes were used, **Then** I see the discounted amount and which code was applied
6. **Given** I filter sales data, **When** I select "Show Sponsorships Only", **Then** I see only tickets from packages marked as sponsorships
7. **Given** I view ticket sales, **When** I export the data, **Then** I receive a CSV file with all purchaser, guest, and revenue details

---

### Edge Cases

- What happens when an Event Coordinator tries to delete a ticket package that has already been purchased? (System prevents deletion and shows error message explaining tickets have been sold)
- How does the system handle promo codes that reduce ticket price to $0 or negative amounts? (Price floor of $0 is enforced - tickets cannot go below free)
- What happens if a donor leaves a custom option blank during purchase? (Required options trigger validation error and prevent purchase; optional options allow purchase with null response recorded)
- How does the system handle reaching the quantity limit when multiple donors try to purchase the last available ticket simultaneously? (First-come-first-served with optimistic locking - first completed purchase wins, others see "sold out" error)
- What happens when an Event Coordinator reduces the quantity limit below the number of tickets already sold? (System prevents this change and shows validation error)
- How are images stored and what happens if an uploaded image contains inappropriate content? (Images stored in Azure Blob Storage with virus scanning; manual review required for inappropriate content)
- What happens when a promo code is applied to a ticket package and then the package price changes? (Promo code discount recalculates based on new price - percentage codes adapt automatically, fixed dollar codes apply same amount)
- How does the system handle very long ticket package names or descriptions? (Character limits enforced: names max 100 characters, descriptions max 1000 characters)
- What happens when multiple donors try to use a promo code with usage limits simultaneously and reach the limit? (First-come-first-served with optimistic locking - first completed purchases within limit succeed, others receive error)
- What happens when a promo code expires while a donor is in the middle of purchasing? (Expiration check happens at final purchase submission - if expired at that moment, transaction fails with clear error message)

## Requirements *(mandatory)*

### Functional Requirements

#### Ticket Package Management

- **FR-001**: System MUST allow Super Admins and Event Coordinators to create ticket packages for their events
- **FR-002**: System MUST allow Event Coordinators to edit all fields of ticket packages regardless of tickets sold, with warnings displayed when editing packages with existing sales
- **FR-003**: System MUST create audit log entries for all edits to ticket packages that have tickets sold, recording the coordinator, timestamp, field changed, old value, and new value
- **FR-004**: System MUST prevent deletion of ticket packages that have tickets sold
- **FR-005**: System MUST allow deletion of ticket packages with 0 tickets sold after confirmation
- **FR-006**: System MUST restrict ticket package management to the event's assigned coordinators and Super Admins
- **FR-007**: System MUST allow Event Coordinators to disable/enable ticket packages at any time (disabled packages cannot be purchased but remain visible in admin view)
- **FR-008**: System MUST display a "Disabled" indicator on disabled packages in the admin tickets list

#### Ticket Package Attributes

- **FR-009**: Each ticket package MUST have a name (required, max 100 characters)
- **FR-010**: Each ticket package MUST have a price in USD (required, minimum $0.00, max $1,000,000.00)
- **FR-011**: Each ticket package MUST have a number of seats/tickets included (required, minimum 1, max 100)
- **FR-012**: Each ticket package MUST have a description (required, max 1000 characters)
- **FR-013**: Each ticket package MUST have a sponsorship indicator boolean (default: false)
- **FR-014**: Each ticket package MUST have an enabled/disabled status boolean (default: enabled)
- **FR-015**: Each ticket package MAY have an optional image (image_url NULLABLE, validated on upload if provided; formats: JPG, PNG, WebP; max size: 5MB)
- **FR-016**: Each ticket package MUST track its display order for sorting purposes (integer, default: append to end)

#### Quantity Limits

- **FR-017**: System MUST allow Event Coordinators to optionally enable quantity limits on ticket packages
- **FR-018**: When quantity limit is enabled, Event Coordinators MUST specify maximum available quantity (minimum 1, max 10,000)
- **FR-019**: System MUST display available quantity as "X/Y sold" where X is tickets sold and Y is limit
- **FR-020**: System MUST prevent ticket purchases when quantity limit is reached
- **FR-021**: System MUST prevent reducing quantity limit below current number of tickets sold
- **FR-022**: System MUST show "Sold Out" indicator on ticket packages at maximum capacity
- **FR-023**: System MUST prevent ticket purchases on disabled packages

#### Custom Ticket Options

- **FR-024**: Each ticket package MAY have up to 4 custom options
- **FR-025**: Each custom option MUST have a name (required, max 100 characters)
- **FR-026**: Each custom option MUST have a type: Boolean, Multi-Select, or Text Input
- **FR-027**: Each custom option MUST have a "required" flag that coordinators can toggle (default: required)
- **FR-028**: Multi-Select custom options MUST allow defining 2-10 choice values (each max 50 characters)
- **FR-029**: Text Input custom options MUST allow donor responses up to 500 characters
- **FR-030**: Boolean custom options MUST present as checkboxes to donors during purchase
- **FR-031**: System MUST enforce validation on required custom options during ticket purchase (donors must provide a response)
- **FR-032**: System MUST allow donors to skip optional custom options during ticket purchase (no response recorded)
- **FR-033**: Custom option responses MUST be stored with each ticket purchase (null/empty for skipped optional options)
- **FR-034**: System MUST prevent deletion of custom options on packages with sold tickets (can be deactivated for future purchases)

#### Promo Codes

- **FR-035**: System MUST allow Event Coordinators to create promo codes for their events
- **FR-036**: Each promo code MUST have a unique code string (required, 4-20 alphanumeric characters, case-insensitive)
- **FR-037**: Each promo code MUST have a discount type: Dollar Amount or Percentage
- **FR-038**: Dollar Amount promo codes MUST specify discount value (min $1, max $10,000)
- **FR-039**: Percentage promo codes MUST specify discount percentage (min 1%, max 100%)
- **FR-040**: Promo codes MAY have an optional expiration date and time (after which they become invalid)
- **FR-041**: Promo codes MAY have an optional maximum total usage limit (1-10,000 uses across all donors)
- **FR-042**: Promo codes MAY have an optional maximum usage per donor limit (1-100 uses per individual donor)
- **FR-043**: System MUST prevent promo code application when total usage limit is reached
- **FR-044**: System MUST prevent promo code application when donor has reached their individual usage limit for that code
- **FR-045**: System MUST apply promo code discounts once to the total ticket package price (not per individual seat) and prevent final price from going below $0
- **FR-046**: System MUST track promo code usage statistics (times used, remaining uses if limit set, total discount amount given)
- **FR-047**: Event Coordinators MUST be able to activate/deactivate promo codes at any time
- **FR-048**: System MUST prevent application of invalid, expired, deactivated, or usage-limit-reached promo codes with appropriate error messages

#### Display and Ordering

- **FR-049**: System MUST display ticket packages in a list view on the Tickets tab
- **FR-050**: Event Coordinators MUST be able to drag and drop ticket packages to reorder them
- **FR-051**: System MUST persist display order and use it for the donor-facing ticket purchase page
- **FR-052**: Each ticket package card MUST display: name, price, seats included, quantity sold (if limited), sponsorship indicator (if applicable), and disabled status (if applicable)

#### Sales Tracking and Reporting

- **FR-053**: System MUST display the number of tickets sold for each package
- **FR-054**: System MUST allow Event Coordinators to view detailed sales data: purchaser names, purchase dates, assigned guests, promo codes used
- **FR-055**: System MUST calculate and display total revenue from ticket sales (sum across all packages)
- **FR-056**: System MUST show discounted prices when promo codes were applied
- **FR-057**: System MUST allow filtering sales data by sponsorship packages
- **FR-058**: System MUST allow exporting sales data to CSV format with all purchaser, guest, and revenue details
- **FR-059**: System MUST update sales counts in real-time as tickets are purchased

#### Image Management

- **FR-060**: System MUST validate uploaded images for format (JPG, PNG, WebP only)
- **FR-061**: System MUST validate uploaded images for size (max 5MB)
- **FR-062**: System MUST store ticket package images in Azure Blob Storage
- **FR-063**: System MUST display image thumbnails in the ticket packages list
- **FR-064**: System MUST allow removing/replacing ticket package images at any time
- **FR-065**: System MUST perform virus scanning on uploaded images before storage

#### Audit Trail

- **FR-066**: System MUST log all changes to ticket packages with existing sales including: coordinator name, timestamp, field name, old value, new value
- **FR-067**: System MUST allow Event Coordinators to view audit trail for any ticket package
- **FR-068**: System MUST retain audit logs for minimum 7 years for compliance purposes

### Key Entities

- **Ticket Package**: Represents a purchasable ticket offering for an event
  - Attributes: name, price, number of seats, description, sponsorship indicator, enabled status (default: enabled), image URL, quantity limit (optional), quantity sold, display order
  - Relationships: belongs to one Event, has many Custom Options, has many Ticket Purchases, has many Audit Log Entries

- **Custom Ticket Option**: Represents a user-defined option that donors select during purchase
  - Attributes: name, option type (Boolean/Multi-Select/Text Input), required flag (default: required), choice values (for Multi-Select), display order
  - Relationships: belongs to one Ticket Package, has many Option Responses

- **Option Response**: Represents a donor's selection/input for a custom option
  - Attributes: response value (boolean, selected choice, text input, or null for skipped optional options)
  - Relationships: belongs to one Custom Ticket Option, belongs to one Ticket Purchase

- **Promo Code**: Represents a discount code for an event
  - Attributes: code string, discount type (Dollar Amount/Percentage), discount value, expiration date/time (optional), max total usage limit (optional), max usage per donor limit (optional), active status, current usage count, total discount given
  - Relationships: belongs to one Event, has many Promo Code Applications

- **Promo Code Application**: Represents use of a promo code on a ticket purchase
  - Attributes: discount amount applied
  - Relationships: belongs to one Promo Code, belongs to one Ticket Purchase

- **Ticket Purchase**: Represents a completed ticket purchase transaction
  - Attributes: purchaser information, purchase date, total price paid, discount applied
  - Relationships: belongs to one Ticket Package, belongs to one Event, belongs to one Purchaser (Donor), has many Option Responses, may have one Promo Code Application, has many Assigned Tickets

- **Assigned Ticket**: Represents an individual ticket seat assigned to a specific guest
  - Attributes: guest name, guest email (optional)
  - Relationships: belongs to one Ticket Purchase

- **Audit Log Entry**: Represents a recorded change to a ticket package with existing sales
  - Attributes: coordinator name, timestamp, field name, old value, new value
  - Relationships: belongs to one Ticket Package, created by one Event Coordinator

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Event Coordinators can create a complete ticket package (with all required fields) in under 2 minutes
- **SC-002**: Event Coordinators can reorder ticket packages via drag-and-drop in under 30 seconds
- **SC-003**: 90% of Event Coordinators successfully create their first ticket package without requiring support documentation
- **SC-004**: System displays real-time ticket sales updates within 3 seconds of purchase completion
- **SC-005**: Ticket package creation form validates all inputs and displays clear error messages for any validation failures within 1 second
- **SC-006**: Event Coordinators can view comprehensive sales data (purchasers, guests, revenue) for any ticket package in under 5 seconds
- **SC-007**: Promo code discount calculations are accurate to the cent 100% of the time
- **SC-008**: System prevents overselling ticket packages with quantity limits 100% of the time (no race conditions)
- **SC-009**: Image uploads complete successfully and display thumbnails within 10 seconds for files up to 5MB
- **SC-010**: CSV export of ticket sales data completes within 15 seconds for events with up to 1,000 ticket purchases
- **SC-011**: System handles 100 concurrent Event Coordinators creating/editing ticket packages without performance degradation
- **SC-012**: Event Coordinators can create up to 50 different ticket packages per event without system limitations

## Assumptions

- Event Coordinators have already created events in the system before creating ticket packages
- The donor-facing ticket purchase interface will be implemented in a separate future feature
- Payment processing and transaction handling are out of scope for this feature
- One ticket in a package equals one donor/attendee at the event
- Currency is USD for all pricing (internationalization will be handled separately)
- Custom options can be marked as required or optional by coordinators (default: required)
- Promo codes apply once to the total package price (individual seats within multi-seat packages are not priced separately)
- Email notifications for ticket purchases are handled separately
- Event Coordinators have permission to manage tickets for their assigned events (authorization already implemented)
- Image content moderation is handled through manual review processes, not automated detection
- All ticket package fields remain editable after sales begin, with warnings and audit trail for accountability
- Sales data is available immediately after purchase (no batch processing delay)
- System uses optimistic locking to prevent race conditions when tickets sell out
- CSV export includes all ticket purchase data without pagination limits (assumes reasonable event sizes)

## Dependencies

- Existing Event Management feature (events must exist before ticket packages can be created)
- Existing User Authentication and Authorization system (role-based access for Super Admin and Event Coordinator)
- Azure Blob Storage integration for image uploads
- Database schema for storing ticket packages, custom options, promo codes, and sales data
- Real-time or near-real-time data synchronization for sales count updates

## Out of Scope

- Donor-facing ticket purchase interface (separate future feature)
- Payment processing and gateway integration
- Email confirmations and ticket delivery
- Check-in functionality for purchased tickets
- Refund processing and cancellation workflows
- Waitlist management for sold-out packages
- Automated content moderation for uploaded images
- Multi-currency support
- Integration with external ticketing platforms
- Ticket transfer between donors
- Group discount logic beyond promo codes
- Donation add-ons during ticket purchase
- Seating assignment integration (handled in existing seating feature)
