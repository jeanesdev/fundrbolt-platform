# Feature Specification: NPO Onboarding Wizard

**Feature Branch**: `034-npo-onboarding`
**Created**: 2026-03-10
**Status**: Draft
**Input**: User description: "npo-onboarding: I need to clean up the process of setting up a new npo. I want it to be friendly, simple, and intuitive. Instead of having one big form, it should walk them through in smaller reasonable steps. It should explain the process of getting approval, it should include automated email verification, setting up a new user account if they don't have one, and setting up their first event. The FundrBolt Admin team still needs to approve the new NPO and I want to make sure we get an email when a new NPO is created. All emails should be professionally formatted. I will eventually have a link from our landing page to the first step of creating an NPO and a link to the first step of creating a new user. The process for signing up for an account needs to be cleaned up into simple friendly steps also."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - New Visitor Registers an NPO (Priority: P1)

A person with no existing FundrBolt account discovers FundrBolt (via the landing page or a direct link) and wants to register their nonprofit organization. They are guided through a friendly, step-by-step wizard that first creates their user account (with email verification), then collects their NPO details, then walks them through creating their first fundraising event. Throughout the process, clear language explains that their NPO is pending review and what to expect next.

**Why this priority**: This is the core end-to-end onboarding path — it creates both a new user and a new NPO in a single guided flow, which is the most common scenario for new organizations joining FundrBolt.

**Independent Test**: A tester with no existing account can follow the wizard start-to-finish from a public URL, complete email verification, submit NPO details, create a first event, and arrive at a confirmation screen explaining next steps — all without any help.

**Acceptance Scenarios**:

1. **Given** a visitor lands on the NPO signup start page, **When** they complete each wizard step in order, **Then** they progress through: (1) account creation, (2) email verification, (3) NPO profile, (4) first event setup, (5) submission confirmation.
2. **Given** a visitor is on the account creation step, **When** they enter an email already registered, **Then** they are prompted to sign in to their existing account instead of creating a duplicate.
3. **Given** a visitor has completed account creation, **When** they have not yet verified their email, **Then** they cannot advance past the email verification step until the link in the verification email is clicked.
4. **Given** a visitor has completed the NPO profile step, **When** they reach the first event step, **Then** they can choose to skip it and complete onboarding without creating an event yet.
5. **Given** a visitor submits their NPO application, **When** submission is successful, **Then** they see a confirmation screen explaining their NPO is under review, that the typical review timeline is 3–5 business days, and what to expect next.
6. **Given** the FundrBolt admin team, **When** a new NPO application is submitted, **Then** they receive a professionally formatted email notification with the NPO's details and a direct link to review the application.

---

### User Story 2 - Existing User Applies to Add an NPO (Priority: P2)

A person who already has a verified FundrBolt account (e.g., a donor or staff member who now wants to register a nonprofit) starts the NPO onboarding flow. The account creation and email verification steps are skipped since they are already authenticated. They proceed directly to the NPO profile and optional first event steps.

**Why this priority**: Existing users represent a meaningful second path; the wizard must be aware of authentication state and not force redundant steps.

**Independent Test**: A tester logged in to an existing account can access the "Register an NPO" flow, skip account/verification steps, complete NPO details and first event, and submit — presenting the same confirmation screen as a new user.

**Acceptance Scenarios**:

1. **Given** a logged-in user starts the NPO onboarding flow, **When** the wizard loads, **Then** it opens directly at the NPO profile step (account and verification steps are not shown).
2. **Given** a logged-in user who already manages an NPO starts the flow, **When** they complete submission, **Then** the new NPO is created as a separate entity and does not overwrite or merge with their existing NPO.

---

### User Story 3 - New Visitor Creates a User Account Only (Priority: P3)

A person who wants to create a FundrBolt account — without necessarily registering an NPO right away (e.g., they were invited as a staff member, or they want to donate) — goes through a clean, friendly multi-step sign-up experience. The steps are broken into logical, bite-sized screens rather than one overwhelming form.

