# Feature Specification: Beta-Readiness Integration Test Suite

**Feature Branch**: `047-integration-testing-beta`
**Created**: 2026-05-30
**Status**: Draft
**Input**: User description: "Beta-readiness integration test suite covering every critical donor, admin, auctioneer, and staff flow before opening fundrbolt to beta users."

## Clarifications

### Session 2026-05-30

- Q: Email capture mechanism for automated tests → A: Add a captured-outbox (MailHog, Mailpit, or database outbox table read via test helper) as part of this feature; real Azure Communication Services stays disabled in test environments.
- Q: Test isolation strategy → A: Hybrid. The seed runs once per suite invocation; each scenario that mutates state provisions its own scoped entities (unique event, user, ticket package, auction item, etc.) via test helpers and does not depend on or modify shared seeded fixtures. Read-only scenarios may use seeded fixtures directly.
- Q: Staging data isolation for the nightly run → A: Dedicated automation tenant on staging. The nightly suite operates inside a single reserved nonprofit organization (and all of its events, users, and related data) on staging. The nightly run wipes and reseeds only this tenant; the rest of staging is untouched and remains available for humans.
- Q: Browser engine matrix for automated browser scenarios → A: Chromium for the full suite, plus a small mobile-Safari (Webkit) subset covering progressive web application install and offline behavior, 375-pixel responsive layout checks, ticket checkout, and sign-in. Firefox is not automated.
- Q: Nightly run summary delivery → A: Two channels. (1) After every nightly run — pass or fail — a Microsoft Teams message is posted to a dedicated engineering channel summarizing pass/fail per flow with a link to the full GitHub Actions run and traces. (2) On any failure, a GitHub Issue is automatically opened (one issue per failing flow, deduplicated by flow name so repeat failures update an existing open issue instead of creating a new one).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Critical-path pull request gate (Priority: P1)

As a fundrbolt engineer, when I open a pull request I get fast, automated confirmation that the highest-risk user journeys — donor sign-up, sign-in, event registration, ticket purchase, bid placement, check-in, and admin event creation — still work end-to-end, so I can merge with confidence and never ship a regression in a core revenue or trust-critical flow.

**Why this priority**: This is the single biggest safety net before beta. If only this story ships, the platform already has automated protection on the flows that directly produce revenue (tickets, bids) and on the flows that determine first-impression trust (sign-up, sign-in, check-in). Every other story increases coverage but does not add a new safety net of comparable value.

**Independent Test**: Open a pull request that intentionally breaks one of the seven critical flows (for example, returns a 500 from the ticket checkout endpoint). The pull request check must fail within 8 minutes with a reproducible failure artifact identifying the broken flow.

**Acceptance Scenarios**:

1. **Given** a pull request that does not change any covered flow, **When** the critical-path suite runs, **Then** it completes in under 8 minutes and reports success.
2. **Given** a pull request that breaks ticket checkout, **When** the critical-path suite runs, **Then** the checkout scenario fails, the pull request is blocked from merging, and an artifact is published that lets a developer reproduce the failure locally.
3. **Given** a pull request that breaks bid placement, **When** the critical-path suite runs, **Then** the bidding scenario fails with a clear message that points to the broken behavior, not the test harness.

---

### User Story 2 - Nightly comprehensive regression sweep (Priority: P2)

As an engineering lead, every night I get a comprehensive automated regression sweep across every donor, admin, auctioneer, and staff flow running against the staging environment, so that issues introduced by the day's merged changes are surfaced before the next business day instead of being discovered by beta users.

**Why this priority**: The pull request gate is fast but narrow. The nightly suite is the broad safety net that catches integration problems, environment-specific issues, and flows that are too slow or too involved to run on every pull request. It is what allows us to honestly tell beta users that the application has been exercised end-to-end recently.

**Independent Test**: Trigger the nightly suite manually against staging. Confirm that every flow listed in the feature scope is executed, results are archived, failures include enough diagnostic context to reproduce, and a single summary is delivered to the on-call channel.

**Acceptance Scenarios**:

1. **Given** the nightly schedule fires, **When** the full suite runs against staging, **Then** every flow in the feature scope is exercised and the run completes successfully or fails with per-flow diagnostics.
2. **Given** a flow fails in the nightly run, **When** an engineer opens the result the next morning, **Then** they can identify which user journey broke, which step within it failed, and access a reproducible artifact without re-running the suite.
3. **Given** the nightly run succeeds, **When** the engineering lead reviews the morning summary, **Then** they can confirm in under one minute that every covered flow passed.

---

### User Story 3 - Repeatable known-state test environment (Priority: P2)

