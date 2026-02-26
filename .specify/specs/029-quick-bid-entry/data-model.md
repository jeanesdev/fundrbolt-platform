# Data Model: Quick Bid Entry

## 1) QuickEntrySessionContext (derived)
Represents current page state for a single event and mode.

### Fields
- `event_id` (UUID, required)
- `mode` (enum: `LIVE_AUCTION`, `PADDLE_RAISE`, required)
- `selected_live_item_id` (UUID, required in `LIVE_AUCTION`, absent in `PADDLE_RAISE`)
- `operator_user_id` (UUID, required)

### Validation Rules
- `selected_live_item_id` MUST be present for live auction bid submission.
- Operator user MUST have one of allowed roles: Super Admin, NPO Admin, NPO Staff.

---

## 2) QuickEntryBid
Represents one live auction bid entered from quick-entry workflow.

### Fields
- `id` (UUID)
- `event_id` (UUID, required)
- `live_auction_item_id` (UUID, required)
- `amount` (integer dollars, required, > 0)
- `bidder_number` (integer, required)
- `donor_id` (UUID, required if bidder resolves)
- `donor_name_snapshot` (string, optional display snapshot)
- `table_number_snapshot` (string/integer, optional)
- `status` (enum: `ACTIVE`, `DELETED`, `WINNING`)
- `accepted_at` (timestamp, required)
- `entered_by_user_id` (UUID, required)
- `deleted_at` (timestamp, nullable)
- `deleted_by_user_id` (UUID, nullable)

### Validation Rules
- Unmatched `bidder_number` MUST reject creation.
- `amount` must be whole dollars and positive.
- Equal amount ranking uses `accepted_at` ascending (first-in wins).

### State Transitions
- `ACTIVE -> DELETED` when staff deletes bid.
- `ACTIVE -> WINNING` only through winner assignment action on highest valid bid.
- Only one `WINNING` bid per `live_auction_item_id`.

---

## 3) QuickEntryDonation
Represents one paddle raise donation entered from quick-entry workflow.

### Fields
- `id` (UUID)
- `event_id` (UUID, required)
- `amount` (integer dollars, required, > 0)
- `bidder_number` (integer, required)
- `donor_id` (UUID, required if bidder resolves)
- `entered_at` (timestamp, required)
- `entered_by_user_id` (UUID, required)

### Validation Rules
- Unmatched `bidder_number` MUST reject creation.
- `amount` must be whole dollars and positive.

---

## 4) QuickEntryDonationLabelLink
Associates donations with zero or more labels selected at submission.

### Fields
- `donation_id` (UUID, required)
- `label_id` (UUID, optional when custom-only)
- `custom_label_text` (string, optional)

### Validation Rules
- Labels are optional; zero associations are valid.
- `custom_label_text` if present must be non-whitespace and within configured max length.

---

## 5) BidderDonorLookup (existing domain entity)
Lookup projection from bidder number to donor and table context.

### Fields
- `event_id` (UUID)
- `bidder_number` (integer, unique within event)
- `donor_id` (UUID)
- `donor_display_name` (string)
- `table_number` (string/integer, optional)

### Validation Rules
- `event_id + bidder_number` unique.

---

## 6) QuickEntryMetricsSnapshot (read model)
Computed summary values shown prominently for operator feedback.

### Live Auction fields
- `current_highest_bid_amount`
- `bid_count`
- `unique_bidder_count`
- `last_bid_at`

### Paddle Raise fields
- `total_pledged_amount`
- `donation_count`
- `unique_donor_count`
- `participation_percent`
- `count_by_amount_level` (map `amount -> count`)

### Consistency Rules
- Recomputed/updated after each create or delete action.
- Visible UI values should reflect updates within 1 second for 95% of actions (SC-005).

---

## Relationships
- One `LiveAuctionItem` has many `QuickEntryBid`.
- One `QuickEntryBid` resolves to one donor via `BidderDonorLookup`.
- One `QuickEntryDonation` resolves to one donor via `BidderDonorLookup`.
- One `QuickEntryDonation` has zero-to-many `QuickEntryDonationLabelLink`.
- One event has one logical `QuickEntrySessionContext` per active operator session.