**Why this priority**: The landing page will link directly to this flow. A clean sign-up experience reduces abandonment and is valuable independent of NPO registration.

**Independent Test**: A tester can register a new user account from a public URL by following simple steps, verify their email, and arrive at the admin dashboard — without any NPO registration required.

**Acceptance Scenarios**:

1. **Given** a visitor lands on the user sign-up start page, **When** they complete each step, **Then** they progress through: (1) name and email, (2) password creation, (3) email verification, (4) welcome/dashboard.
2. **Given** a visitor submits a sign-up form, **When** their email address is already registered, **Then** they see a friendly message suggesting they sign in or reset their password instead.
3. **Given** a new user completes registration, **When** they verify their email, **Then** they receive a professionally formatted welcome email and are taken to the admin dashboard.
4. **Given** a new user has not yet verified their email, **When** they sign in, **Then** they are shown a resend-verification prompt rather than an error message.

---

### User Story 4 - Admin Reviews and Approves/Rejects an NPO Application (Priority: P4)

A FundrBolt super admin receives an email notification for a new NPO application, opens the admin interface, reviews the submitted details, and approves or rejects the application. The NPO applicant receives a professionally formatted email informing them of the decision. If approved, they gain access to manage their NPO and can proceed with their events.

**Why this priority**: Without admin approval, new NPOs cannot go live. This completes the feedback loop for the onboarding process.

**Independent Test**: A tester acting as an admin can find a pending NPO in the admin panel, approve it, and confirm that the applicant's account is updated to reflect active NPO admin status — and that the applicant receives an approval email.

**Acceptance Scenarios**:

1. **Given** a new NPO application has been submitted, **When** a super admin opens the admin panel, **Then** the pending NPO is visible in a dedicated review queue with all submitted details.
2. **Given** an admin approves an NPO application, **When** the action is confirmed, **Then** the NPO becomes active, the applicant receives a professionally formatted approval email, and the applicant gains NPO Admin access.
3. **Given** an admin rejects an NPO application, **When** the action is confirmed with a reason, **Then** the applicant receives a professionally formatted rejection email that explains what happened and that the admin may re-open it for revision.
4. **Given** an admin re-opens a rejected application, **When** the action is taken, **Then** the applicant receives a professionally formatted email notifying them the application is re-opened and they may revise and resubmit it.
4. **Given** an NPO application has been pending for more than 5 business days, **When** no action has been taken, **Then** the admin interface visually flags the application as overdue.

---

### Edge Cases

- What happens if a user closes the browser mid-wizard? The in-progress wizard state is preserved for at least 24 hours so they can resume from where they left off without re-entering data.
- What if the email verification link expires before the user clicks it? The user can request a new link from the verification waiting screen.
- What if the NPO name entered closely matches an existing registered NPO? The system warns the applicant so they can confirm the name is intentional or correct it before submitting.
- What if the admin notification email fails to send? The pending NPO still appears in the admin review queue so no application is silently dropped.
- What if a user attempts to submit multiple NPO applications in a short window? The system warns them of a potential duplicate before allowing resubmission.
- What happens when the NPO submission or sign-up rate limit is exceeded? The user sees a friendly, plain-language message explaining they have made too many attempts and should try again later. No sensitive information about the limit threshold is exposed.
- What happens after an NPO application is rejected? The admin may re-open the application, which triggers an email notifying the applicant that their application has been re-opened for revision. The applicant can then update their details and resubmit. The application history (original submission, rejection reason, revision) is preserved.

---

## Requirements *(mandatory)*

### Functional Requirements

**NPO Onboarding Wizard**