As any engineer or QA reviewer, I can bring up a complete fundrbolt environment with a single command and a single seed step that produces a known, idempotent set of organizations, events, users in every role, ticket packages, auction items, seating, sponsors, and reference data, so that automated tests, manual exploration, and bug reproduction all start from an identical baseline.

**Why this priority**: Without this, automated tests are flaky, manual testing is inconsistent, and bug reports are hard to reproduce. This story is what makes Stories 1, 2, and 4 honest — it is the deterministic foundation they all depend on. It is also independently valuable for daily development even before the test suite exists.

**Independent Test**: Run the environment-bringup command and the seed step from a clean checkout. Verify the database contains the expected fixtures. Re-run the seed step; verify it succeeds and the database state is identical (no duplicates, no errors). Stop and restart; verify the same state is produced again.

**Acceptance Scenarios**:

1. **Given** a clean machine with no prior fundrbolt state, **When** an engineer runs the environment-bringup and seed commands, **Then** within a single setup pass they have a running stack and a fully populated database covering every entity needed by the test suite.
2. **Given** a populated environment, **When** the seed step is run a second time, **Then** it completes without error and the resulting state is identical to the first run.
3. **Given** any automated test scenario in this feature, **When** it runs against the seeded environment, **Then** it finds the fixtures it depends on without any per-test setup beyond the seed.

---

### User Story 4 - Manual pre-beta sign-off checklist (Priority: P3)

As an engineering lead preparing to open the platform to beta users, I work through a documented manual checklist that exercises the items automation cannot reliably validate — real payment processor sandbox transactions, real email deliverability across major providers, Apple Pay and Google Pay rendering, real device push notifications, real social login providers, and PWA install on physical iOS and Android devices — so that beta launch is a deliberate, evidenced decision rather than a guess.

**Why this priority**: Automation will catch most regressions but will never catch real-device, real-provider, real-money behavior. This story turns the remaining risk into a controlled, repeatable process. It is P3 because it follows the automated suite in importance, but it is mandatory before beta opens.

**Independent Test**: A new team member with no prior context can open the checklist, follow it from top to bottom against staging, and produce a signed-off result without asking clarifying questions about what to check or what counts as a pass.

**Acceptance Scenarios**:

1. **Given** the checklist exists and staging is healthy, **When** a reviewer completes every item, **Then** they have unambiguous pass or fail evidence for each item without needing to interpret instructions.
2. **Given** a checklist item fails, **When** the reviewer records the failure, **Then** the format makes the failure actionable for an engineer (what was tried, what was expected, what happened).
3. **Given** the full checklist passes, **When** the engineering lead reviews it, **Then** they have written evidence sufficient to authorize beta launch.

---

### Edge Cases

- A pull request modifies only documentation or non-application files: the critical-path suite must still run (and pass quickly) so the result remains a reliable merge gate, even when no application code changed.
- The seeded test environment includes mutable entities (events change status, registrations are created, bids are placed). Shared seeded fixtures MUST be treated as read-only by scenarios; any scenario that mutates state MUST provision its own scoped entities so tests cannot pollute each other.
- A flow under test depends on time (event status transitions, session expiry warnings, auction close, rate-limit windows). The suite must control or simulate time rather than waiting in real time, and must not be sensitive to the wall-clock hour at which it runs.
- A test interacts with the stub payment gateway and the gateway returns a synthetic webhook out of order or twice. The flow under test must still terminate in a correct, idempotent final state, and the test must assert that.
- The captured-email mechanism receives messages from multiple parallel tests. Each test must be able to find its own email without false matches against another test's mail.
- Socket.IO or polling-driven assertions (live dashboard, donor table view, outbid notifications) are inherently asynchronous. The suite must wait deterministically for the asserted state with a bounded timeout, not sleep for a fixed interval.
- A nightly run partially fails after consuming significant time. The result must still publish per-flow results for everything that did run, not abort the whole report.
- A flow involves a destructive admin action (delete sponsor, deactivate user, revoke ticket). The destructive scenario MUST run against its own scoped entities provisioned for that scenario, never against shared seeded fixtures.
- The application requires consent to the current terms of service before most actions. Whenever a covered flow's pre-existing user account predates a terms version bump, the test must handle the re-acceptance step without treating it as a failure of the flow under test.
- The same end-to-end behavior is implemented in two separate user interfaces (admin PWA and donor PWA). The suite must cover both, and a failure must clearly identify which interface broke.

## Requirements *(mandatory)*

### Functional Requirements

**Coverage — Authentication & Onboarding**

