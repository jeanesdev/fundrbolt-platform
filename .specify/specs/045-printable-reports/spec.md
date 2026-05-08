# Feature Specification: Printable Reports & Export

**Feature Branch**: `045-printable-reports`
**Created**: 2026-05-07
**Status**: Draft
**Input**: User description: "printable-reports"

## Clarifications

### Session 2026-05-07

- Q: How should the system deliver PDF reports — synchronous with browser spinner only, in-page loading overlay, or async with a notification when ready? → A: In-page loading overlay / spinner shown while generating; browser download starts on completion.
- Q: Which admin roles can access bid card printing? → A: NPO Admin, NPO Staff, and Super Admin.
- Q: In the event report PDF, how should the segment leaderboard be scoped — user picks one segment, all three included, or auto-selected? → A: All three segment views (by table, by guest, by company) included as separate sections in the report.
- Q: Where should the auctioneer report download be triggered — from the auctioneer dashboard or the event admin area? → A: From the auctioneer dashboard.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — NPO Event Summary Report Download (Priority: P1)

An NPO admin wants to download a comprehensive, visually rich PDF report for any event they manage. The report mirrors the event dashboard — colorful charts for revenue by source, segment performance, pacing against goal, cashflow timeline — suitable for board presentations, donor thank-you materials, and internal records.

**Why this priority**: Post-event reporting is a core non-profit need. A polished PDF with visual charts is the highest-value artifact the platform can produce — it drives stakeholder trust and demonstrates event ROI to boards.

**Independent Test**: Navigate to any event in the admin area, click "Download Report", and confirm a PDF downloads containing: NPO logo/name, event name, event date, all revenue metrics, colorful bar/pie charts, and the segment leaderboard. Delivers standalone value independent of bid cards or the auctioneer report.

**Acceptance Scenarios**:

1. **Given** an NPO admin views an event's admin area, **When** they trigger the event report download, **Then** a PDF begins downloading within 15 seconds.
2. **Given** the downloaded PDF, **When** opened, **Then** page 1 shows NPO logo (if configured), NPO name, event name, event date, and total raised vs. goal with a prominent progress indicator.
3. **Given** the downloaded PDF, **When** reviewed, **Then** it includes colorful bar/pie charts for revenue by source (tickets, sponsorships, silent auction, live auction, paddle raise, donations) equivalent to the event dashboard.
4. **Given** the downloaded PDF, **When** reviewed, **Then** it includes a pacing/waterfall visualization and cashflow timeline chart matching the dashboard equivalents.
5. **Given** the downloaded PDF, **When** reviewed, **Then** it includes all three segment leaderboard views as separate sections: top contributors by table, top contributors by guest, and top contributors by company.
6. **Given** an event with zero revenue, **When** the report is downloaded, **Then** the PDF renders completely with zero-value placeholders — no broken sections or empty pages.
7. **Given** a user without NPO admin or super admin access, **When** they attempt to download the event report, **Then** the system rejects the request with an access-denied response.

---

### User Story 2 — Auction Item Bid Cards for Brady Label Makers (Priority: P2)

An event coordinator needs to print physical bid cards for silent auction items to place at display tables at the event venue. They select one or more auction items, choose from common Brady label sizes, and download a PDF formatted to those exact dimensions — one card per page — ready to send to the Brady label printer.

**Why this priority**: Physical bid cards are a day-of operational necessity for silent auctions. Without them, guests cannot identify items or know the starting bid. This removes a significant manual preparation burden.

**Independent Test**: Navigate to an event's auction items list, select at least one published item, choose a label size, and download a PDF where each page is exactly the chosen label size and contains the correct item data and QR code.

**Acceptance Scenarios**:

1. **Given** an event has published auction items, **When** an admin selects items and initiates bid card printing, **Then** a size selection is presented offering at least: 2″×3″, 2″×4″, 3″×3″, and 3″×5″.
2. **Given** a size is selected and confirmed, **Then** a PDF downloads where each page is exactly the chosen label dimensions and contains one bid card.
3. **Given** each bid card in the PDF, **When** inspected, **Then** it shows: lot number (large/prominent), item title, auction type badge (Live or Silent), starting bid, estimated value (if configured), primary image (scaled to fit), donated_by field (if set), and a QR code linking to the item's public page.
4. **Given** an item with no image, **When** its card is rendered, **Then** the image area shows a branded placeholder (NPO logo or event name) — not a blank space.
5. **Given** a multi-item PDF, **When** reviewed, **Then** cards are ordered by lot number ascending.
6. **Given** a "Select All" action, **When** bid cards are generated, **Then** all published (non-draft, non-withdrawn) items are included.
7. **Given** up to 100 items selected, **When** generating bid cards, **Then** the download completes within 30 seconds.

---

### User Story 3 — Auctioneer Financial Summary Report (Priority: P3)

An auctioneer wants to download a PDF summarizing their total earned commissions for an event alongside the event's overall financial performance. The report serves as an invoice/earnings statement for billing the NPO and as a personal post-event financial record.

**Why this priority**: Narrower audience than the NPO report, but critical for financial reconciliation between the auctioneer and NPO after every event.

**Independent Test**: Log in as an auctioneer (or super admin), navigate to an event with auction data and configured commissions, download the auctioneer report, and verify all totals match the auctioneer dashboard display.

**Acceptance Scenarios**:

1. **Given** an auctioneer or super admin views an event they have auctioneer access to, **When** they trigger the auctioneer report download, **Then** a PDF downloads within 10 seconds.
2. **Given** the auctioneer report PDF, **When** reviewed, **Then** the header shows: event name, event date, auctioneer name, and report generation timestamp.
3. **Given** the auctioneer report PDF, **When** reviewed, **Then** it shows event financial summary: live auction total, silent auction total, paddle raise total, revenue generators total, and event grand total.
4. **Given** the auctioneer report PDF, **When** reviewed, **Then** it includes an itemized table for all items with confirmed bids: lot number, item title, final sale amount, commission %, flat fee, and calculated per-item commission earned.
5. **Given** the auctioneer report PDF, **When** reviewed, **Then** it includes category-level earnings (live %, paddle raise %, silent %) with corresponding revenue totals and calculated earnings.
6. **Given** the auctioneer report PDF, **When** reviewed, **Then** the grand total auctioneer commission is prominently displayed, summing per-item and category-level earnings.
7. **Given** a user with NPO Admin, Check-in Staff, or Donor role, **When** they attempt to access the auctioneer report, **Then** the system denies access — commission details are never exposed to these roles.
8. **Given** an event with no commissions configured, **When** the auctioneer report is downloaded, **Then** the PDF renders fully — commission columns show $0 / 0% with a visible note that commissions have not been set up.

---

### Edge Cases

- What happens when the event goal is $0 or not configured — does the pacing chart render gracefully (e.g., showing $X raised with no goal bar)?
- What if an auction item's primary image file has been deleted from storage — does bid card generation fall back to the branded placeholder rather than failing?
- What if report generation is requested while the event is actively in progress — data is snapshotted at request time, not updated mid-render.
- What if PDF generation takes longer than expected — the system MUST display an in-page loading overlay/spinner while generating; the overlay dismisses and the browser download begins on completion.
- What if selected label size cannot fit all card content — does text truncate with ellipsis rather than overflow or break layout?
- What if an event has 0 published auction items — is "Print Bid Cards" disabled or does it show a meaningful empty-state message?
- What if an item title is at the 200-character maximum — does it truncate gracefully to fit the label layout?

## Requirements *(mandatory)*

### Functional Requirements

**NPO Event Report (PDF)**