- **FR-000**: The NPO profile step MUST collect the following required fields: NPO name, EIN/charity registration number, website URL, and primary contact phone number. Mission/description MUST be clearly marked as optional and MAY be left blank.
- **FR-001**: The NPO onboarding wizard MUST be accessible from a public URL suitable for linking from the landing page.
- **FR-002**: The wizard MUST present onboarding in a sequence of clearly labelled, single-purpose steps rather than one combined form.
- **FR-003**: The wizard MUST display a persistent progress indicator showing the current step and total steps remaining.
- **FR-004**: For unauthenticated visitors, the wizard MUST begin with account creation and email verification steps before advancing to NPO-specific steps.
- **FR-005**: For already-authenticated users, the wizard MUST skip account creation and email verification and begin at the NPO profile step.
- **FR-006**: The wizard MUST explain the NPO approval process — including what happens after submission, who reviews applications, and that the typical timeline is 3–5 business days — in plain, friendly language before or during the submission step.
- **FR-007**: The wizard MUST allow users to navigate back to previous steps to review or correct information.
- **FR-008**: The wizard MUST preserve in-progress state server-side for at least 24 hours, identified by an opaque session token stored in a browser cookie. No personally identifiable data entered during the wizard MUST be stored in browser-side storage (localStorage or sessionStorage).
- **FR-009**: The first event creation step MUST be clearly optional — users may skip it and create events later from within the admin interface.
- **FR-010**: Upon successful submission, the wizard MUST display a confirmation screen that sets clear expectations about the review process and next steps.
- **FR-010a**: The NPO application submission endpoint MUST be rate limited per IP, consistent with existing platform rate limiting patterns, to prevent automated spam submissions.
- **FR-010b**: Both the sign-up form and the NPO submission form MUST include invisible, non-interactive bot detection. No visible challenge or puzzle MUST be presented to legitimate users. Requests detected as automated MUST be silently rejected with a friendly error message.

**Email Verification**

- **FR-011**: The system MUST send an automated email verification message when a new user account is created.
- **FR-012**: The verification email MUST use a professionally formatted template consistent with FundrBolt brand standards.
- **FR-013**: The user MUST NOT be able to advance past the email verification step until the link in the verification email has been clicked.
- **FR-014**: The verification waiting screen MUST provide a clearly visible option to resend the verification email.
- **FR-015**: Verification links MUST expire after 24 hours; expired links MUST show a friendly message with a one-click resend option.

**NPO Admin Notification**

- **FR-016**: The system MUST send a professionally formatted email notification to the FundrBolt admin team when a new NPO application is submitted.
- **FR-017**: The admin notification email MUST include the applicant's name, email, NPO name, NPO description, and a direct link to the application in the admin review panel.
- **FR-018**: The admin notification MUST be sent regardless of whether the applicant created a new user account or was already registered.

**NPO Approval Workflow**

- **FR-019**: Submitted NPO applications MUST appear in a dedicated pending-review queue within the admin interface.
- **FR-020**: Admins MUST be able to approve or reject an NPO application from the admin interface.
- **FR-021**: Rejection MUST require the admin to provide a reason, which is included in the notification email to the applicant.
- **FR-021a**: After rejecting an application, an admin MAY re-open it. Re-opening MUST notify the applicant by email that their application has been re-opened for revision and resubmission.
- **FR-021b**: When a re-opened application is resubmitted by the applicant, it MUST re-enter the pending-review queue as a new review cycle. The full history — original submission, rejection reason, and revised submission — MUST be preserved and visible to admins.
- **FR-022**: Upon approval, the applicant's account MUST be automatically elevated to NPO Admin role for the approved NPO.
- **FR-023**: The applicant MUST receive a professionally formatted email notifying them of the approval, rejection, or re-opening decision.
- **FR-024**: Applications pending for more than 5 business days MUST be visually flagged as overdue in the admin review queue.

**User Sign-Up Flow (Standalone)**

- **FR-025**: A standalone user account sign-up flow MUST be accessible from a public URL suitable for landing page linking.
- **FR-025a**: The sign-up endpoint MUST be rate limited per IP, consistent with existing platform rate limiting patterns, to prevent automated account creation abuse.
- **FR-025b**: The sign-up form MUST include invisible, non-interactive bot detection consistent with FR-010b.
- **FR-026**: The sign-up flow MUST be presented as a sequence of simple, friendly steps rather than a single form.
- **FR-027**: The sign-up flow MUST include email verification before granting full account access.
- **FR-028**: If an entered email address already has an account, the system MUST display a friendly prompt to sign in or reset the password instead of a generic error.
- **FR-029**: New users who have not yet verified their email MUST see a clear, friendly resend-verification prompt when they attempt to sign in, rather than an access-denied error.

