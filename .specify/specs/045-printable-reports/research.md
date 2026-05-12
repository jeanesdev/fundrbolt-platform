# Research: 045-printable-reports — Printable Reports & Export

**Date**: 2026-05-07 | **Branch**: `045-printable-reports`

---

## 1. Chart Generation in Python for PDF Export

### Decision: matplotlib with base64-encoded PNG images embedded in HTML

**Rationale**: WeasyPrint renders HTML+CSS to PDF and fully supports embedded base64-encoded `<img>` tags. Matplotlib is the de-facto standard Python charting library with excellent output quality for print:
- Supports high-DPI output (`dpi=150`) for print-quality charts
- Generates bar charts, horizontal bar charts, pie/donut charts, and line charts out-of-the-box
- Produces PNG bytes directly (`savefig()` to `BytesIO`)
- Deterministic output — no browser rendering variability
- Runs synchronously in a thread pool executor alongside WeasyPrint

**Chart-to-type mapping**:
| Dashboard section | Chart type | matplotlib figure type |
|---|---|---|
| Revenue by source | Horizontal bar chart | `barh()` with data labels |
| Pacing progress | Progress bar / gauge | Custom horizontal bar with goal marker |
| Cashflow timeline | Line chart | `plot()` with date x-axis |
| Waterfall steps | Stacked bar chart | `bar()` with cumulative offsets |
| Segment leaderboard | Horizontal bar chart | `barh()` (×3, one per segment type) |

**Colors**: Use a fixed FundrBolt color palette (`#5B4FC2`, `#9333EA`, `#F59E0B`, `#10B981`, `#EF4444`, `#3B82F6`) matching the admin PWA charts. Include data labels on all bars so charts remain readable when printed monochrome.

**Alternatives considered**:
- **Plotly**: Generates interactive SVGs; WeasyPrint can render SVG, but Plotly adds ~15MB dependency and its SVG export requires Kaleido or orca subprocess — too heavy.
- **SVG hand-coded in Jinja2**: Viable for simple bars, but fragile for line charts and labels.
- **Chart.js server-side (node subprocess)**: Rejected — adds Node dependency to Python backend.

**Integration pattern** (mirror `checkout_receipt_service.py`):
```python
import io, base64, asyncio
import matplotlib
matplotlib.use("Agg")  # Non-interactive backend
import matplotlib.pyplot as plt

def _chart_to_base64(fig) -> str:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode()
```

**Dependency to add**: `matplotlib = ">=3.8"` in `pyproject.toml`.

---

## 2. QR Code Generation for Bid Cards

### Decision: `qrcode[pil]` library

**Rationale**: Generates QR codes as PNG images using Pillow (already installed). Direct base64 encoding for embedding in HTML. Well-maintained, simple API.

**Usage**:
```python
import qrcode
import io, base64

def _generate_qr_base64(url: str) -> str:
    qr = qrcode.QRCode(box_size=4, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return base64.b64encode(buf.read()).decode()
```

**QR code URL target**: `{DONOR_PWA_BASE_URL}/events/{event_slug}/auction/{item_id}` — the existing donor PWA auction item page. `DONOR_PWA_BASE_URL` read from settings.

**Dependency to add**: `qrcode[pil] = ">=7.4"` in `pyproject.toml`.

**Alternative considered**: `segno` — slightly smaller, but `qrcode[pil]` is more commonly known and Pillow integration is tighter.

---

## 3. Brady Label Size Implementation

### Decision: CSS `@page { size: Wmm Hmm; }` per-document, inline Jinja2 `style` block

**Rationale**: WeasyPrint fully respects CSS `@page` size declarations. A single Jinja2 template renders the correct page dimensions by injecting the chosen size into an inline `<style>` block.

