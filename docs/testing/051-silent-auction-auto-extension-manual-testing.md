# Manual Testing Guide: Silent Auction Auto-Extension (Anti-Sniping)

## Scope

This guide validates the event-level silent-auction auto-extension feature:

- Policy configuration from Admin UI
- Extension behavior for bids within the trigger window
- Cap behavior (`max_total_extension_minutes`)
- Non-qualifying bids outside trigger window
- Immediate policy updates for subsequent accepted bids
- Effective close time visibility in admin auction item surfaces

## Preconditions

1. Backend and admin frontend are running.
2. You have an admin-capable account for a test NPO/event.
3. Test event has:
   - Silent auction enabled
   - At least one **silent** auction item
   - Event close time set near enough to test quickly
4. You can place bids as a donor user in the same event.

## Suggested Test Data

Use one event and one silent item with these defaults:

- `trigger_window_minutes`: `3` (system default)
- `extension_duration_minutes`: `3`
- `max_total_extension_minutes`: `6`

This setup makes cap behavior easy to verify in two qualifying bids.

## Test Cases

### 1. Policy loads and saves valid values

1. Open admin page for event silent auction items.
2. Locate the anti-sniping/auto-extension policy card.
3. Confirm current values are shown.
4. Set:
   - Enabled: `true`
   - Extension duration: `3`
   - Max total extension: `6`
5. Save.

Expected:

- Save succeeds with no error toast.
- Reloading page keeps values.
- No console/runtime error appears.

### 2. Policy validation bounds

1. Try extension duration `< 1` and `> 10`.
2. Try max total extension `< 0` and `> 60`.
3. Attempt save for each invalid value.

Expected:

- UI/API blocks invalid values.
- Clear validation feedback shown.
- Last valid saved values remain unchanged.

### 3. Bid outside trigger window does not extend

1. Ensure item close time is more than 3 minutes away.
2. Place a valid accepted bid.
3. Refresh admin item listing/details.

Expected:

- Bid succeeds.
- `effective_close_at` does **not** move.
- Extension metadata indicates no extension applied.

### 4. Bid inside trigger window extends by configured duration

1. Wait until item is within final 3 minutes.
2. Place a valid accepted bid.
3. Refresh admin item listing/details.

Expected:

- Bid succeeds.
- `effective_close_at` increases by `extension_duration_minutes`.
- Extension metadata indicates extension minutes applied.

### 5. Max total extension cap is enforced

1. Keep bidding inside the trigger window until total applied extension reaches `max_total_extension_minutes`.
2. Place one more qualifying bid within the trigger window.

Expected:

- Item close time stops increasing after cap is reached.
- Response metadata indicates cap reached (or applied extension is `0` once capped).

### 6. Immediate policy change affects only subsequent accepted bids

1. With item still open, change policy:
   - Extension duration from `3` to `1`.
2. Place a new qualifying bid.

Expected:

- New bid uses updated policy value (`1` minute), subject to remaining cap.
- Previously applied extensions are unchanged.

### 7. Disable auto-extension

1. Set `auto_extension_enabled = false` and save.
2. Place qualifying bid inside trigger window.

Expected:

- Bid succeeds.
- No extension is applied.
- Effective close time does not move.

### 8. Effective close-time visibility in admin surfaces

1. Open auction items page/cards after one or more extensions.
2. Verify close-time display reflects effective close behavior.

Expected:

- UI clearly reflects extension-adjusted close timing for silent items.
- Values remain consistent after refresh.

## Regression Checks

1. Live auction items are unaffected by this feature.
2. Silent bid placement still follows existing rules (increments, eligibility, etc.).
3. Existing events without explicit policy row still operate with defaults once evaluated.

## Completion Criteria

Mark feature complete when:

- All test cases above pass.
- No backend errors or 500s occur during policy save or bid placement.
- No frontend runtime errors occur in policy card or auction item views.
- Effective close-time behavior matches configured policy and cap in repeated trials.
