# Feature Specification: Production Beta Deployment

**Feature Branch**: `046-beta-deployment`
**Created**: 2026-05-11
**Status**: Draft
**Input**: User description: "beta-deployment"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Beta Testers Can Access the Platform (Priority: P1)

A beta tester is given a URL and is able to open the Admin PWA or Donor PWA from any device (phone, tablet, desktop) over the public internet. Anyone who knows the URL can reach the app and attempt to sign up or sign in — there is no invitation gate or allow-list. They do not need VPN access, special network configuration, or a local development environment.

**Why this priority**: Without public accessibility, no beta testing can happen. Every other user story depends on this being true first.

**Independent Test**: Can be fully tested by sharing the URL with someone outside the development network and confirming they can sign in and use the app.

**Acceptance Scenarios**:

1. **Given** an invited beta tester outside the developer's network, **When** they navigate to the Admin PWA URL, **Then** the sign-in page loads within 3 seconds on a standard mobile connection.
2. **Given** an invited beta tester, **When** they navigate to the Donor PWA URL, **Then** the sign-in page loads and they can complete a full donor flow (register, browse event, place bid).
3. **Given** the landing site URL, **When** any anonymous visitor opens it, **Then** the landing page loads and all links and CTAs are functional.
4. **Given** any of the public URLs, **When** opened in a browser, **Then** the connection is encrypted (HTTPS) and no security warnings are shown.
5. **Given** all public URLs, **When** accessed, **Then** each app loads correctly on its own dedicated subdomain (e.g., `app.fundrbolt.com`, `give.fundrbolt.com`, `fundrbolt.com`).

---

### User Story 2 - Developer Deploys Code Updates Without Manual Server Work (Priority: P1)

When the developer merges a code change, the updated version of the app is automatically built and published to the live environment without the developer manually copying files, restarting servers, or running commands on a production machine.

**Why this priority**: Manual deployments are error-prone and don't scale. Automated deployment is the foundation of a sustainable beta cycle.

**Independent Test**: Can be fully tested by merging a trivial code change (e.g., a wording update) and confirming it appears live within a few minutes with no manual intervention.

**Acceptance Scenarios**:

1. **Given** the developer merges code to the main branch, **When** the merge completes, **Then** an automated process starts building and deploying the change.
2. **Given** a successful automated deployment, **When** the developer checks the live app, **Then** the change is reflected without any manual steps.
3. **Given** the deployment process, **When** it runs, **Then** database schema changes are applied automatically before the new app version goes live.
4. **Given** a failed deployment, **When** the deployment process detects the failure, **Then** the previously working version remains live and the developer receives a notification.
5. **Given** the backend and its background task processors, **When** a deployment runs, **Then** all three components (API server, async task worker, scheduled task runner) are updated to the new version.

---

### User Story 3 - Developer Knows Immediately When Something Breaks (Priority: P2)

When an unhandled error occurs in production — whether caused by an edge case in new code, an unexpected data state, or an external service failure — the developer is notified promptly with enough context to diagnose and fix the issue, without waiting for a user to report it.

**Why this priority**: Undetected errors erode beta tester trust. Early warning enables fast fixes and protects the feedback cycle.

**Independent Test**: Can be fully tested by intentionally triggering a known error path in the live app and confirming the developer receives an alert with a stack trace within 5 minutes.

**Acceptance Scenarios**:

1. **Given** an unhandled exception in the backend API, **When** it occurs in production, **Then** the developer receives an alert with the error type, stack trace, and the request that triggered it.
2. **Given** an unhandled error in either frontend app, **When** it occurs in a beta tester's browser, **Then** the error is captured and reported to the developer with enough context to reproduce it.
3. **Given** any of the public URLs, **When** the service becomes unavailable, **Then** the developer receives an uptime alert within 10 minutes.
4. **Given** an error alert, **When** the developer reviews it, **Then** they can see how many users were affected and how frequently it is occurring.

---

