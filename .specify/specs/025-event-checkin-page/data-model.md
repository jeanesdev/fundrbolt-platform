# Data Model: Event check-in page

## Entities

### Event
- **Purpose**: Event context for check-in and reporting.
- **Key fields**: id, tenant_id, name, starts_at, ends_at
- **Relationships**: Has many guest registrations and dinner selections.

### Donor
- **Purpose**: Person attending or owning tickets.
- **Key fields**: id, full_name, email, phone, address (contact info)
- **Relationships**: Has many guest registrations.

### Guest Registration
- **Purpose**: Links donor/guest to an event and ticket.
- **Key fields**: id, event_id, donor_id, ticket_id, status, bidder_number, table_number, dinner_selection_id, current_check_in_status, last_checked_in_at, last_checked_out_at
- **Relationships**: Belongs to Event and Donor; references Dinner Selection.
- **State transitions**: not_checked_in → checked_in → checked_out → checked_in (repeatable).

### Check-in Record
- **Purpose**: Immutable audit log of check-in actions.
- **Key fields**: id, event_id, registration_id, action (check_in/check_out), acted_by_user_id, acted_at, reason (required for check_out)
- **Relationships**: Belongs to Event and Guest Registration.

### Dinner Selection
- **Purpose**: Meal choices available for an event.
- **Key fields**: id, event_id, name, is_active
- **Relationships**: Belongs to Event; referenced by Guest Registration.

### Ticket Transfer Record
- **Purpose**: Audit log of ticket ownership changes.
- **Key fields**: id, event_id, registration_id, from_donor_id, to_donor_id, transferred_by_user_id, transferred_at, note
- **Relationships**: Belongs to Event and Guest Registration.

## Validation Rules
- Bidder and table numbers must be unique within the event.
- A guest registration can only have one active check-in status at a time.
- Check-out requires a reason and must create a Check-in Record.
- Ticket transfer must update ownership and create a Ticket Transfer Record.

## Notes
- All audit records are append-only.
