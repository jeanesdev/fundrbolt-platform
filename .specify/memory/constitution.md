# Fundrbolt Platform Constitution

## Project Identity

**Name:** Fundrbolt Fundraising Platform
**Vision:** World-class fundraising software that maximizes nonprofit revenue by optimizing the donor experience, driving engagement, and inspiring action
**Delivery Model:** SaaS (multi-tenant, cloud-hosted)
**Target Market:** Nonprofit organizations, professional auctioneers, event coordinators hosting galas with 50-500+ attendees

## Core Principles

### 1. Donor-Driven Engagement
Primary focus is maximizing fundraising by optimizing the donor experience—reduce friction, create delight, and design every screen, workflow, and notification to drive donors towards engagement and the call-to-action. When in conflict, prioritize donor outcomes and comfort over administrative or auctioneer convenience.

### 2. Real-Time Reliability
Bid updates, leaderboards, and notifications must propagate within 500ms. System must handle 100+ concurrent tablets per event without degradation. Lost WebSocket connections must auto-reconnect and sync state within 2 seconds.

### 3. Production-Grade Quality
All code must be maintainable, testable, and documented as if preparing for acquisition. No shortcuts that compromise long-term scalability or security.

### 4. Solo Developer Efficiency
Leverage AI assistance, managed cloud services, and modern tooling to move quickly while maintaining robustness. Avoid over-engineering; ship iteratively.

### 5. Data Security and Privacy
Treat all user data as if under constant regulatory scrutiny. Encrypt everything, log everything, delete on request. Assume GDPR compliance is mandatory.

### 6. Minimalist Development (YAGNI Principle)
Build exactly what is specified, nothing more. Resist the temptation to add "helpful" features, anticipatory optimizations, or "nice-to-have" functionality unless explicitly requested. Every function, parameter, and configuration option must solve a stated requirement. When in doubt, ship the minimal viable solution and iterate based on actual user feedback.

## Technical Architecture

### System Design
- **Architecture Style:** Modular monolith with microservices mindset—loosely coupled layers within monorepo, ready to split into services if needed
- **Repository Structure:** Monorepo with clear separation: `/backend`, `/frontend`, `/shared`, `/infrastructure`, `/docs`
- **API Design:** REST-first, API-first. Consider GraphQL in Phase 2 if client customization needs emerge
- **Real-Time Communication:** Socket.IO for bidirectional WebSocket with auto-reconnect, rooms per event, fallback to long-polling
- **Multi-Tenancy:** Shared PostgreSQL schema with `tenant_id` (event organization) isolation. Row-Level Security with `tenant_id` filtering, validated at ORM level with SQLAlchemy middleware

### Technology Stack
**Backend:**
- **Framework:** FastAPI (Python 3.11+) with async/await throughout
- **Dependency Management:** Poetry for Python package and virtual environment management
- **API Documentation:** Auto-generated OpenAPI/Swagger, maintained alongside code
- **Type Safety:** Python type hints on all functions, mypy strict mode enforced in CI
- **Data Validation:** Pydantic models for all API requests/responses, database schemas
- **ORM:** SQLAlchemy 2.0+ with Alembic for schema migrations
- **Database:** Azure Database for PostgreSQL (managed, auto-backup, point-in-time recovery in Phase 2)
- **Caching:** Azure Cache for Redis for session state, bid state, leaderboard snapshots
- **File Storage:** Azure Blob Storage for event images, sponsor content, documents
- **Task Queue:** Celery with Redis broker for background jobs (email, reports, data exports—Phase 2)

**Frontend:**
- **PWA Framework:** React with Vite, TypeScript strict mode
- **State Management:** Zustand for global state, React Query for server state
- **UI Components:** Headless UI library (Radix, shadcn/ui) for accessibility and consistency
- **Real-Time Client:** socket.io-client for WebSocket connections
- **Offline Support:** Service workers for PWA caching, graceful degradation when offline
- **Responsive Design:** Mobile-first, optimized for tablets (10"-13"), supports BYOD phones

**Infrastructure:**
- **Cloud Provider:** Microsoft Azure (prefer portable patterns, but use managed services for speed)
- **Containerization:** Docker for consistent development and deployment environments
- **Compute:** Azure App Service (containers) or Azure Container Apps for backend/frontend
- **CDN:** Azure CDN for PWA static assets, global edge caching
- **Secrets Management:** Azure Key Vault for API keys, DB credentials, encryption keys
- **Monitoring:** Grafana + Loki (logs) + Prometheus (metrics) + Azure Monitor integration
- **CI/CD:** GitHub Actions for automated testing, building, deployment
- **Infrastructure as Code:** Terraform or Azure Bicep for reproducible environments