- **FR-001**: NPO admins and super admins MUST be able to download a PDF event report for any event they have administrative access to.
- **FR-002**: The event report MUST include all major metrics shown on the event dashboard: total raised, fundraising goal, variance ($ and %), pacing status, projected total, and revenue breakdown by source.
- **FR-003**: The event report MUST include full-color visual charts equivalent to the event dashboard: revenue source breakdown (bar chart), waterfall/contribution chart, pacing progress visualization, and cashflow timeline (line chart).
- **FR-004**: The event report MUST include all three segment leaderboard views as separate sections: top contributors by table, top contributors by guest, and top contributors by company — consistent with the event dashboard segment data.
- **FR-005**: The first page of the event report MUST display: NPO logo (if configured in branding settings), NPO name, event name, event date, and report generation timestamp as a header.
- **FR-006**: The event report MUST be formatted for standard US letter (8.5″×11″) or A4 page sizes with appropriate margins for printing.
- **FR-007**: All report data MUST be captured as a point-in-time snapshot at download time — reports do not update after generation.
- **FR-008**: The event report download MUST complete within 15 seconds for events with up to 500 registrations and 150 auction items.
- **FR-009**: The event report download action MUST be accessible directly from the event's admin area without navigating away.
- **FR-009a**: When a report download is initiated, the system MUST display an in-page loading overlay or spinner for the duration of generation; the overlay MUST dismiss automatically and the browser download MUST begin immediately upon completion.
- **FR-009b**: If server-side report generation fails, the loading overlay MUST dismiss and the user MUST be shown an error message explaining that the report could not be generated — no silent failures.
- **FR-010**: Charts in the event report MUST use distinct colors AND include data labels/values so the report remains interpretable when printed on a monochrome printer.

**Auction Item Bid Cards (Brady Label Format PDF)**

- **FR-011**: NPO Admins, NPO Staff, and Super Admins MUST be able to select one or more published auction items for an event and initiate bid card PDF generation. Check-in Staff and Donor roles MUST NOT have access to bid card generation.
- **FR-012**: The system MUST offer at least the following Brady-compatible label sizes before generating: 2″×3″ (50.8×76.2mm), 2″×4″ (50.8×101.6mm), 3″×3″ (76.2×76.2mm), and 3″×5″ (76.2×127mm).
- **FR-013**: The generated PDF MUST set each page to exactly the chosen label dimensions, with one bid card per page.
- **FR-014**: Each bid card MUST display: lot number (bid_number, visually prominent), item title, auction type indicator (live or silent), starting bid amount, and estimated value (if configured on the item).
- **FR-015**: Each bid card MUST display the item's primary image, scaled to fit within the card layout without distortion or cropping.
- **FR-016**: Each bid card MUST include a scannable QR code that links to the item's public-facing page on the donor PWA.
- **FR-017**: Each bid card MUST display the donated_by field value when set on the item.
- **FR-018**: When no image exists for an item, the image area on the bid card MUST display a branded placeholder (NPO logo or event name) rather than an empty space.
- **FR-019**: Bid cards in the output PDF MUST be ordered by lot number (bid_number) ascending.
- **FR-020**: A "select all" control MUST be available to include all published auction items in a single print job; draft and withdrawn items MUST be excluded.
- **FR-021**: Bid card PDF generation for up to 100 items MUST complete within 30 seconds.
- **FR-021a**: While bid card PDF generation is in progress, the system MUST display an in-page loading overlay; the overlay MUST dismiss and the browser download MUST begin on completion. If generation fails, an error message MUST be shown.
- **FR-022**: If no published auction items exist for an event, the bid card print action MUST be disabled or present a clear empty-state message rather than generating an empty PDF.

**Auctioneer Financial Report (PDF)**

- **FR-023**: Auctioneers and super admins MUST be able to download an auctioneer financial report from the auctioneer dashboard for any event they have auctioneer access to. The download trigger MUST appear within the auctioneer dashboard UI (feature 038).
- **FR-024**: NPO admins, check-in staff, and donors MUST NOT be able to access or download the auctioneer report or any commission data it contains.
- **FR-025**: The auctioneer report header MUST include: event name, event date, auctioneer name, and report generation timestamp.
- **FR-026**: The auctioneer report MUST include an event financial summary section showing: live auction total, silent auction total, paddle raise total, revenue generators total, and event grand total.
- **FR-027**: The auctioneer report MUST include an itemized commission table listing all auction items with confirmed sale bids: lot number, item title, final sale amount, commission %, flat fee, and calculated per-item commission earned.
- **FR-028**: The auctioneer report MUST include a category-level earnings section showing configured percentages (live %, paddle raise %, silent %) with corresponding revenue totals and earnings calculated from those percentages.
- **FR-029**: The auctioneer report MUST display the total auctioneer commission (sum of all per-item and category earnings) prominently.
- **FR-030**: The auctioneer report MUST be formatted for standard US letter or A4 page sizes.
- **FR-031**: The auctioneer report download MUST complete within 10 seconds.
- **FR-032**: When no commissions are configured for an event, the auctioneer report MUST still render completely — commission columns MUST show $0 / 0% values with a visible note that commissions have not been configured.

