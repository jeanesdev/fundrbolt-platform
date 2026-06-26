# Contracts: Impact Donations

Impact Donations reuse existing auction item and auction bid endpoints. No new API routes are required.

## Existing endpoints used by this feature

- `POST /api/v1/events/{event_id}/auction-items` - create an auction item with category `Impact` and an impact statement in `description`
- `PATCH /api/v1/events/{event_id}/auction-items/{item_id}` - update category, description, buy-now settings, and media metadata
- `POST /api/v1/auction/bids` - standard bid/buy-now submission; standard bids are rejected for Impact items
- `POST /api/v1/events/{event_id}/auction-items/{item_id}/media/upload-url` - upload images or videos
- `POST /api/v1/events/{event_id}/auction-items/{item_id}/media/confirm` - confirm uploaded media

## Behavioral contract

- `category = Impact` identifies an Impact Donation.
- `auction_type` remains `silent`.
- `buy_now_enabled` must be true.
- `description` is the impact statement.
- Standard bids against Impact items are rejected by the backend.
