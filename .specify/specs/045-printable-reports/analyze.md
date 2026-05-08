# Analysis: 045-printable-reports

**Date**: 2026-05-07
**Analyzed by**: /speckit.analyze
**Input**: `plan.md`, `tasks.md`, `spec.md`, `data-model.md`, `research.md`, `contracts/reports-api.yaml`
**Codebase reference**: constitution.md, checkout_receipt_service.py, admin_auctioneer.py, event_dashboard_service.py, auctioneer_service.py

---

## Findings Summary

| ID | Severity | Category | Finding | Remediation |
|----|----------|----------|---------|-------------|
| F001 | 🔴 HIGH | Type Safety | `chart_utils.py` uses `Any` implicitly — matplotlib's `Figure` type is untyped; `asyncio.get_event_loop()` is deprecated in Python 3.10+ | Use `asyncio.get_running_loop()` instead; import `matplotlib.figure.Figure` for type annotations |
| F002 | 🟡 MEDIUM | Security | `auctioneer/report` endpoint: `_resolve_auctioneer_id` may allow an auctioneer to pass `auctioneer_user_id` for a different auctioneer | Verify the resolution logic — it already restricts non-superadmin callers; document explicitly in tasks |
| F003 | 🟡 MEDIUM | Performance | matplotlib chart generation is synchronous and CPU-bound; 5 charts × ~200ms = 1+ second blocking the event loop if not run in executor | All chart generation (not just WeasyPrint) must be wrapped in `run_in_executor` |
| F004 | 🟡 MEDIUM | Testing | Tasks.md has no test tasks — constitution requires 80%+ coverage; no contract tests planned for the 3 new PDF endpoints | Add T028-T030: contract tests for all 3 endpoints (auth/role enforcement + HTTP 200 + content-type header) |
| F005 | 🟡 MEDIUM | Architecture | `chart_utils.py` proposed as a "shared utility" module is YAGNI — it will only be used by 3 services in this feature | Inline chart utilities into `event_report_service.py` directly; expose only a module-level helper if genuinely shared across 2+ services |
| F006 | 🟢 LOW | Code Quality | `qr_utils.py` as a separate file for a single 5-line function is over-engineering | Inline `generate_qr_base64` into `bid_card_service.py` — only one caller |
| F007 | 🟢 LOW | Consistency | `DownloadReportButton` component reinvents loading overlay rather than reusing existing overlay pattern from checkout flow | Check if a shared loading overlay component already exists (e.g., in `src/components/`); reuse it if present |
| F008 | 🟢 LOW | UX | T017 (bid cards UI) uses "Print Bid Cards" as button label even when 0 items selected, with a conditional "Print All" — two different button labels for the same action is confusing | Use single label "Print Bid Cards" always; omit or null `item_ids` when nothing is selected (pass all); show item count in button label when items are selected (e.g., "Print 3 Bid Cards") |
| F009 | 🟢 LOW | Type Safety | Frontend `BidCardRequest` type is implicit in `reportService.ts` — should be an exported TypeScript interface | Add `BidCardRequest` interface export in `reportService.ts` |

---

## Detailed Findings

### F001 — asyncio.get_event_loop() is deprecated (🔴 HIGH)

**Location**: `tasks.md` T005, `plan.md` references `checkout_receipt_service.py` pattern
**Details**: The existing `checkout_receipt_service.py` uses `asyncio.get_event_loop()` which is deprecated as of Python 3.10+ and emits a `DeprecationWarning` in Python 3.12+. The new services must use `asyncio.get_running_loop()` instead. Additionally, matplotlib's `Figure` type is in `matplotlib.figure.Figure`; using it with mypy strict requires an explicit import.
**Risk**: mypy strict will fail if `Any` types appear; runtime deprecation warning in Python 3.12
**Remediation**:
```python
# WRONG (existing pattern):
loop = asyncio.get_event_loop()
return await loop.run_in_executor(None, _run)

# CORRECT (new pattern):
loop = asyncio.get_running_loop()
return await loop.run_in_executor(None, _run)
```
**Priority**: Must fix in implementation.

### F002 — Auctioneer report access control scope (🟡 MEDIUM)

**Location**: T020, `admin_auctioneer.py` `_resolve_auctioneer_id`
**Details**: `_resolve_auctioneer_id(current_user, auctioneer_user_id)` — when `current_user.role != "super_admin"`, the function returns `current_user.id` (ignoring the `auctioneer_user_id` param). Verified in `admin_auctioneer.py` lines 52-63. This correctly prevents one auctioneer from viewing another's report. No change needed to logic — but T020 must explicitly document this and add a test for the case where a non-super-admin passes someone else's `auctioneer_user_id`.
**Remediation**: Add explicit comment in implementation; add test T030b covering "auctioneer cannot view other auctioneer's report".

### F003 — CPU-bound chart generation must use executor (🟡 MEDIUM)

**Location**: T007 `event_report_service.py`, T005 `chart_utils.py`
**Details**: The plan correctly notes running WeasyPrint in executor, but does not explicitly state that matplotlib figure creation is also CPU-bound and must be run in executor (or the entire `_build_report_data_and_charts` method must be placed in the executor call). With 5-7 charts per event report, chart generation can take 1-3 seconds of CPU which would block the async event loop.
**Remediation**: Either (a) generate all charts inside the `_run()` closure that's already in `run_in_executor`, or (b) run `matplotlib.pyplot.figure()` calls in executor separately. Option (a) is simpler — put all chart + PDF generation in a single sync function inside the executor.

### F004 — No contract tests planned (🟡 MEDIUM)

