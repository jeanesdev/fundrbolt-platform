# Feature: Auction Items Management (008-auction-items)

## 📋 Overview

Complete implementation of auction items management system for NPO fundraising events, including full CRUD operations, media management with Azure Blob Storage, and comprehensive UI/UX features.

## ✨ Key Features

### Backend Implementation

#### Database & Models
- **Auction Items Table** with comprehensive fields:
  - Basic info: title, description, auction_type (Live/Silent)
  - Pricing: starting_bid, donor_value, cost, buy_now_price, buy_now_enabled, bid_increment
  - Metadata: quantity_available, donated_by, sponsor_id, item_webpage, display_priority
  - System: bid_number (100-999 sequential per event), status (Draft/Published/Sold/Withdrawn)
  - Audit: created_by, created_at, updated_at, deleted_at

- **Auction Item Media Table**:
  - Azure Blob Storage integration with SAS URLs (24-hour expiry)
  - Media types: image, video, document
  - Features: display_order, primary image, thumbnails (128x128)
  - Soft delete support

#### Business Logic
- **Sequential Bid Numbering**: 100-999 per event with PostgreSQL sequences
- **Smart Bid Increment Calculation**: Auto-calculates based on starting bid:
  - ≤$50 → $5
  - $50-$150 → $10
  - $150-$500 → $25
  - $500-$1000 → $50
  - $1000-$2500 → $100
  - ≥$2500 → $250
- **Buy-Now Validation**: Ensures buy_now_price ≥ starting_bid
- **Soft vs Hard Delete**: Draft items hard deleted, published/sold items soft deleted
- **Azure Blob Security**: Public access disabled, SAS tokens required for all media

#### API Endpoints (10 Total)
**Auction Items CRUD:**
- `POST /api/v1/events/{event_id}/auction-items` - Create item
- `GET /api/v1/events/{event_id}/auction-items` - List with pagination/filtering
- `GET /api/v1/events/{event_id}/auction-items/{item_id}` - Get details with media
- `PATCH /api/v1/events/{event_id}/auction-items/{item_id}` - Update item
- `DELETE /api/v1/events/{event_id}/auction-items/{item_id}` - Delete (soft/hard)

**Media Management:**
- `POST /api/v1/auction-items/{item_id}/media` - Upload media (multipart/form-data)
- `GET /api/v1/auction-items/{item_id}/media` - List media with SAS URLs
- `DELETE /api/v1/auction-items/{item_id}/media/{media_id}` - Delete media
- `POST /api/v1/auction-items/{item_id}/media/reorder` - Reorder media
- `POST /api/v1/auction-items/{item_id}/media/{media_id}/set-primary` - Set primary image

#### Testing (35+ Tests)
- **14 Unit Tests**: Bid numbering, validation, soft/hard delete logic
- **21+ Contract/API Tests**: Full endpoint coverage, error handling
- **Coverage**: 40%+ with focused testing on critical business logic

### Frontend Implementation

#### Pages (4 Total)
1. **List Page**: Grid view with filtering, search, add button
2. **Create Page**: Full form with validation
3. **Edit Page**: Same form with existing data, media gallery
4. **Detail Page**: Read-only view with full media display

#### Components
- **AuctionItemForm**: Comprehensive form with:
  - All auction item fields
  - Auto-calculating bid increment based on starting bid
  - onBlur validation for numeric fields (prevents negatives)
  - Email/URL validation
  - Buy-now price validation

- **MediaGallery**: Media management with:
  - Drag-and-drop reordering (@dnd-kit)
  - Click to view full-size modal
  - Previous/Next navigation controls
  - Set primary image (hover to show)
  - Delete button
  - Position counter (e.g., "2 / 5")

- **MediaUploadZone**: File upload with:
  - Drag-and-drop support
  - Multiple file selection
  - Preview before upload
  - Progress indicators
  - File validation

- **AuctionItemList**: Inline display in event edit page
- **AuctionItemCard**: Card view with image, title, pricing

#### UX Enhancements
- **Inline Display**: Auction items tab in event edit page (no separate navigation)
- **Full-size Media Viewer**: Modal with navigation for both auction items and events
- **Auto-calculation**: Bid increment updates when starting bid changes
- **Form Validation**: Real-time feedback on blur, not just submit
- **Error Handling**: Clear error messages with inline display

### Infrastructure & DevOps

#### Database Migrations (2)
1. `4d729e04` - Initial auction_items and auction_item_media tables
2. `babe721dff11` - Add bid_increment column with auto-calculation

#### Azure Integration
- **Blob Storage**: Public access disabled (security best practice)
- **SAS Tokens**: 24-hour expiry, read-only permission
- **Thumbnails**: Auto-generated 128x128 for images
- **Applied to**: Auction item media, sponsor logos, event media

