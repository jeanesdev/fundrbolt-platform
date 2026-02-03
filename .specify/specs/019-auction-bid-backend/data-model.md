# Data Model: Auction Bid Backend

**Date**: 2026-02-02

## Entities

### AuctionBid
Represents a single immutable bid attempt (manual or auto-bid).

| Field | Type | Notes/Constraints |
|------|------|------------------|
| id | UUID | Primary identifier |
| event_id | UUID | Event scope (tenant isolation) |
| auction_item_id | UUID | Links to auction item |
| user_id | UUID | Bidder identity |
| bidder_number | Integer | Event check-in bidder number |
| bid_amount | Decimal(10,2) | Actual placed amount |
| max_bid | Decimal(10,2) or null | Only for silent auctions |
| bid_type | Enum | regular | buy_now | proxy_auto |
| bid_status | Enum | active | outbid | winning | cancelled | withdrawn |
| transaction_status | Enum | pending | processing | processed | failed | refunded |
| placed_at | Timestamp (UTC) | Time bid was placed |
| source_bid_id | UUID or null | Links to prior bid when auto-bidding or admin adjustment |
| created_by | UUID | User/admin that created this bid record |
| created_at | Timestamp (UTC) | Record creation time |

**Validation rules**:
- max_bid MUST be null for live auctions.
- max_bid (if set) MUST be >= bid_amount.
- First bid MUST be >= starting_bid.
- Subsequent bids MUST be >= current_high_bid + bid_increment.
- buy_now bids MUST equal buy_now_price.

**Indexes** (logical intent):
- (event_id, auction_item_id, placed_at)
- (event_id, user_id, placed_at)
- (event_id, bid_status)
- (event_id, transaction_status)
- (event_id, auction_type) via join on auction item

### BidActionAudit
Administrative actions applied to bids.

| Field | Type | Notes/Constraints |
|------|------|------------------|
| id | UUID | Primary identifier |
| bid_id | UUID | Target bid |
| actor_user_id | UUID | Admin/staff performing action |
| action_type | Enum | mark_winning | adjust_amount | cancel | override_payment |
| reason | String | Required explanation |
| metadata | JSON | Original/new amounts or status details |
| created_at | Timestamp (UTC) | Action timestamp |

### PaddleRaiseContribution
Donation entry for paddle raise events.

| Field | Type | Notes/Constraints |
|------|------|------------------|
| id | UUID | Primary identifier |
| event_id | UUID | Event scope |
| user_id | UUID | Donor identity |
| bidder_number | Integer | Bidder number at event |
| amount | Decimal(10,2) | Contribution amount |
| tier_name | String | Donation tier label |
| placed_at | Timestamp (UTC) | Contribution time |

### BidderAnalyticsSummary (derived)
Aggregated analytics for reporting.

| Field | Type | Notes/Constraints |
|------|------|------------------|
| event_id | UUID | Event scope |
| user_id | UUID | Bidder identity |
| total_won | Decimal(10,2) | Total winning bid amounts |
| total_lost | Decimal(10,2) | Total losing bid amounts |
| total_unprocessed | Decimal(10,2) | Winning bids not processed |
| total_max_potential | Decimal(10,2) | Sum of max bids (silent) |
| live_total | Decimal(10,2) | Total bids on live items |
| silent_total | Decimal(10,2) | Total bids on silent items |
| paddle_raise_total | Decimal(10,2) | Total paddle raise contributions |
| bidding_war_count | Integer | Count of war-involved items |

## State Transitions

### Bid Status
- active -> outbid (when surpassed by another bid)
- active -> winning (auction closed)
- active -> cancelled (admin action)
- active -> withdrawn (item removed)

### Transaction Status
- pending -> processing -> processed
- pending/processing -> failed
- processed -> refunded

## Reporting Views (logical)

- **Auction Item Bid History**: Ordered bids by item with bidder number, amount, and status.
- **Bidder History**: Ordered bids by bidder with outcomes, auction type, and proxy usage.
- **Winning Bids**: Filtered list by event, auction type, and transaction status.
- **Unprocessed Transactions**: Winning bids where payment status is pending or processing.
- **Bidder Analytics**: Totals for winning, losing, unprocessed, max-bid potential, live vs silent totals, and paddle raise totals.
- **Item Performance**: Total bids, unique bidders, final price vs starting price, revenue, and proxy bidding utilization.
- **Bidding Wars**: Items with high bid frequency and multiple bidders within a time window, with intensity score and manual vs proxy escalation indicator.
- **High-Value Donors**: Ranked bidders by total giving potential (winning bids plus paddle raise).