**All Emails**

- **FR-030**: All system emails — verification, welcome, NPO submission confirmation, admin notification, approval, and rejection — MUST use a consistent, professionally formatted template aligned with FundrBolt brand standards.

### Key Entities

- **NPO Application**: Represents a submitted request to register a nonprofit on FundrBolt. Required fields: NPO name, EIN/charity registration number, website URL, primary contact phone. Optional fields: mission/description. Also contains: applicant contact details, submission timestamp, current status (pending / approved / rejected / reopened), rejection reason if applicable, and full revision history.
- **User Account**: A FundrBolt user. May exist prior to NPO onboarding or be created as part of it. Linked to one or more NPOs once approved.
- **Wizard Session**: Tracks in-progress onboarding state for a visitor or user, stored server-side and identified by an opaque token in a browser cookie. Allows resumption within 24 hours. Stores completed steps and entered data. Automatically expires after 24 hours of inactivity.
- **Event (First Event)**: An optional event created during the final step of NPO onboarding. Follows the same structure as any FundrBolt event but is pre-associated with the pending NPO.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new visitor can complete the full NPO onboarding wizard — from landing on the start page to submission confirmation — in under 10 minutes.
- **SC-002**: A new visitor can complete the standalone user sign-up flow — from landing on the start page to reaching the dashboard — in under 3 minutes.
- **SC-003**: 90% of users who begin the NPO onboarding wizard reach the submission confirmation screen without abandoning (measured over a 3-month period after launch).
- **SC-004**: The FundrBolt admin team receives an email notification within 2 minutes of every new NPO application submission.
- **SC-005**: 100% of submitted NPO applications appear in the admin review queue, regardless of email delivery status.
- **SC-006**: Zero instances of a user being permanently stuck due to an expired verification link — all users can self-serve a new link without contacting support.
- **SC-007**: All outgoing system emails are free of placeholder text, broken links, and unbranded content.

---

## Clarifications

### Session 2026-03-10

- Q: What fields does the NPO profile step collect? → A: Core fields — name (required), EIN/charity registration number (required), website URL (required), primary contact phone (required), mission/description (optional).
- Q: What is the reapplication policy for rejected NPO applications? → A: Admin can re-open a rejected application; the applicant is notified and can revise and resubmit. The rejected record is updated rather than replaced.
- Q: What approval timeline should be communicated to applicants? → A: 3–5 business days.
- Q: How is unauthenticated wizard session state stored for 24-hour resume? → A: Server-side session; the browser holds only an opaque session token (cookie). Sensitive data never persists in browser storage.
- Q: Should the public sign-up and NPO submission endpoints be rate limited? → A: Yes — both sign-up and NPO submission are rate limited per IP, consistent with existing platform patterns.
- Q: Should a CAPTCHA be added to prevent bot abuse? → A: Yes — invisible/non-interactive bot detection (e.g., Cloudflare Turnstile or reCAPTCHA v3) on both sign-up and NPO submission. No visible challenge shown to real users.

---

## Assumptions

- The FundrBolt admin team notification emails are sent to a configured internal address (e.g., `admin@fundrbolt.com`); the specific address is a deployment configuration detail, not a feature decision.
- "First event" during NPO onboarding collects only basic event details (name, date, type). Full event configuration is completed later from within the admin interface.
- Email template design follows the existing FundrBolt brand guidelines already established on the platform.
- The wizard is part of a publicly accessible pre-authentication section of the existing Admin PWA, rather than a separate standalone application.
- Users who abandon the wizard mid-way and return within 24 hours are identified by an opaque session token stored in a browser cookie; wizard state is held server-side. No personally identifiable data is stored in browser-side storage.
- The standalone user sign-up flow and the NPO onboarding wizard share the same account creation and email verification steps as reusable components.
- The "5 business day" overdue threshold for admin review is a reasonable default; this can be adjusted by configuration without a code change.
