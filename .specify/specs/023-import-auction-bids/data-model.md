# Data Model: Import Auction Bids

## Entities

### AuctionBid
- **Purpose**: A bid placed by a donor on an auction item for an event.
- **Key Fields**:
  - id
  - event_id
  - donor_id
  - auction_item_id
  - bid_amount
  - bid_time
  - source (import/manual)
  - created_at
- **Validation Rules**:
  - bid_amount must be greater than current highest bid + minimum bid increment for the item.
  - bid_time must be a valid date-time value (future times allowed).
- **Relationships**:
  - Many-to-one with Event
  - Many-to-one with Donor
  - Many-to-one with AuctionItem

### Donor
- **Purpose**: A person or organization placing bids.
- **Key Fields**:
  - id
  - email (import identifier)
  - first_name
  - last_name
- **Relationships**:
  - One-to-many with AuctionBid

### AuctionItem
- **Purpose**: An item available for bidding in an event.
- **Key Fields**:
  - id
  - event_id
  - item_code (import identifier)
  - title
  - minimum_bid_increment
- **Relationships**:
  - One-to-many with AuctionBid

### ImportBatch
- **Purpose**: Tracks a single import attempt and its outcomes.
- **Key Fields**:
  - id
  - event_id
  - created_by_user_id
  - status (preflighted/confirmed/failed)
  - total_rows
  - valid_rows
  - invalid_rows
  - file_name
  - file_type
  - created_at
- **Relationships**:
  - One-to-many with BidValidationResult

### BidValidationResult
- **Purpose**: Per-row validation output for preflight.
- **Key Fields**:
  - id
  - import_batch_id
  - row_number
  - status (valid/invalid)
  - error_codes (list)
  - error_message
  - raw_row_data
- **Relationships**:
  - Many-to-one with ImportBatch

## State Transitions

### ImportBatch
- created → preflighted
- preflighted → confirmed
- preflighted → failed (if confirmation fails)

## Derived/Computed
- Dashboard totals: total bid count, total bid value, highest bids per item, recent bids.