**Third-Party Services:**
- **Payments:** Stripe (PCI-compliant, tokenized payments, no card storage)
- **SMS:** Twilio for notifications (outbid alerts, event reminders)
- **Email:** SendGrid or Azure Communication Services for transactional emails
- **Alerting:** PagerDuty + Prometheus Alertmanager for incident response

## Code Quality Standards

### Type Safety & Validation
- Python: Type hints mandatory, mypy strict mode in CI, no `Any` types without justification
- TypeScript: Strict mode, no implicit `any`, exhaustive switch case checking
- Pydantic models for all data crossing boundaries (API, DB, external services)

### Testing Requirements
- **Unit Tests:** 80%+ code coverage, fast (<5 sec suite), mock external dependencies
- **Integration Tests:** Critical paths (auth, bid placement, payment flow, WebSocket events)
- **E2E Tests:** 10-15 user flows with Playwright (login → bid → win → checkout)
- **Load Tests:** Simulate 100+ concurrent bidders per event before production (Phase 2)
- **Auction Simulation Tests:** Multi-user bidding scenarios with race conditions
- **WebSocket Load Tests:** Connection drops and reconnections during active bidding
- **Test Data:** Factories (factory_boy) for consistent test fixtures, never use production data

### Code Style & Linting
- **Python:** Black (formatting), Ruff (linting), isort (import sorting)
- **TypeScript:** ESLint + Prettier, import order enforcement
- **Pre-commit Hooks:** Auto-format, type check, lint (no full test suite—too slow)

