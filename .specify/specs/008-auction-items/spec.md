# Feature Specification: Auction Items

**Feature ID**: 008-auction-items
**Date**: 2025-11-13
**Status**: Planning

## Overview

Add comprehensive auction item management capabilities to the Fundrbolt platform, enabling event organizers to create, manage, and display auction items for both live and silent auctions. This feature supports rich media uploads, detailed item information, sponsor attribution, and automated bid number assignment.

## User Story

As an event coordinator, I need to add auction items for each event so that bidders can view item details, photos, and sponsorship information during live and silent auctions.

## Requirements

### Functional Requirements

#### Auction Item Core Fields
- **Title**: Item name/title (required, string, max 200 chars)
- **Description**: Detailed item description (required, text, rich text support)
- **Auction Type**: Live auction or silent auction (required, enum)
- **Bid Number**: Auto-assigned 3-digit number starting at 100 (unique per event)
- **Starting Bid**: Minimum opening bid amount (required, decimal, ≥0)
- **Donor Value**: Fair market value of the item (optional, decimal, ≥0)
- **Cost**: NPO's cost to acquire the item (optional, decimal, ≥0)
- **Buy Now Price**: Fixed price for instant purchase (optional, decimal, ≥starting_bid)
- **Buy Now Enabled**: Toggle for buy-it-now functionality (boolean, default false)
- **Quantity Available**: Number of items available (required, integer, ≥1, default 1)

#### Attribution Fields
- **Donated By**: Name of donor/business (optional, string, max 200 chars)
- **Sponsored By**: Link to sponsor record (optional, foreign key to sponsors table)

#### Media Management
- **Images**: Multiple image uploads (0-20 images per item)
  - Supported formats: JPG, PNG, WebP
  - Max size: 10MB per image
  - Min resolution: 800x600px
  - Auto-thumbnail generation (200x200, 800x600)
- **Videos**: Multiple video uploads (0-5 videos per item)
  - Supported formats: MP4, WebM
  - Max size: 100MB per video
  - Or video URL links (YouTube, Vimeo)
- **Display Order**: Drag-and-drop reordering of media files

#### External Links
- **Item Webpage**: Optional URL to external webpage with more details (string, valid URL)

#### Status & Metadata
- **Status**: Draft, published, sold, withdrawn (enum, default draft)
- **Display Priority**: Optional sort order for featured items (integer)
- **Created By**: User who created the item (foreign key)
- **Created At**: Timestamp
- **Updated At**: Timestamp
- **Event Association**: Link to parent event (required, foreign key)

### Non-Functional Requirements

#### Performance
- Image upload and processing: <10 seconds per image
- Item list page load: <2 seconds for 500 items
- Media gallery load: <1 second for first 3 images (lazy load remaining)

#### Security
- Media files stored in Azure Blob Storage with private access
- Signed URLs for temporary media access (15-minute expiry)
- Input validation and sanitization for all text fields
- File type validation before upload
- Virus scanning for uploaded files (Phase 2)

#### Usability
- Drag-and-drop media upload interface
- Real-time upload progress indicators
- Image preview before upload confirmation
- Bulk item import from CSV (Phase 2)
- Duplicate item detection based on title similarity

### Business Rules

1. **Bid Number Assignment**:
   - Auto-increment starting at 100 per event
   - Sequential assignment in creation order
   - Cannot be manually edited after creation
   - Gaps allowed if items are deleted/withdrawn

2. **Buy Now Logic**:
   - Buy now price must be ≥ starting bid
   - When buy now enabled and item purchased, auction closes immediately
   - Only one bidder can buy now (first come, first served)

3. **Quantity Handling**:
   - Multiple quantity items treated as single lot (all sold to one winner)
   - Separate lots require separate item entries

4. **Media Validation**:
   - At least 1 image recommended (warning if none)
   - Primary image (first in order) used for thumbnails/previews

5. **Sponsor Attribution**:
   - If "Sponsored By" is set, sponsor logo displayed alongside item
   - Multiple sponsorship levels not supported (single sponsor per item)

6. **Status Workflow**:
   - Draft → Published (available for bidding)
   - Published → Sold (auction complete, winner assigned)
   - Any status → Withdrawn (removed from auction, not deleted)

## API Endpoints

### Create Auction Item
```
POST /api/v1/events/{event_id}/auction-items
Authorization: Required (NPO Admin, NPO Staff)
Body: AuctionItemCreate schema
Response: 201 Created, AuctionItem schema
```

### List Auction Items
```
GET /api/v1/events/{event_id}/auction-items
Query params:
  - auction_type: live|silent (optional)
  - status: draft|published|sold|withdrawn (optional)
  - page: int (default 1)
  - limit: int (default 50, max 100)
Authorization: Public (published items only) or authenticated (all statuses)
Response: 200 OK, paginated list of AuctionItem schemas
```

### Get Auction Item Details
```
GET /api/v1/events/{event_id}/auction-items/{item_id}
Authorization: Public (if published) or authenticated
Response: 200 OK, AuctionItem schema with full media URLs
```

### Update Auction Item
```
PATCH /api/v1/events/{event_id}/auction-items/{item_id}
Authorization: Required (NPO Admin, NPO Staff)
Body: AuctionItemUpdate schema (partial fields)
Response: 200 OK, updated AuctionItem schema
```

### Delete/Withdraw Auction Item
```
DELETE /api/v1/events/{event_id}/auction-items/{item_id}
Authorization: Required (NPO Admin, NPO Staff)
Response: 204 No Content
Note: Soft delete if bids exist, otherwise hard delete
```

