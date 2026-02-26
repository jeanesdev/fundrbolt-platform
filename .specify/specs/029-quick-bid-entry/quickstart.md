# Quickstart: Quick Bid Entry

## Purpose
Validate the Quick Entry feature end-to-end for Live Auction and Paddle Raise workflows.

## Preconditions
- User has one of roles: Super Admin, NPO Admin, or NPO Staff.
- Event contains:
  - At least one live auction item
  - Bidder registrations with bidder numbers mapped to donors
  - Optional donation labels for paddle raise

## 1) Live Auction workflow
1. Open Admin PWA Quick Entry page for an event.
2. Select `Live Auction` mode.
3. Select a live auction item.
4. Enter amount (whole dollars); confirm display auto-formats as currency (no decimals).
5. Press `Enter` or `Tab` in amount input and confirm focus moves to bidder number input.
6. Enter bidder number and press `Enter`.
7. Confirm:
   - Bid is created and appears in log with bidder number, donor name, and table (if available)
   - Amount/bidder inputs reset for next entry
   - Focus returns to amount input
8. Enter two same-amount bids from different bidder numbers quickly.
9. Confirm first accepted bid is ranked higher.
10. Click delete on one bid and confirm metrics update.
11. Click `Assign Winner`, confirm action, and verify highest valid bid becomes winner.

## 2) Paddle Raise workflow
1. Switch to `Paddle Raise` mode.
2. Confirm no auction item selection is required.
3. Enter amount and bidder number; submit from bidder number input.
4. Confirm bidder number clears and focus remains on bidder number input.
5. Submit donation with selected predefined labels.
6. Submit donation with custom label text.
7. Submit donation with no labels selected and empty custom label.
8. Confirm all valid submissions are saved and metrics update:
   - Total pledged amount
   - Counts by amount level
   - Unique donor count
   - Participation percent

## 3) Error handling and access checks
1. Attempt quick entry with unmatched bidder number in Live Auction mode.
2. Confirm error is shown and no record is created.
3. Repeat unmatched bidder in Paddle Raise mode.
4. Confirm error is shown, no record is created, and entry flow remains active.
5. Attempt to access page with a non-authorized role.
6. Confirm access is denied.

## 4) API/contract verification
- Validate contract responses for create/delete/winner/summary endpoints against OpenAPI schema in `contracts/quick-entry.openapi.yaml`.
- Verify audit trail entries include actor and timestamp for create/delete/winner actions.

## 5) Completion checklist
- All user stories in spec have a passing walkthrough.
- Tie handling, unmatched bidder rejection, and role restriction are verified.
- Summary indicators update in near real-time after create/delete operations.