- **FR-001**: The suite MUST verify that a new donor can register, receive a verification email, verify the email, and reach an authenticated state.
- **FR-002**: The suite MUST verify sign-in, sign-out, password reset request and confirmation, and rejection of expired or reused reset tokens.
- **FR-003**: The suite MUST verify that sign-in is rate-limited to five attempts per fifteen minutes per source and that password reset requests are rate-limited to three per hour per source.
- **FR-004**: The suite MUST verify that an authenticated session warns the user before expiring and refreshes successfully when the user continues to act.
- **FR-005**: The suite MUST verify that legal documents must be accepted at registration and that a version bump forces re-acceptance on the next protected action.
- **FR-006**: The suite MUST verify that a new user can submit a nonprofit organization application and that a super administrator can approve it, after which the applicant gains organization administrator privileges.
- **FR-007**: The suite MUST verify the social login callback path at the API contract level, including identity linking to an existing account by email and the ability for a user who has no local password to sign in via the social path.

**Coverage — Admin Event Setup**

- **FR-008**: The suite MUST verify that an organization administrator or event coordinator can create an event and that branding is inherited from the organization.
- **FR-009**: The suite MUST verify the event status workflow (Draft, Scheduled, In Progress, Complete) and that invalid transitions are rejected.
- **FR-010**: The suite MUST verify event media upload, sponsor management, food option management, ticket package management (including custom options and promo codes), and event link management.
- **FR-011**: The suite MUST verify single auction item creation and bulk auction item import from a comma-separated file, including per-row error reporting on invalid rows.
- **FR-012**: The suite MUST verify seating table customization, including custom per-table capacity, table naming, table captain assignment, and rejection of capacity reductions below current occupancy.
- **FR-013**: The suite MUST verify checklist template application, run-of-show scheduling, and revenue generator creation and winner selection.
- **FR-014**: The suite MUST verify event duplication, including that food, ticket packages, sponsors, and media are deep-copied while registrations, ticket sales, and bids are not.

**Coverage — Donor Registration & Tickets**

- **FR-015**: The suite MUST verify that a donor can register guests for an event, including selecting meal options per guest and recording dietary notes.
- **FR-016**: The suite MUST verify ticket browsing, cart manipulation, valid promo code application, invalid promo code rejection, and custom option price recalculation.
- **FR-017**: The suite MUST verify checkout through the stub payment gateway, including receipt generation, confirmation email capture, and the success state.
- **FR-018**: The suite MUST verify checkout error paths, including inventory exhaustion, idempotent handling of duplicate submissions, and abandoned-cart recovery.
- **FR-019**: The suite MUST verify alternate payment recording paths (cash, check, donor-advised fund) that do not invoke the payment gateway.
- **FR-020**: The suite MUST verify ticket self-assignment, secondary-guest assignment, transfer to another recipient, and revocation.
- **FR-021**: The suite MUST verify the Donate Now page for one-time and recurring donations, support wall entry, and configurable preset amounts.

**Coverage — Auction Bidding**

- **FR-022**: The suite MUST verify auction item browsing, filtering by type, search, and watch list toggling.
- **FR-023**: The suite MUST verify bid placement, rejecting bids below the minimum, accepting bids at or above the minimum, and silent-auction maximum-bid automatic increment when outbid.
- **FR-024**: The suite MUST verify that multiple concurrent bidders on the same item produce a single correct winner with no lost bids and a consistent bid history.
- **FR-025**: The suite MUST verify the administrator quick-bid entry workflow by paddle number, including validation when the paddle is unassigned or a referenced table is missing.
- **FR-026**: The suite MUST verify auction close behavior, including the winning bidder being marked, outbid notifications being emitted to losers, and winner notifications being emitted.
- **FR-027**: The suite MUST verify bid import from a comma-separated file with row-level error reporting and an audit record of the import.

**Coverage — Check-In, Live Event, Dashboards**

- **FR-028**: The suite MUST verify staff check-in by name search and by scanned identifier, including assignment of bidder number and table, and rejection of duplicate check-ins.
- **FR-029**: The suite MUST verify bulk check-in for multiple guests in a single action.
- **FR-030**: The suite MUST verify that live event dashboards reflect new arrivals, ticket revenue, and top bids within five seconds of the underlying change.
- **FR-031**: The suite MUST verify the auctioneer live view, including current item display, current high bid display, paddle entry, and advancing to the next item.
- **FR-032**: The suite MUST verify that after an event begins, the donor interface displays the donor's table number, captain badge, and fellow guests.
- **FR-033**: The suite MUST verify event analytics, including revenue by source, registrations against capacity, top sponsors, and auction performance.
- **FR-034**: The suite MUST verify in-application and push notifications (using a mock subscription) for auction-closing reminders and item-won outcomes.