### User Story 4 - Developer Can See Platform Health and Usage at a Glance (Priority: P2)

The developer can open a dashboard and immediately see whether the platform is healthy, how much traffic it is handling, whether background tasks are processing successfully, and whether any component is degraded — without needing to SSH into a server or scan through raw log files.

**Why this priority**: Reactive firefighting during beta wastes time. A health dashboard enables proactive intervention and informed iteration.

**Independent Test**: Can be fully tested by opening the monitoring dashboard while the live app is in use and confirming that request counts, error rates, and background task activity are all visible and updating in near-real-time.

**Acceptance Scenarios**:

1. **Given** the developer opens the monitoring dashboard, **When** the platform is receiving normal traffic, **Then** they can see current request rate, error rate, and response time broken down by endpoint.
2. **Given** the developer opens the monitoring dashboard, **When** background tasks are running, **Then** they can see whether tasks are completing successfully or failing.
3. **Given** the developer needs to investigate a past incident, **When** they search the logs, **Then** they can filter by time range, severity level, and the user or request involved.
4. **Given** any infrastructure component (API, database, cache, task queue), **When** it becomes unavailable or degraded, **Then** the health dashboard reflects the degraded state.

---

### User Story 5 - Hosting Costs Stay Predictable During Beta (Priority: P3)

The developer is not surprised by a large cloud bill at the end of the month. Costs scale with actual usage rather than being charged for idle capacity, and the developer has visibility into the projected monthly spend at any time.

**Why this priority**: Cost predictability is important for a pre-revenue product. Unexpected bills can halt development. This is lower priority than getting the system live and observable.

**Independent Test**: Can be validated by reviewing the first month's invoice and confirming it falls within the expected $20–45/month range for beta-scale traffic.

**Acceptance Scenarios**:

1. **Given** the platform is deployed but receiving no traffic (e.g., overnight), **When** the developer checks usage, **Then** compute costs during idle periods are minimal (scale-to-zero behaviour).
2. **Given** the platform is running normally, **When** the developer reviews the cost dashboard, **Then** they can see current and projected monthly spend.
3. **Given** the platform at beta scale (<100 concurrent users), **When** the month-end bill arrives, **Then** total infrastructure cost is within the $20–45/month range.

---

### Edge Cases

- What happens when a deployment fails mid-way — is the old version still serving traffic, or is the platform left in a broken state?
- What happens when the scheduled task runner restarts mid-execution — are tasks re-queued or silently dropped?
- What happens when the database is temporarily unreachable — does the API return a clear error rather than hanging?
- What happens when a beta tester tries to access an endpoint that requires authentication and their session has expired — are they redirected to sign-in rather than seeing a raw error?
- What happens when two deployments are triggered in rapid succession — does the second wait for the first to finish, or can they run in parallel?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: All three apps (Admin PWA, Donor PWA, Landing Site) MUST be publicly accessible to any internet user who knows the URL, via dedicated HTTPS URLs. No invitation gate, IP allow-list, or access code is required to reach the apps.
- **FR-002**: All three apps MUST load over an encrypted connection. Plain HTTP MUST redirect to HTTPS automatically.
- **FR-003**: Each app MUST be accessible at a stable, human-readable subdomain (e.g., `app.fundrbolt.com`, `give.fundrbolt.com`, `fundrbolt.com`).
- **FR-004**: The backend API MUST be accessible from the frontend apps via a stable HTTPS endpoint.
- **FR-005**: The system MUST automatically deploy each component (API server, background task worker, scheduled task runner, Admin PWA, Donor PWA, Landing Site) when source files belonging to that component are merged to the main branch. A change to one component MUST NOT trigger an unnecessary redeploy of unrelated components.
- **FR-006**: The deployment process MUST apply pending database schema changes before the new application version begins serving traffic.
- **FR-007**: If a deployment fails, the previously deployed version MUST continue serving traffic uninterrupted.
- **FR-008**: The API server, async task worker, and scheduled task runner MUST all be kept in sync — they MUST always run the same version of the application code.
- **FR-009**: The scheduled task runner MUST run as a single instance at all times to prevent duplicate task execution (e.g., sending the same notification twice).
- **FR-010**: The system MUST capture and report unhandled errors in the backend API, including stack trace and the request context, to an external error tracking service.
- **FR-011**: The system MUST capture and report unhandled errors in the Admin PWA and Donor PWA to an external error tracking service.
- **FR-012**: The system MUST send an alert to the developer when any of the public URLs become unreachable.
- **FR-013**: The system MUST provide a metrics dashboard showing request rate, error rate, response time, and background task activity.
- **FR-014**: Application logs MUST be searchable and filterable by time range and severity level.
- **FR-015**: Compute resources MUST scale down to zero during periods of no traffic to minimise idle costs. The resulting cold-start latency on the first request after an idle period (up to 60 seconds) is accepted; the 5-second load time target (SC-001) applies only once the platform is warm.
- **FR-016**: All application secrets (database credentials, API keys, signing keys) MUST be stored in a secrets manager and MUST NOT be embedded in source code or container images.
- **FR-017**: The backend MUST expose a health check endpoint that returns the status of all critical dependencies (database, cache, email service).
- **FR-018**: Only a single production environment is in scope. No permanent staging environment is required. Automated CI tests running against every pull request serve as the pre-production validation gate.