### Commit Message Standards
Follow [Conventional Commits](https://www.conventionalcommits.org/) specification for all commits:

**Format:** `<type>[optional scope]: <description>`

**Types:**
- `feat:` New feature for the user (not internal tooling)
- `fix:` Bug fix for the user (not internal tooling)
- `docs:` Documentation changes only
- `style:` Formatting, missing semi colons, etc (no code change)
- `refactor:` Code change that neither fixes a bug nor adds a feature
- `test:` Adding missing tests or correcting existing tests
- `chore:` Updating build tasks, package manager configs, etc
- `perf:` Performance improvements
- `ci:` Changes to CI configuration files and scripts
- `build:` Changes that affect the build system or external dependencies
- `revert:` Reverts a previous commit

**Scope Examples:** `auth`, `auction`, `payment`, `websocket`, `api`, `ui`, `db`

**Best Practices:**
- Use imperative mood: "add feature" not "added feature"
- First line ≤50 characters, body ≤72 characters per line
- Capitalize first letter of description
- No period at end of description
- Use body to explain what and why, not how
- Reference issues/PRs: "Closes #123"

**Examples:**
```
feat(auction): add real-time bid validation
fix(payment): resolve Stripe webhook timeout issue
docs(api): update OpenAPI spec for bid endpoints
refactor(auth): extract JWT validation to middleware
test(websocket): add connection drop recovery tests
```

**Breaking Changes:** Use `!` after type/scope: `feat(api)!: change bid response format`

### Documentation
- **Code:** Docstrings on all public functions (Google style), inline comments for complex logic
- **API:** OpenAPI spec auto-generated, keep examples updated
- **Architecture:** Decision records (ADRs) for major choices in `.specify/adr/`
- **Deferred Work:** PARKING_LOT.md tracks deferred features, blocked items, and technical debt
- **Runbooks:** Deployment, rollback, incident response procedures in `/docs/operations/`
- **README:** Setup instructions, local dev environment, testing, contribution guidelines

### Architecture Decision Records (ADR) Process
- **When to Create ADR:**
  - Deferring originally planned features (e.g., database permission table, middleware)
  - Choosing between competing technical approaches (e.g., service-based vs database permissions)
  - Making infrastructure decisions (e.g., email service, caching strategy, deployment architecture)
  - Blocking work on missing dependencies (e.g., real email blocked on Spec 004)
- **Required Sections:** Status, Date, Context, Decision, Consequences, Revisit Criteria
- **Cross-Reference:** Link ADR in PARKING_LOT.md for deferred items, reference in tasks.md notes
- **Living Documents:** Update ADR status (Proposed → Accepted → Superseded) as implementation evolves

### PARKING_LOT.md Workflow
- **Update When:**
  - Deferring a task from the original specification
  - Blocking work on missing infrastructure or dependencies
  - Identifying technical debt during implementation
  - Discovering features that can wait until later phases
- **Required Fields:** Status, Phase, Reason, Revisit When, Estimated Effort, ADR link (if applicable)
- **Categories:**
  - **Deferred Features:** Originally planned but delayed (T074-T075 permissions)
  - **Blocked Items:** Waiting on external dependencies (email blocked on Spec 004)
  - **Technical Debt:** Implementation shortcuts to revisit later
  - **Future Enhancements:** Nice-to-have features not in current spec
- **Review Cadence:** Update after each phase completion, review quarterly for reprioritization

## Security & Compliance

### Authentication & Authorization
- **Method:** OAuth2 with JWT access tokens (15 min expiry) + refresh tokens (7 days)
- **Authorization:** RBAC with roles: Superadmin, Event Coordinator, Auctioneer, Staff, Bidder
- **Role Enforcement:** FastAPI dependency injection checks role before endpoint execution
- **Session Management:** Redis for refresh token storage, immediate revocation on logout/compromise

### Data Protection
- **Encryption in Transit:** TLS 1.3 everywhere, HTTPS only, HSTS headers
- **Encryption at Rest:** Azure-managed encryption for Postgres, Redis, Blob Storage
- **PII Handling:** Never log passwords, emails, phone numbers in plain text
- **Payment Security:** Stripe handles all card data, only store transaction IDs and tokens
- **Secrets:** Never commit secrets, use Azure Key Vault, rotate keys quarterly

### Privacy & Compliance
- **GDPR:** Right to access (data export API), right to deletion (soft delete with anonymization after 30 days)
- **Data Retention:** Active data indefinite, deleted user data 30 days, transaction records 7 years for audit
- **Consent Tracking:** Log timestamp of user agreement to terms/privacy policy
- **Audit Logging:** Immutable `audit_log` table for all sensitive actions (bids, payments, admin changes)

### DDoS & Rate Limiting
- **Application Layer:** FastAPI middleware with rate limits (100 req/min per user, 1000 req/min per event)
- **Infrastructure Layer:** Azure Front Door WAF and DDoS protection (Phase 2)
- **WebSocket Limits:** Max 5 connections per user, disconnect idle connections after 1 hour

## Observability & Reliability

### Logging
- **Format:** Structured JSON with `timestamp`, `level`, `service`, `user_id`, `event_id`, `trace_id`, `message`, `metadata`
- **Development:** IceCream (ic) for enhanced debugging and development logging with automatic variable inspection
- **Levels:** DEBUG (dev only), INFO (normal operations), WARNING (recoverable errors), ERROR (failures), CRITICAL (system down)
- **Storage:** Loki for searchable logs, 30-day retention, compressed backups for audit
- **Sensitive Data:** Never log passwords, tokens, full card numbers

### Metrics (Prometheus)
- **RED Method:** Rate (requests/sec), Errors (5xx count), Duration (p50, p95, p99 latency)
- **Business Metrics:** Active events, bidders per event, bids/min, revenue/hour, failed payments
- **Infrastructure:** CPU/memory per service, DB connection pool, Redis cache hit rate, disk I/O
- **Custom Metrics:** Bid processing latency, WebSocket connection count, leaderboard update time

### Alerting
- **Critical (PagerDuty):** API error rate >5%, database down, payment processing failed
- **Warning (Slack):** API latency p95 >500ms, disk >80% full, WebSocket disconnect rate >10%
- **SLO Targets:** 99.9% uptime, API p95 <300ms, bid processing <500ms, WebSocket reconnect <2sec

### Backups & Disaster Recovery
- **Frequency:** Daily automated backups at 2 AM UTC
- **Retention:** 30 days rolling, weekly snapshots for 1 year
- **Testing:** Quarterly restore drills to staging environment
- **RTO/RPO:** Restore within 4 hours, max 24-hour data loss (daily backups)
- **PITR:** Add point-in-time recovery in Phase 2 for high-value events

## Development Workflow

### Branching Strategy (Trunk-Based)
- **Main Branch:** `main` = production-ready, always deployable
- **Staging Branch:** `staging` = pre-production testing
- **Feature Branches:** Short-lived (1-3 days), merge to `main` after CI passes
- **Hotfixes:** Branch from `main`, fix, test, merge, deploy immediately
- **No Long-Running Branches:** Merge daily, use feature flags to hide incomplete work

### CI/CD Pipeline (GitHub Actions)
1. **On Pull Request:** Lint, type check, unit tests, integration tests (run in <5 min)
2. **On Merge to `main`:** Full test suite + E2E tests, build Docker images, deploy to staging
3. **Staging Validation:** Smoke tests, manual QA, load test (Phase 2)
4. **Production Deploy:** Manual approval gate, blue-green deployment with Docker containers, rollback on error
5. **Post-Deploy:** Health checks, alert if error rate spikes, automated rollback after 3 consecutive failures

### AI-Assisted Development Boundaries
- **AI Can Generate Freely:** Boilerplate (CRUD endpoints, Pydantic models), tests, docs, config files
- **AI Needs Review:** Business logic (auction rules, bid validation), real-time coordination, payment flows
- **Human Only:** Security-critical code (auth, encryption), production incident response, architectural decisions
- **AI Tools:** GitHub Copilot (inline), Claude (code review), SpecKit (spec-driven generation)

### AI Development Constraints (YAGNI Enforcement)
- **Implement Only Specified Requirements:** AI agents must not add features, parameters, or options beyond what's explicitly requested in the specification or user story
- **No Anticipatory Features:** Avoid building extensibility hooks, configuration options, or "future-proofing" unless the immediate use case demands it
- **No Helper Functions Without Purpose:** Every utility function must solve a current, specific problem. No "it might be useful later" functions
- **Question Scope Creep:** If an AI agent suggests additional functionality during implementation, explicitly ask "Is this required for the current specification?" If no, omit it
- **Default to Simple:** Choose the most straightforward implementation that meets requirements. Optimize and add complexity only when performance or scale demands it

### Feature Flags
- **Implementation:** Config-based flags in DB table (`feature_name`, `enabled`, `rollout_percentage`)
- **Use Cases:** Gradual rollout (10% → 50% → 100%), instant rollback, A/B testing (Phase 2)
- **Management:** Admin UI to toggle flags, API to check flag status per user/event

### Cost Controls
- **Budget Alerts:** Azure Cost Management alerts at 50%, 80%, 100% of monthly budget
- **Auto-Scaling Limits:** Max 10 app instances, max 5 DB replicas, prevent runaway costs
- **Resource Tagging:** Tag all Azure resources with `environment` (dev/staging/prod), `project`, `owner` for cost tracking
- **Monthly Review:** Analyze spend, optimize underutilized resources, forecast growth

## Scalability & Performance

### Capacity Targets
- **MVP:** 100 concurrent bidders per event, 10 simultaneous events, 1000 registered users
- **Phase 2:** 500 bidders per event, 50 simultaneous events, 10,000 users
- **Phase 3:** 1000+ bidders, 100+ events, 100,000+ users (consider microservices split)

### Performance SLOs
- **API Latency:** p95 <300ms, p99 <500ms
- **Bid Processing:** Place bid → leaderboard update <500ms end-to-end
- **WebSocket Latency:** Server event → client render <200ms
- **Database Queries:** All queries <50ms, index all foreign keys and filters
- **Page Load:** PWA first contentful paint <1.5sec on 4G connection

### Caching Strategy
- **Redis Use Cases:** User sessions, JWT blacklist, bid leaderboard snapshots, event metadata
- **TTL:** Sessions 7 days, leaderboard 5 sec (refresh on bid), event metadata 1 hour
- **Cache Invalidation:** On bid placement, event update, user logout—invalidate related keys
- **CDN Caching:** Static assets (JS/CSS/images) cached 1 year with versioned filenames

### Database Optimization
- **Indexing:** All foreign keys, query filters (`event_id`, `user_id`, `created_at`), unique constraints
- **Query Optimization:** Use EXPLAIN ANALYZE, no N+1 queries, eager load relationships
- **Connection Pooling:** SQLAlchemy pool size 20, max overflow 10, recycle connections every 1 hour
- **Read Replicas:** Add in Phase 2 for analytics/reporting queries (isolate from transactional load)

## Competitive Differentiation

### Must-Have Features (Competitive Parity)
- Mobile bidding with real-time updates
- Live and silent auction management
- Event registration and ticketing
- Payment processing integration
- SMS notifications for outbid alerts
- Basic analytics and reporting

### Differentiators (Donor Engagement Focus)
- **Digital Bid Paddles:** Hardware-agnostic PWA with engaging win/lose animations, sponsor content display
- **Donor Experience:** Delightful interactions, frictionless flows, instant leaderboard feedback, adaptive notifications
- **Auctioneer Control Panel:** Real-time override, pause/resume auction, trigger paddle raises, instant leaderboard on command
- **Simplified Workflow:** Reduce setup complexity vs OneCause, match Event.Gives' PWA ease-of-use
- **Transparent Pricing:** Clear per-event or subscription pricing (not opaque like OneCause/GiveSmart)
- **Customization:** Per-event branding, sponsor content scheduling, QR code generation

### Phase 2+ Advantages
- **AI Insights:** Predictive bid recommendations, donor behavior analysis (inspired by OneCause)
- **Multi-Language Support:** Spanish, French for broader nonprofit reach
- **Advanced Analytics:** Donor journey mapping, cohort analysis, lifetime value tracking

## Dependencies & Licensing

### Dependency Requirements
- **Permissive Licenses Only:** MIT, Apache 2.0, BSD (check with `pip-licenses`)
- **Avoid:** GPL, AGPL (copyleft restrictions incompatible with proprietary SaaS)
- **Audit:** Quarterly dependency license review, update vulnerable packages within 7 days

### Your Code License
- **Proprietary:** No open-source license, all rights reserved
- **Copyright Notice:** Include in every source file header

## Phase Roadmap Alignment

### Phase 1 (MVP—Target 3-6 Months)
- User registration, authentication, role-based access
- Event creation with custom branding (logo, URL, colors)
- Ticket sales with payment processing
- Live and silent auction item management
- Digital bid paddle PWA (login, bid placement, leaderboard, win/lose animations)
- Real-time WebSocket updates (bids, leaderboard, notifications)
- SMS notifications (outbid alerts, event reminders)
- Check-in/check-out with QR codes
- Paddle raise (fund-a-need) support
- Basic analytics dashboard (totals, active bidders)
- Data export (CSV) for nonprofit CRMs
- Admin panel for staff and auctioneer controls

### Phase 2 (Scale & Enhance)
- Scoreboards and slideshows for live displays
- Automated event messaging (dinner served, auction closing)
- Video integration for virtual/hybrid events
- Advanced reporting (donor insights, item performance)
- Email campaign tools
- Enhanced analytics (predictive, cohort analysis)
- Load testing for 500+ bidders per event
- Point-in-time recovery for database

### Phase 3 (Enterprise)
- Multi-region deployment for global nonprofits
- White-label options for large organizations
- AI-powered bid recommendations
- Advanced integrations (Salesforce, HubSpot, Blackbaud)
- Microservices architecture if scaling demands it

## Immutable Constraints

1. **Never compromise data security** for feature velocity
2. **Never deploy without passing CI tests** (unit + integration minimum)
3. **Never store plaintext passwords or full credit card numbers**
4. **Never hard-code secrets** (use Azure Key Vault or environment variables)
5. **Never skip database migrations** (always use Alembic, never manual schema changes)
6. **Never break API backward compatibility** without versioning (`/api/v1`, `/api/v2`)
7. **Always require code review** (AI-assisted or self-review with 24-hour cooling period)
8. **Always log security-relevant events** (login, failed auth, bid placement, payment)
9. **Always use HTTPS/TLS** (no exceptions, even in dev—use self-signed certs if needed)
10. **Always design for rollback** (feature flags, blue-green deployment, database migration revert scripts)
11. **Never implement unspecified features** (YAGNI principle—build only what's explicitly requested, resist scope creep)

## Success Criteria

**Technical Excellence:**
- Zero security incidents in first year
- 99.9%+ uptime after first 3 months
- Sub-300ms API latency p95
- Pass SOC 2 Type II audit readiness assessment (Phase 2)

**Business Goals:**
- MVP deployed to production within 6 months
- 5 beta customers conducting live events by month 9
- Positive customer NPS >50 within first year
- Acquisition-ready codebase (documented, tested, scalable)

**Developer Experience:**
- New feature from spec → production in <2 weeks
- CI/CD pipeline runs <10 minutes
- Incident response time <30 minutes (detection → mitigation)

**Version**: Version: 1.0.2 | **Ratified**: 2025-10-16 | **Last Amended**: 2025-10-16