**Coverage — Imports & Admin Utilities**

- **FR-035**: The suite MUST verify user, registration, ticket-sales, and bid imports from comma-separated files, with row-level error reporting and an audit log entry for each import.
- **FR-036**: The suite MUST verify user management actions: role change, deactivation, reactivation, and forced password reset, each producing an audit log entry.

**Coverage — Cross-Cutting Concerns**

- **FR-037**: The suite MUST verify, programmatically rather than by browsing every page, that each role receives the correct permitted or denied response on a representative protected endpoint for every protected route group.
- **FR-038**: The suite MUST verify the data export request and the account deletion request, including the deletion grace period.
- **FR-039**: The suite MUST verify cookie consent for both anonymous and authenticated users, including consent revocation.
- **FR-040**: The suite MUST verify progressive web application install prompting, offline access to a cached event home, and the update banner appearing after a new release.
- **FR-041**: The suite MUST verify that key pages remain usable at a 375-pixel viewport width.
- **FR-042**: The suite MUST verify that key pages produce no serious or critical accessibility violations on automated audit.
- **FR-043**: The suite MUST verify that simulated server errors render a friendly error boundary rather than a blank screen.

**Operational Requirements**

- **FR-044**: A clearly designated critical-path subset of the suite MUST run automatically on every pull request and complete within eight minutes including environment bringup.
- **FR-045**: The full suite MUST run automatically on a nightly schedule against the staging environment and publish a per-flow summary, regardless of whether individual flows fail.
- **FR-045a**: On staging, the suite MUST operate exclusively inside a dedicated automation tenant (a single reserved nonprofit organization and all entities scoped to it). The nightly run MUST wipe and reseed only this tenant at start and MUST NOT read or modify any data outside it. Other tenants on staging remain available for human use and demos.
- **FR-045b**: After every nightly run (regardless of pass or fail), the suite MUST post a single summary message to a dedicated Microsoft Teams engineering channel. The message MUST include per-flow pass/fail status and a link to the full run with downloadable failure artifacts.
- **FR-045c**: When one or more flows fail in a nightly run, the suite MUST automatically open or update a GitHub Issue per failing flow. Issues MUST be deduplicated by flow name so that repeated failures of the same flow update the existing open issue (with a new comment containing the latest run link) rather than opening a duplicate. Issues for a flow that subsequently passes MUST be either auto-closed or clearly marked as recovered.
- **FR-046**: When any automated scenario fails, the suite MUST publish a reproducible failure artifact (sufficient to identify the broken step and re-run the scenario locally) and MUST surface a clear pointer to that artifact from the run summary.
- **FR-047**: The suite MUST be runnable locally with a single command that brings up dependencies, applies the seed, runs the chosen subset, and tears down cleanly.
- **FR-047a**: Automated browser scenarios MUST run on a Chromium engine for the full suite. A designated mobile-Safari (Webkit) subset MUST additionally run — covering, at minimum, progressive web application install and offline behavior, 375-pixel responsive layout checks on key pages, ticket checkout, and sign-in. Firefox coverage is out of scope for automation.
- **FR-048**: All automated checkout scenarios MUST use the stub payment gateway and MUST NOT depend on any real payment processor.
- **FR-049**: All automated email-dependent scenarios MUST read messages from a captured-outbox provided in test environments (for example, MailHog, Mailpit, or a database-backed outbox accessed via a test helper), MUST NOT depend on real email delivery, and MUST NOT invoke the production Azure Communication Services sender. Provisioning this captured outbox in local and continuous-integration environments is in scope for this feature.
- **FR-049a**: Each automated scenario that asserts on email content MUST be able to retrieve its own message (by recipient, subject, or correlation identifier) without false matches against messages produced by other parallel scenarios.
- **FR-050**: A single, idempotent seed step MUST produce all fixtures required by the suite as read-only baseline data, including users for every role, organizations in every relevant state, events in upcoming, live, and past states, ticket packages including ones with custom options and promo codes, auction items, seating tables, sponsors, and reference data such as legal documents and meal options. The seed runs once per suite invocation, not per scenario.
- **FR-050a**: Test helpers MUST be provided that allow any scenario to provision its own scoped entities (event, user, ticket package, auction item, registration, etc.) on demand, so that scenarios which mutate state never depend on or modify shared seeded fixtures.
- **FR-051**: Scenarios that depend on time (status transitions, expiry warnings, auction close, rate-limit windows) MUST control or simulate time rather than waiting in real time.
- **FR-052**: A manual smoke checklist MUST exist as a versioned document, MUST be unambiguous to a reviewer with no prior context, and MUST cover the items declared out of scope for automation: real payment processor sandbox transactions, real email deliverability across major consumer providers, Apple Pay and Google Pay button rendering, real device push notifications on iOS and Android, real social login through external providers, and progressive web application install on physical iOS and Android devices.
- **FR-053**: The manual checklist MUST be completed against staging and signed off before beta opens.