**Supported sizes**:
| Label | Width × Height | CSS rule |
|---|---|---|
| 2″×3″ | 50.8mm × 76.2mm | `@page { size: 50.8mm 76.2mm; margin: 3mm; }` |
| 2″×4″ | 50.8mm × 101.6mm | `@page { size: 50.8mm 101.6mm; margin: 3mm; }` |
| 3″×3″ | 76.2mm × 76.2mm | `@page { size: 76.2mm 76.2mm; margin: 3mm; }` |
| 3″×5″ | 76.2mm × 127mm | `@page { size: 76.2mm 127mm; margin: 3mm; }` |

**Page break**: CSS `page-break-after: always` on each card's root div ensures one card per page. The last card omits the break.

**Text overflow**: All text fields use `overflow: hidden; text-overflow: ellipsis; white-space: nowrap;` for single-line fields; multi-line fields use `-webkit-line-clamp: 2` with `overflow: hidden`. WeasyPrint supports both.

---

## 4. Image Fetching for Bid Card and Report Headers

### Decision: Fetch via `aiohttp` and embed as base64 in HTML context

**Rationale**: WeasyPrint can technically fetch HTTP URLs directly, but this breaks when:
1. Images are behind Azure Blob Storage with SAS tokens or CDN URLs that may be relative/short-lived.
2. The backend runs in a local dev environment without public network access to blobs.
3. We need graceful fallback when an image is missing.

**Pattern**: Pre-fetch all required images before template render. Use `aiohttp.ClientSession` (already in `pyproject.toml`) to download, then base64-encode for embedding.

**Fallback for missing images**: If image URL fetch fails (404, network error, etc.) → use the NPO logo as fallback; if NPO logo also unavailable → use a plain text placeholder with event/NPO name.

**NPO logo fetch**: `npo.branding.logo_url` → fetched and embedded in report header and in bid card image fallback.

---

## 5. Backend Route Structure — New vs Extending Existing

### Decision: New `admin_reports.py` router registered under `/api/v1`

**Rationale**: Report endpoints are clearly a new domain (not dashboard, not auction items, not auctioneer). A single `admin_reports.py` file with 3 endpoints is clean and discoverable. No existing router is a natural home.

**Existing auctioneer router (`admin_auctioneer.py`)**: Does have `GET .../auctioneer/silent-auction/slides/export` (PowerPoint export). The auctioneer report endpoint should follow this naming convention: `GET .../auctioneer/report` for consistency, placed in `admin_reports.py` but under the same `/admin/events/{event_id}` prefix.

**Endpoint summary**:
- `GET  /api/v1/admin/events/{event_id}/reports/event-summary`
- `POST /api/v1/admin/events/{event_id}/reports/bid-cards`
- `GET  /api/v1/admin/events/{event_id}/auctioneer/report`

The auctioneer report endpoint goes in `admin_reports.py` (not `admin_auctioneer.py`) to keep all PDF generation in one file, but the auctioneer URL convention is preserved for UI consistency.

---

## 6. Existing Infrastructure Reuse

| Concern | Existing resource | Reuse strategy |
|---|---|---|
| PDF generation | `CheckoutReceiptService` (WeasyPrint + executor) | Copy `_generate_pdf` pattern |
| Jinja2 templating | `CheckoutReceiptService._jinja` | Copy — same `_TEMPLATES_DIR` path |
| Blob download API pattern | `AuctioneerService.downloadSilentAuctionSlides` | Copy `responseType: 'blob'` pattern |
| Loading overlay UI | `CheckoutPage` overlay or `Dialog` | Implement simple `useState` boolean overlay |
| NPO logo | `npo.branding.logo_url` | Fetch and embed in report header |
| Event data | `EventDashboardService.get_dashboard_summary` + `get_segment_breakdown` ×3 | Call directly in `EventReportService` |
| Auctioneer data | `AuctioneerService.get_dashboard` + `get_commissions` | Call directly in `AuctioneerReportService` |
| Auction item data | ORM direct query (with `AuctionItemMedia` relationship) | Load items + media in `BidCardService` |
| Access control helpers | `_verify_event_access`, `_resolve_auctioneer_id` in `admin_auctioneer.py` | Import and reuse |
