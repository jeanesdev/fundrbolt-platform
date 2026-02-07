# Data Model: Donor Bidding UI

## AuctionItem
- **Purpose**: Silent auction listing with bidding and buy-now state.
- **Key Fields**:
  - `id` (unique)
  - `event_id`
  - `title`, `description`
  - `current_bid_amount`
  - `min_next_bid_amount`
  - `bid_count`
  - `bidding_open` (boolean)
  - `images[]`
  - `watcher_count`
  - `buy_now_enabled` (boolean)
  - `buy_now_remaining_quantity`
  - `promotion_badge` (optional label)
  - `promotion_notice` (optional message)
- **Relationships**:
  - One-to-many with `Bid`
  - One-to-many with `WatchListEntry`
  - One-to-many with `ItemView`

## Bid
- **Purpose**: A donor’s bid or max-bid intent.
- **Key Fields**:
  - `id` (unique)
  - `item_id`
  - `event_id`
  - `bidder_user_id`
  - `amount`
  - `is_max_bid` (boolean)
  - `created_at`
- **Relationships**:
  - Many-to-one with `AuctionItem`

## WatchListEntry
- **Purpose**: A donor’s watched item association.
- **Key Fields**:
  - `id` (unique)
  - `item_id`
  - `event_id`
  - `user_id`
  - `created_at`
- **Constraints**:
  - One watch entry per user per item

## ItemView
- **Purpose**: Engagement record of viewing duration per donor and item.
- **Key Fields**:
  - `id` (unique)
  - `item_id`
  - `event_id`
  - `user_id`
  - `view_started_at`
  - `view_duration_seconds`

## ItemPromotion
- **Purpose**: Admin-defined badge and notification text shown to donors.
- **Key Fields**:
  - `id` (unique)
  - `item_id`
  - `event_id`
  - `badge_label`
  - `notice_message`
  - `updated_by_user_id`
  - `updated_at`

## BuyNowAvailability
- **Purpose**: Buy-now state for an item including admin overrides.
- **Key Fields**:
  - `item_id`
  - `event_id`
  - `enabled` (boolean)
  - `remaining_quantity`
  - `override_reason` (optional)
  - `updated_by_user_id`
  - `updated_at`

## Validation Rules
- Minimum bid must be >= `min_next_bid_amount`.
- Bidding is rejected when `bidding_open` is false.
- Buy-now is rejected when disabled or `remaining_quantity` is 0.
- Watch list is only available to signed-in donors.

## State Transitions
- `bidding_open`: true → false when auction closes; false → true when opened by admin.
- `buy_now_remaining_quantity`: decreases on successful buy-now; can increase via admin override.