### Assumptions

- The custom domain `fundrbolt.com` is already registered and DNS can be updated by the developer.
- The existing automated test suite is sufficient for CI gating; no additional tests are in scope for this feature.
- Real payment processing remains stubbed; this deployment does not need to satisfy PCI compliance requirements.
- Beta scale is assumed to be fewer than 100 concurrent users and fewer than 1,000 daily active users.

## Clarifications

### Session 2026-05-11

- Q: How should the spec resolve the tension between the 5-second load time target (SC-001) and scale-to-zero cold starts (FR-015/SC-004)? → A: Cold-start exception — scale-to-zero is acceptable; the first request after inactivity may take up to 60 seconds; the 5-second target applies only to warm requests.
- Q: What access control model applies for the beta — open URL, invite-only, or URL-obscured? → A: Open URL — anyone who knows the URL can reach the app and attempt to sign up or sign in; no invitation gate.
- Q: Is a staging environment in scope alongside production, or is production the only deployed environment for beta? → A: Production only — a single production environment; CI automated tests on PRs serve as the pre-production gate; no staging environment.
- Q: Should all components redeploy on every merge, or only the component whose source files changed? → A: Path-filtered per component — each component only redeploys when its own source files change.
- Q: What channel should production alerts (errors, uptime failures) be delivered to? → A: Email — all alerts delivered to the developer's email address.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An invited beta tester with no prior access can open the Admin PWA or Donor PWA in a browser and reach the sign-in screen within 5 seconds on a standard mobile broadband connection, provided the platform has been recently active. The first request following a sustained idle period (scale-to-zero cold start) may take up to 60 seconds; this is an accepted trade-off for cost at beta scale.
- **SC-002**: A code change merged to the main branch appears live in the production environment within 15 minutes, with no manual steps required from the developer.
- **SC-003**: An unhandled production error is surfaced to the developer via email with full context (stack trace, affected endpoint, frequency) within 5 minutes of its first occurrence. Uptime failure alerts are also delivered by email.
- **SC-004**: When the platform receives no traffic for a sustained period, idle compute costs approach zero (scale-to-zero behaviour confirmed on the cost dashboard).
- **SC-005**: Total infrastructure cost during a representative beta month (fewer than 1,000 daily active users) does not exceed $45.
- **SC-006**: The developer can determine whether the platform is fully healthy or degraded within 60 seconds of opening the monitoring dashboard, without reading raw log files.
- **SC-007**: A deployment that fails does not cause any downtime for users already using the live version of the app.
- **SC-008**: All public URLs pass a basic security scan (HTTPS enforced, valid certificate, no mixed content warnings).
