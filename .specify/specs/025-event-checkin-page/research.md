# Research: Event check-in page

## Decision 1: Check-in reversal policy
- **Decision**: Allow undo (check-out) with a required reason and audit log.
- **Rationale**: Supports real-world mistakes while preserving traceability and accountability.
- **Alternatives considered**: No undo; undo only for admins.

## Decision 2: Check-in unit
- **Decision**: Check in each guest/ticket individually.
- **Rationale**: Prevents partial attendance from being miscounted and aligns with per-guest eligibility.
- **Alternatives considered**: Check in entire registration at once; support both modes.

## Decision 3: Dashboard scope
- **Decision**: Totals plus a searchable list of checked-in guests.
- **Rationale**: Combines operational overview with fast lookup for on-site needs.
- **Alternatives considered**: Totals only; real-time wallboard only.

## Decision 4: Ticket transfer verification
- **Decision**: No verification required for transfer.
- **Rationale**: Minimizes friction for on-site changes handled by authorized staff.
- **Alternatives considered**: Require admin approval; require original holder confirmation.

## Decision 5: Bidder/table uniqueness
- **Decision**: Enforce unique bidder and table numbers within the event.
- **Rationale**: Prevents conflicts in seating and bidder identification during live operations.
- **Alternatives considered**: Allow duplicates with warnings; global uniqueness across events.