### Key Entities

- **Event Report**: An on-demand PDF snapshot of all event financial and engagement data. Not persisted after generation. Derived from the same underlying data as the event dashboard.
- **Bid Card**: A single printable label-sized card for one auction item. Not persisted. Fields drawn from AuctionItem (bid_number, title, auction_type, starting_bid, donor_value, donated_by, primary image) plus a generated QR code.
- **Bid Card Print Job**: A user-initiated request specifying a set of auction item IDs and a Brady label size. Output is a single multi-page PDF (one card per page). Not persisted.
- **Auctioneer Report**: An on-demand PDF snapshot of auctioneer commission and event financial data. Not persisted. Derived from AuctioneerItemCommission and AuctioneerEventSettings alongside auction bid totals.

## Dependencies & Assumptions *(mandatory)*

### Dependencies

- **Event Dashboard (026-event-dashboard-for)**: Event report mirrors the metrics, chart structure, and data categories from the event dashboard.
- **Auction Items (008-auction-items)**: Source of bid_number, title, images, pricing, donated_by, and auction_type for bid cards.
- **Auction Dashboard (040-auction-dashboard)**: Bid totals and item performance data used in report generation.
- **Auctioneer Dashboard (038-auctioneer-dashboard)**: AuctioneerItemCommission and AuctioneerEventSettings data used in the auctioneer report.
- **Revenue Generators (042-revenue-generators)**: Revenue generator totals included in both the event and auctioneer reports.
- **NPO Branding (016-branding)**: NPO logo used in report headers and as bid card image placeholder.
- **Sponsors (007-sponsors)**: Sponsor name optionally shown on bid cards for items associated with a sponsor.

### Assumptions

- Reports are generated on demand and are NOT stored after download; no report history or re-download capability is included in this feature.
- The NPO logo in report headers is the same logo configured in branding settings (feature 016).
- Brady label printing assumes a standard PDF-to-label workflow; no direct printer driver or Brady software integration is required — the system generates a correctly-dimensioned PDF only.
- QR codes on bid cards link to the item's existing public URL on the donor PWA.
- Auctioneer commission visibility rules established in feature 038 apply equally to the auctioneer report PDF.
- All monetary values are displayed in USD; multi-currency support is out of scope.
- Charts in the event report reflect actual recorded values only — no projections or what-if scenario data is included.
- A single report covers one event at a time; cross-event aggregated reports are out of scope.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: NPO admins can download a complete event report PDF in under 15 seconds for any event with up to 500 registrations and 150 auction items.
- **SC-002**: Bid card PDFs containing up to 100 items can be downloaded in under 30 seconds.
- **SC-003**: 100% of published auction items selected for bid card generation are present in the output PDF, ordered by lot number ascending.
- **SC-004**: All monetary totals in the auctioneer report match exactly the values shown on the auctioneer dashboard at the time of download.
- **SC-005**: Event report PDF charts remain interpretable when printed in monochrome, through data labels and value annotations alongside color.
- **SC-006**: Bid card PDFs render at exactly the selected label dimensions with no text overflow or image clipping in a standard PDF viewer.
- **SC-007**: Commission data in the auctioneer report is inaccessible to NPO admin, check-in staff, and donor roles — verified by testing all four role combinations.
- **SC-008**: At least 4 Brady-compatible label sizes are offered: 2″×3″, 2″×4″, 3″×3″, and 3″×5″.