### Key Entities

- **Covered Flow**: A named user journey from the feature scope (for example, "donor sign-up and email verification" or "ticket checkout with promo code"). Each covered flow has a priority tier (critical-path or full-suite), an owning role, and at least one automated scenario verifying it.
- **Test Scenario**: A single automated check exercising one covered flow. Each scenario produces a pass or fail result and, on failure, a reproducible artifact.
- **Seed Fixture Set**: The known set of organizations, users, events, ticket packages, auction items, seating, sponsors, and reference data established by the seed step. Every scenario depends on this set without performing its own setup beyond per-test isolation.
- **Run Result**: The aggregated outcome of a suite invocation, comprising per-scenario results, per-flow rollups, run-level pass or fail, and links to failure artifacts.
- **Manual Checklist Item**: A single, unambiguous manual verification step in the pre-beta checklist, with an expected outcome and a place to record evidence and pass or fail status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The critical-path subset of the suite, including environment bringup, completes in under eight minutes on the continuous integration platform on at least nine of every ten runs.
- **SC-002**: The critical-path subset covers, at minimum, donor sign-up, donor sign-in, event registration, ticket purchase, auction bid placement, guest check-in, and administrator event creation, with at least one passing scenario per flow.
- **SC-003**: The full nightly suite covers every functional requirement in the Coverage sections of this specification, executes against the staging environment on a nightly schedule, and publishes a per-flow result summary on every run.
- **SC-004**: When an automated scenario fails, an engineer can reproduce the failure locally from the published artifact in under fifteen minutes on at least nine of every ten failures.
- **SC-005**: The seed step is idempotent: running it twice in succession against a previously seeded environment produces no errors and an identical final state.
- **SC-006**: A new engineer can bring up the full local environment, run the seed, and execute the critical-path subset using only documented commands, without ad-hoc assistance, in under thirty minutes.
- **SC-007**: The documented manual checklist contains at minimum the items declared out of scope for automation (real payment processor, real email deliverability across major providers, Apple Pay and Google Pay rendering, real device push notifications, real social login providers, and progressive web application install on physical devices), and a reviewer with no prior context completes it end-to-end against staging in under three hours.
- **SC-008**: Before beta opens, a completed manual checklist exists with a recorded reviewer, a completion date, and an unambiguous pass or fail decision for every item.
- **SC-009**: After this feature ships, regressions introduced by merged changes in any flow covered by the suite are detected by automation before reaching beta users on at least four of every five regressions, measured over the first ninety days of beta.
- **SC-010**: After this feature ships, the median time from a regression being introduced in a covered flow to it being detected by automation is under one calendar day.

## Assumptions

- The existing stub payment gateway is a faithful enough substitute for the production payment processor that flows verified against it are representative of production behavior at the application-logic level. Real-processor edge cases are deliberately addressed by the manual checklist.
- A captured-outbox (e.g., MailHog, Mailpit, or a database-backed outbox) provisioned by this feature is sufficient to assert email content and triggering in local and continuous-integration environments. Real deliverability across consumer mail providers is deliberately addressed by the manual checklist.
- The staging environment is representative of production for the purpose of nightly verification: same application code, same configuration shape, equivalent integrations, and refreshed-enough data.
- A single canonical seed step is acceptable for both automated tests and manual exploration, and seeded fixtures are treated as read-only baseline data by automated scenarios. Any scenario that requires mutating state provisions its own scoped entities via test helpers; the seed itself is never re-run mid-suite to recover.
- Race-condition and concurrency scenarios (notably concurrent bidding) are more reliably and cheaply verified at the application-programming-interface level than through the browser. The suite is permitted to verify them that way without sacrificing scope.
- The progressive web application install, offline, and update behaviors can be verified deterministically by the browser automation already used elsewhere; physical-device install remains in the manual checklist.
- Visual regression coverage on a small number of critical screens is acceptable for beta; broader visual regression is intentionally out of scope.
- The team is willing to accept that approximately one in five pre-beta regression bugs in covered flows may still reach beta users (per SC-009), with the manual checklist and beta itself acting as the additional safety net.
