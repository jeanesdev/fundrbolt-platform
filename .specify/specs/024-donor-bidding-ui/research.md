# Phase 0 Research: Donor Bidding UI

## Decision 1: Bid confirmation interaction
- **Decision**: Require a final slide gesture to confirm bids and max bids.
- **Rationale**: Reduces accidental submissions while preserving donor flow clarity.
- **Alternatives considered**: Tap-to-confirm button; no confirmation.

## Decision 2: Max bid availability in UI
- **Decision**: Hide “Set as Max Bid” when max bids are not allowed for the event/item.
- **Rationale**: Avoids presenting unavailable actions and reduces confusion.
- **Alternatives considered**: Always show and disable; remove max-bid capability entirely.

## Decision 3: Buy-now visibility when unavailable
- **Decision**: Show Buy Now disabled with an explanation when unavailable or quantity is zero; allow admins to add quantity later.
- **Rationale**: Preserves awareness of buy-now option and supports dynamic inventory updates.
- **Alternatives considered**: Hide Buy Now entirely when unavailable; only show in item details.

## Decision 4: Admin visibility of engagement data
- **Decision**: Admins can see identifiable watcher/viewer and bidder details, limited to the event’s admin staff.
- **Rationale**: Supports operational oversight and follow-up while keeping access scope constrained.
- **Alternatives considered**: Aggregated-only stats; identifiable bidders only.
