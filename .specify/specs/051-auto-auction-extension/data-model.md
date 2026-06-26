# Data Model: Silent Auction Anti-Sniping Auto-Extension

## Entity: SilentAuctionExtensionPolicy

Represents event-level anti-sniping configuration.

Fields:
- id (UUID)
- event_id (UUID, unique)
- auto_extension_enabled (boolean, default true)
- trigger_window_minutes (integer, default 3)
- extension_duration_minutes (integer, default 3, valid 1-10)
- max_total_extension_minutes (integer, default 30, valid 0-60)
- created_at (datetime)
- updated_at (datetime)
- updated_by_user_id (UUID, nullable)

Validation rules:
- extension_duration_minutes must be between 1 and 10 inclusive.
- max_total_extension_minutes must be between 0 and 60 inclusive.
- trigger_window_minutes must be positive and defaults to 3 for this feature.

Relationships:
- One-to-one with Event (`event_id`).

Lifecycle:
- Created at event initialization or lazily on first evaluation for legacy events.
- Updated by authorized admin from event silent auction settings.

## Entity: SilentAuctionItemTiming

Represents mutable timing state for silent auction extension logic.

Fields (existing + derived in logic):
- auction_item_id (UUID)
- event_id (UUID)
- original_close_at (datetime)
- effective_close_at (datetime)
- total_extension_minutes_applied (integer)

Validation rules:
- effective_close_at must never exceed original_close_at + max_total_extension_minutes.
- total_extension_minutes_applied must be >= 0.

State transitions:
- Initial: effective_close_at = original_close_at, total_extension_minutes_applied = 0.
- On qualifying accepted bid: effective_close_at increases by min(extension_duration, remaining_cap).
- At cap reached: further qualifying bids do not extend.

## Entity: BidEvaluationEvent (logical)

A logical event used in bid processing decisions.

Fields:
- bid_id (UUID)
- item_id (UUID)
- accepted_at_server (datetime)
- qualifies_for_extension (boolean)
- extension_applied_minutes (integer)

Rules:
- Qualifies only if accepted_at_server is at or within trigger window before effective close.
- No retroactive re-evaluation when policy changes.