### Upload Item Media
```
POST /api/v1/events/{event_id}/auction-items/{item_id}/media
Authorization: Required (NPO Admin, NPO Staff)
Body: Multipart form-data with file upload
Response: 201 Created, MediaFile schema with URL
```

### Reorder Item Media
```
PATCH /api/v1/events/{event_id}/auction-items/{item_id}/media/order
Authorization: Required (NPO Admin, NPO Staff)
Body: Array of media IDs in new order
Response: 200 OK
```

### Delete Item Media
```
DELETE /api/v1/events/{event_id}/auction-items/{item_id}/media/{media_id}
Authorization: Required (NPO Admin, NPO Staff)
Response: 204 No Content
```

## Database Schema

### auction_items Table
```sql
CREATE TABLE auction_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    bid_number INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    auction_type VARCHAR(20) NOT NULL CHECK (auction_type IN ('live', 'silent')),
    starting_bid DECIMAL(10, 2) NOT NULL CHECK (starting_bid >= 0),
    donor_value DECIMAL(10, 2) CHECK (donor_value >= 0),
    cost DECIMAL(10, 2) CHECK (cost >= 0),
    buy_now_price DECIMAL(10, 2) CHECK (buy_now_price IS NULL OR buy_now_price >= starting_bid),
    buy_now_enabled BOOLEAN DEFAULT FALSE,
    quantity_available INTEGER NOT NULL DEFAULT 1 CHECK (quantity_available >= 1),
    donated_by VARCHAR(200),
    sponsor_id UUID REFERENCES sponsors(id) ON DELETE SET NULL,
    item_webpage TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'sold', 'withdrawn')),
    display_priority INTEGER,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT unique_bid_number_per_event UNIQUE (event_id, bid_number),
    CONSTRAINT valid_buy_now CHECK (
        (buy_now_enabled = FALSE) OR
        (buy_now_enabled = TRUE AND buy_now_price IS NOT NULL)
    )
);

CREATE INDEX idx_auction_items_event_id ON auction_items(event_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_auction_items_status ON auction_items(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_auction_items_auction_type ON auction_items(auction_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_auction_items_sponsor_id ON auction_items(sponsor_id) WHERE deleted_at IS NULL;
```

### auction_item_media Table
```sql
CREATE TABLE auction_item_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_item_id UUID NOT NULL REFERENCES auction_items(id) ON DELETE CASCADE,
    media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('image', 'video')),
    file_path TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    thumbnail_path TEXT,
    video_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_video CHECK (
        (media_type = 'image') OR
        (media_type = 'video' AND (file_path IS NOT NULL OR video_url IS NOT NULL))
    )
);

CREATE INDEX idx_auction_item_media_item_id ON auction_item_media(auction_item_id);
CREATE INDEX idx_auction_item_media_display_order ON auction_item_media(auction_item_id, display_order);
```

## UI/UX Requirements

### Admin Interface (NPO Staff)

#### Item Management Dashboard
- Table view with columns: Bid #, Title, Type, Starting Bid, Status, Actions
- Filters: Auction type, Status, Search by title/bid number
- Bulk actions: Publish, Withdraw, Export to CSV
- Sort by: Bid number, Title, Created date, Status

#### Create/Edit Item Form
- Multi-step wizard:
  1. Basic Info (title, description, type)
  2. Pricing (starting bid, buy now, donor value, cost)
  3. Media Upload (drag-drop zone)
  4. Attribution (donated by, sponsored by)
  5. Review & Publish
- Auto-save drafts every 30 seconds
- Validation warnings before publish

#### Media Upload Interface
- Drag-and-drop zone with visual feedback
- Multiple file selection support
- Progress bars for each upload
- Image preview thumbnails
- Reorder via drag-and-drop
- Set primary image (first in order)

### Bidder Interface (PWA)

#### Item Catalog
- Grid view with image thumbnails
- Filter by auction type (live/silent)
- Search by title/bid number
- Sort by: Bid number, Ending soon, Highest bid

#### Item Detail Page
- Image gallery with swipe/carousel
- Full description with rich text
- Current bid, starting bid, buy now price
- Sponsor logo and attribution
- "Place Bid" and "Buy Now" buttons
- Video playback (if available)

## Testing Requirements

### Unit Tests
- Bid number auto-increment logic
- Buy now price validation
- Media file validation (type, size)
- Status transition rules
- Soft delete logic

### Integration Tests
- Complete item creation workflow
- Media upload and retrieval
- Item listing with filters/pagination
- Sponsor attribution display
- Concurrent bid number assignment

### E2E Tests
- Create item → upload media → publish → view as bidder
- Edit published item → verify changes reflected
- Withdraw item → verify removed from public view
- Buy now purchase → verify item marked sold

## Success Criteria

- ✅ Event coordinators can create auction items in <2 minutes
- ✅ Media uploads complete in <10 seconds per file
- ✅ Item catalog loads 500+ items in <2 seconds
- ✅ Bid numbers automatically assigned without conflicts
- ✅ Sponsor logos display correctly on item detail pages
- ✅ No duplicate bid numbers within same event
- ✅ 95% test coverage for auction item logic

## Out of Scope (Phase 2+)

- Bulk CSV import for auction items
- AI-powered item descriptions
- Item recommendation engine for bidders
- Multi-sponsor support per item
- Package/bundle creation (multiple items as one lot)
- Reserve price (hidden minimum acceptable bid)
- Item categories/tags for advanced filtering
- Duplicate detection across events
- Version history for item edits