#### Seed Data
- **seed_auction_items_simple.py**: 10 sample items (6 Live, 4 Silent)
- Realistic data: Weekend Getaway ($2500), Golf Package ($1200), Wine Tasting ($800), etc.
- Proper bid_increment values based on starting_bid

## 🔧 Technical Details

### Key Technologies
- **Backend**: FastAPI, SQLAlchemy 2.0, Pydantic 2.0, Azure Blob Storage SDK, Pillow
- **Frontend**: React, TypeScript, Vite, Zustand, TanStack Router, @dnd-kit
- **Database**: PostgreSQL (Azure Database)
- **Storage**: Azure Blob Storage with SAS authentication
- **Cache**: Redis (rate limiting, session management)

### Database Schema
```sql
-- auction_items table
- id (uuid, PK)
- event_id (uuid, FK -> events)
- bid_number (integer, 100-999, unique per event)
- title, description
- auction_type (LIVE, SILENT)
- starting_bid, donor_value, cost, buy_now_price, bid_increment
- buy_now_enabled, quantity_available
- donated_by, sponsor_id, item_webpage, display_priority
- status (DRAFT, PUBLISHED, SOLD, WITHDRAWN)
- created_by, created_at, updated_at, deleted_at

-- auction_item_media table
- id (uuid, PK)
- auction_item_id (uuid, FK -> auction_items)
- file_path, thumbnail_path, file_name, file_size, media_type
- display_order, created_at, updated_at, deleted_at
```

## 🐛 Bug Fixes & Improvements

### Media Upload Issues (7 Fixed)
1. ✅ Double file dialog on upload
2. ✅ Missing image preview after upload
3. ✅ Broken image display (SAS URL generation)
4. ✅ Delete button not working
5. ✅ Drag-drop activation issues
6. ✅ Thumbnail display problems
7. ✅ Images disappearing after reorder

### Route & Navigation
- ✅ Fixed detail page route path (trailing slash mismatch)
- ✅ Changed to inline display in event edit page
- ✅ Proper navigation with state management

### Validation & UX
- ✅ Added onBlur validation for all numeric fields
- ✅ Email and URL validation
- ✅ Negative number prevention
- ✅ Buy-now price >= starting bid validation
- ✅ Auto-calculating bid increment with manual override

### Azure Blob Storage
- ✅ Added SAS URL generation to all media endpoints
- ✅ Fixed sponsor logo/thumbnail display
- ✅ Event media viewer consistency
- ✅ 24-hour token expiry

## 📊 Testing Coverage

### Unit Tests (14)
- T027: Sequential bid number assignment
- T028: Buy-now price validation
- T029: Soft vs hard delete logic

### Contract Tests (21+)
- Full CRUD operations
- Media upload/delete/reorder
- Pagination and filtering
- Error handling (404, 400, 500)
- Authentication and authorization

### Manual Testing
- ✅ All CRUD flows tested
- ✅ Media upload/reorder/delete verified
- ✅ Form validation confirmed
- ✅ Navigation tested
- ✅ Seed data successful

## 📝 Commits Summary

**17 commits** across 4 phases:

### Phase 1-2: Foundation (4 commits)
- Database models and migrations
- Schema definitions
- Bid number sequences

### Phase 3: Core CRUD (5 commits)
- Service layer implementation
- API routes and endpoints
- Business logic validation
- Audit logging

### Phase 4: Media & Frontend (5 commits)
- Media upload service
- Frontend pages and components
- Media gallery with drag-drop
- Full-size viewer modals

### Refinements (3 commits)
- Bug fixes for media display
- Form validation improvements
- Bid increment feature
- Schema parameter fixes

## 🔐 Security & Best Practices

- ✅ Azure Blob Storage public access disabled
- ✅ SAS tokens with 24-hour expiry
- ✅ Input validation on all fields
- ✅ Soft delete for published items (audit trail)
- ✅ Role-based access control ready
- ✅ SQL injection prevention (SQLAlchemy ORM)
- ✅ CORS configuration
- ✅ Rate limiting on uploads

## 📦 Deployment Considerations

### Database
- Migration `babe721dff11` must be run before deployment
- PostgreSQL sequences created per event
- Backward compatible (no breaking changes)

### Frontend
- No environment variable changes needed
- Build succeeds with no errors
- Type checking passes

### Backend
- No new dependencies added
- All tests passing
- Pre-commit hooks validated

## 🎯 Future Enhancements (Out of Scope)

- Bidding functionality (separate feature)
- Real-time bid updates via WebSockets
- Payment processing integration
- Donor portal
- Advanced analytics and reporting
- Email notifications for bid updates
- Mobile app support

## ✅ Ready to Merge

- All tests passing (35+)
- No type errors
- Pre-commit hooks passing
- Migration created and tested
- Documentation complete
- Seed data functional
- Zero breaking changes

---

**Branch**: `008-auction-items`
**Target**: `main`
**Reviewer**: @jeanesdev
