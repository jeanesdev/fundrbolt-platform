# Data Model: 045-printable-reports — Printable Reports & Export

**Date**: 2026-05-07 | **Branch**: `045-printable-reports`

---

## Overview

This feature adds **no new database tables or migrations**. All three report types are generated on-demand from existing data and delivered directly as PDF bytes. Nothing is persisted after the download completes.

---

## Data Flows

### 1. Event Summary Report

**Data sources → Service → PDF**

```
EventDashboardService.get_dashboard_summary(event_id, scenario="base")
  → DashboardSummary (goal, total_actual, sources, waterfall, cashflow, funnel, pacing)

EventDashboardService.get_segment_breakdown(event_id, segment_type="table")
EventDashboardService.get_segment_breakdown(event_id, segment_type="guest")
EventDashboardService.get_segment_breakdown(event_id, segment_type="company")
  → SegmentBreakdownResponse ×3

NPO (via Event.npo.branding.logo_url) → fetched as base64

  ↓
EventReportService.generate_pdf(event_id, db) → bytes
  → Jinja2 render → WeasyPrint → PDF bytes → StreamingResponse
```

**Fields consumed**:
| Schema field | Used for |
|---|---|
| `DashboardSummary.goal` | Goal bar on pacing chart |
| `DashboardSummary.total_actual` | Total raised prominent KPI |
| `DashboardSummary.variance_amount / variance_percent` | Variance display |
| `DashboardSummary.pacing` | Pacing status badge |
| `DashboardSummary.sources[]` | Revenue source bar chart |
| `DashboardSummary.waterfall[]` | Waterfall chart |
| `DashboardSummary.cashflow[]` | Cashflow timeline line chart |
| `DashboardSummary.funnel[]` | Conversion funnel table |
| `DashboardSummary.revenue_generators` | Revenue generators section |
| `SegmentBreakdownResponse.items[]` (×3) | Leaderboard tables (table / guest / company) |

---

### 2. Bid Cards

**Data sources → Service → PDF**

```
AuctionItem (ORM) with .media relationship eagerly loaded
  → filtered: status=published, ordered by bid_number asc

Per item: first media with media_type='image' and display_order min
  → fetched from Azure Blob URL as base64 (or NPO logo fallback)

QR code: generated per item → base64 PNG

NPO branding (logo_url) → fetched as base64 (for fallback image)

  ↓
BidCardService.generate_pdf(event_id, item_ids, label_size, db) → bytes
  → Jinja2 render (one card per item) → WeasyPrint → PDF bytes
```

**Fields consumed**:
| Model field | Used for |
|---|---|
| `AuctionItem.bid_number` | Lot number (large/prominent) |
| `AuctionItem.title` | Item title |
| `AuctionItem.auction_type` | Badge: "Live" / "Silent" |
| `AuctionItem.starting_bid` | Starting bid display |
| `AuctionItem.donor_value` | Est. value (omitted if None) |
| `AuctionItem.donated_by` | Donated by (omitted if None) |
| `AuctionItemMedia.file_path` | Primary image URL (first by display_order, type=image) |
| QR code URL | `{DONOR_PWA_BASE_URL}/events/{slug}/auction/{item_id}` |

**Label size enum** (new Pydantic schema, not a DB model):
```python
class LabelSize(str, Enum):
    W2H3 = "2x3"   # 50.8mm × 76.2mm
    W2H4 = "2x4"   # 50.8mm × 101.6mm
    W3H3 = "3x3"   # 76.2mm × 76.2mm
    W3H5 = "3x5"   # 76.2mm × 127mm
```

---

### 3. Auctioneer Report

**Data sources → Service → PDF**

```
AuctioneerService.get_dashboard(event_id, auctioneer_user_id)
  → DashboardResponse (earnings, event_totals, revenue_generators)

AuctioneerService.get_commissions(auctioneer_user_id, event_id)
  → CommissionListResponse (per-item commission rows)

AuctioneerEventSettings (via get_event_settings)
  → category percentages (live_percent, paddle_raise_percent, silent_percent)

User (auctioneer display name) → from current_user

  ↓
AuctioneerReportService.generate_pdf(event_id, auctioneer_user_id, db) → bytes
  → Jinja2 render → WeasyPrint → PDF bytes
```

**Fields consumed**:
| Schema field | Used for |
|---|---|
| `EarningsSummary.total_earnings` | Grand total commission (prominent) |
| `EarningsSummary.per_item_total` | Per-item commission subtotal |
| `EarningsSummary.live_auction_category_earning` | Live auction category earning |
| `EarningsSummary.paddle_raise_category_earning` | Paddle raise category earning |
| `EarningsSummary.silent_auction_category_earning` | Silent auction category earning |
| `EventTotals.live_auction_raised` | Live auction revenue |
| `EventTotals.paddle_raise_raised` | Paddle raise revenue |
| `EventTotals.silent_auction_raised` | Silent auction revenue |
| `EventTotals.event_total_raised` | Grand total |
| `CommissionListItem.bid_number` | Lot number |
| `CommissionListItem.title` | Item title |
| `CommissionListItem.final_sale_amount` | Final sale amount |
| `CommissionListItem.commission_percent` | Commission % |
| `CommissionListItem.flat_fee` | Flat fee |
| `CommissionListItem.commission_earned` | Calculated per-item earning |
| `AuctioneerEventSettings.live_auction_percent` etc. | Category % display |
| `DashboardResponse.revenue_generators` | Revenue generators total |

---

## New Pydantic Schemas (no DB changes)

### `app/schemas/reports.py`

```python
class LabelSize(str, Enum):
    W2H3 = "2x3"
    W2H4 = "2x4"
    W3H3 = "3x3"
    W3H5 = "3x5"

class BidCardRequest(BaseModel):
    item_ids: list[UUID] | None = None  # None = all published items
    label_size: LabelSize
```

---

## No Migration Needed

Reports are ephemeral — generated in-memory and streamed directly to the client as `application/pdf`. No tables, no columns, no indexes added.