**Location**: `tasks.md` — no test tasks
**Details**: Constitution mandates 80%+ coverage and contract tests for critical API paths. All 3 new PDF endpoints require at minimum: auth test (401 without token), role test (403 wrong role), success test (200 + content-type: application/pdf + non-empty body).
**Remediation**: Add T028-T030 (see remediation below).

### F005 — chart_utils.py YAGNI (🟡 MEDIUM)

**Location**: T005 `chart_utils.py`
**Details**: `chart_utils.py` proposes a module for chart generation utilities shared across services. But only `event_report_service.py` generates charts — auctioneer and bid card services do not. A separate module for code used by only one consumer violates YAGNI.
**Remediation**: Remove `chart_utils.py` task. Inline chart generation private methods into `event_report_service.py` (e.g., `_generate_revenue_chart(data) → str`, `_generate_cashflow_chart(data) → str`, etc.). The `_fetch_image_as_base64` helper IS shared by bid cards (item images), so it goes into a focused `image_utils.py` or is inlined separately. See remediation.

### F006 — qr_utils.py over-engineering (🟢 LOW)

**Location**: T006 `qr_utils.py`
**Details**: A single-function module with one caller is unnecessary abstraction.
**Remediation**: Inline `generate_qr_base64` into `bid_card_service.py` as a module-level function.

### F007 — Loading overlay duplication (🟢 LOW)

**Location**: T011 `DownloadReportButton.tsx`
**Details**: Needs verification — search for existing overlay/loading patterns in the admin PWA.
**Remediation**: Before implementing, check `frontend/fundrbolt-admin/src/components/` for existing full-page loading overlay. If one exists, use it. If not, `DownloadReportButton` owning the overlay is fine (it's the only consumer for now).

### F008 — Confusing bid card button label logic (🟢 LOW)

**Location**: T017 `AuctionItemsIndexPage.tsx`
**Details**: Two different button labels ("Print Bid Cards" vs "Print All") depending on selection state creates confusing UX.
**Remediation**: Single "Print Bid Cards" label always. When ≥1 selected: label becomes "Print X Bid Cards". When 0 selected: button still says "Print Bid Cards" (will print all, clarified by tooltip/helpertext).

### F009 — Missing TypeScript interface (🟢 LOW)

**Location**: T010 `reportService.ts`
**Details**: `BidCardRequest` used in `downloadBidCards` signature needs an exported TypeScript interface mirroring the Pydantic model, otherwise TypeScript strict mode will complain and the type won't be reusable.
**Remediation**: Add to `reportService.ts`:
```typescript
export type LabelSize = "2x3" | "2x4" | "3x3" | "3x5";
export interface BidCardRequest {
  item_ids?: string[] | null;
  label_size: LabelSize;
}
```

---

## Remediations Required

### R001 — Use asyncio.get_running_loop() (F001) — **Must fix**
**Severity**: High — will cause DeprecationWarning in Python 3.12 and mypy issues
**Action**: In all 3 new service files, replace any `asyncio.get_event_loop()` with `asyncio.get_running_loop()`.

### R002 — Restructure chart/image utilities (F003 + F005 + F006) — **Must fix**
**Severity**: Medium — performance + YAGNI
**Action**: Remove T005 (`chart_utils.py`), remove T006 (`qr_utils.py`). Instead:
- Create `backend/app/services/report_utils.py` with only `async _fetch_image_as_base64(url: str) -> str | None` — this IS shared by event report (NPO logo) and bid cards (item images)
- Inline all matplotlib chart methods as private `_generate_*_chart(...)` methods of `EventReportService`
- Inline `generate_qr_base64` as a module-level function in `bid_card_service.py`
- Run ALL chart generation + WeasyPrint inside a single `asyncio.get_running_loop().run_in_executor(None, _sync_fn)` call in event_report_service

### R003 — Add contract tests for PDF endpoints (F004) — **Must fix**
**Severity**: Medium — constitution requirement
**Action**: Add test tasks:
- T028: `backend/app/tests/contract/test_admin_reports_api.py` — event summary: 401 unauthenticated, 403 wrong role (npo_staff), 200 + content-type header + non-empty body (npo_admin)
- T029: bid cards: 401, 403 (wrong role), 422 (no items), 200 (npo_admin with mock items)
- T030: auctioneer report: 401, 403 (npo_admin), 200 (auctioneer), 403 "auctioneer cannot see other's report"

### R004 — Fix bid card button label UX (F008) — **Should fix**
**Severity**: Low — UX clarity
**Action**: Update T017 description to use single consistent label pattern.

### R005 — Export TypeScript BidCardRequest interface (F009) — **Should fix**
**Severity**: Low — type safety
**Action**: Update T010 to include `LabelSize` type and `BidCardRequest` interface exports.

---

## Items Deferred (Will Not Remediate)

| ID | Finding | Reason |
|----|---------|--------|
| F007 | Loading overlay reuse | Will check at implementation time; DownloadReportButton can own the overlay if no shared component exists. Not worth pre-emptive complexity. |

---

## Conclusion

**Plan and tasks are sound overall.** Three remediations are required before implementation:
1. **R001** — async API fix (asyncio.get_running_loop)
2. **R002** — simplify utilities (remove chart_utils.py and qr_utils.py, inline + consolidate into report_utils.py)
3. **R003** — add contract tests (3 test files, covers 401/403/200 for all endpoints)

Two low-severity remediations are recommended:
4. **R004** — UX button label fix
5. **R005** — TypeScript interface exports

None of the findings constitute a blocking security issue. Access control is correctly delegated to existing `_verify_event_access` and `_resolve_auctioneer_id` helpers.

**Green-light for implementation** after applying R001-R005.
