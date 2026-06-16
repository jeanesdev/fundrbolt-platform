# Feature Specification: Configurable Our Cause Card Sections

**Feature Branch**: `050-custom-sections`
**Created**: 2026-06-15
**Status**: Draft
**Input**: User description: "custom-sections I want to be able to define custom cards that show on the \"Our Cause\" page. I want to be able to define these cards through the admin pwa. I want to have a few different templates, such as a text card, a slideshow card (including slides with just images, and slides with text overlaid on the images, slides with just text, like testimonials), a video card (configurable to play automatically, enable or disable audio, autoplay, etc). The text should be editable with a WYSIWYG editor. I want the admin to be able to configure how each card looks (should it include a background or border and what color, header, should it be collapsible, etc), and change their order. All the existing sections on the \"Our Cause page\", such as the \"About This Event\" the sponsors, Event Details, etc should be a card that the admin can configure, rearrange, disable, etc."

## Clarifications

### Session 2026-06-15

- Q: How should admin card configuration changes go live? → A: Save as Draft, then require explicit Publish to update the live page.
- Q: How should conflicting concurrent admin edits be handled? → A: Detect version conflict and require admin resolution before saving.
- Q: What rich-text content policy should be used for card text? → A: Allow sanitized formatting and links; block active embeds/scripts.
- Q: What media source policy should be used for slideshow/video content? → A: Support uploaded media plus validated external HTTPS URLs.
- Q: What accessibility standard applies to card rendering and admin authoring controls? → A: WCAG 2.1 AA compliance target.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create and Configure Custom Cards (Priority: P1)

As an event administrator, I can create new cards for the Our Cause page using predefined templates so I can present event content in a format that fits the story I want to tell.

**Why this priority**: Without card creation and configuration, administrators cannot deliver custom content on the Our Cause page.

**Independent Test**: Can be fully tested by creating one text card, one slideshow card, and one video card in the admin interface, publishing changes, and confirming those cards display correctly on the Our Cause page.

**Acceptance Scenarios**:

1. **Given** an administrator is editing an event's Our Cause page configuration, **When** they create a text card and save it, **Then** the card appears in the card list and renders on the public page with entered content.
2. **Given** an administrator is creating a slideshow card, **When** they add image-only, text-over-image, and text-only slides, **Then** each slide type is saved and rendered in the selected order.
3. **Given** an administrator is creating a video card, **When** they set playback options (such as auto-start and audio defaults) and save, **Then** the card honors those options on the Our Cause page.

---

### User Story 2 - Control Presentation and Layout (Priority: P2)

As an event administrator, I can control card styling, visibility, and order so the Our Cause page follows my desired layout and visual hierarchy.

**Why this priority**: Visual control and ordering are key to making content understandable and engaging for donors.

**Independent Test**: Can be fully tested by changing card order, enabling/disabling cards, and adjusting style settings, then verifying the rendered page reflects those changes exactly.

**Acceptance Scenarios**:

1. **Given** multiple cards exist, **When** the administrator reorders cards, **Then** the Our Cause page displays cards in the new order.
2. **Given** a card is optional for an event, **When** the administrator disables it, **Then** it is hidden from the public Our Cause page without deleting its configuration.
3. **Given** a card supports appearance settings, **When** the administrator updates visual options (background, border, header, collapsible behavior), **Then** the card renders with the updated styling and behavior.

---

### User Story 3 - Manage Existing Built-In Sections as Cards (Priority: P3)

As an event administrator, I can manage existing Our Cause sections (such as About This Event, Sponsors, and Event Details) as configurable cards so custom and built-in content are controlled in one consistent workflow.

**Why this priority**: Unifying built-in sections with custom cards reduces configuration friction and prevents fragmented page management.

**Independent Test**: Can be fully tested by modifying built-in section card settings (order, visibility, style), publishing, and verifying those built-in sections follow the same behavior as custom cards.

**Acceptance Scenarios**:

1. **Given** built-in sections exist for an event, **When** an administrator opens card configuration, **Then** built-in sections are listed alongside custom cards.
2. **Given** a built-in section card is moved or disabled, **When** changes are saved, **Then** the Our Cause page reflects the updated placement or visibility.

### Edge Cases

- An administrator tries to save a card with no meaningful content (for example, empty text and no media).
- A slideshow card contains a mix of incomplete slides where required fields for a selected slide type are missing.
- A video card references content that cannot be played by the visitor's browser.
- Multiple administrators edit card order at the same time and submit conflicting updates; the system must detect the conflict and require explicit resolution before save.
- A built-in section is disabled and later re-enabled after related event data has changed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow authorized administrators to create, edit, and delete custom Our Cause cards for an event. Administrators SHOULD be able to duplicate existing cards (deferred to a future iteration; see tasks.md Deferred section).
- **FR-002**: System MUST provide at least these card templates: text card, slideshow card, and video card.
- **FR-003**: System MUST provide rich text editing for card text content, including basic formatting and link support.
- **FR-004**: System MUST support slideshow cards with these slide variants: image-only, text-over-image, and text-only.
- **FR-005**: System MUST allow administrators to define slide sequence within a slideshow card.
- **FR-006**: System MUST allow administrators to configure video card playback preferences, including whether the video starts automatically and whether audio is enabled by default.
- **FR-007**: System MUST allow administrators to configure card presentation options, including header display, border presence/color, background presence/color, and collapsible behavior.
- **FR-008**: System MUST allow administrators to reorder all cards on the Our Cause page and persist the selected order.
- **FR-009**: System MUST allow administrators to enable or disable any card without deleting its configuration.
- **FR-010**: System MUST represent built-in Our Cause sections (including About This Event, Sponsors, and Event Details) as configurable cards in the same management experience as custom cards.
- **FR-011**: System MUST apply the same ordering and enable/disable controls to built-in section cards and custom cards.
- **FR-012**: System MUST prevent publication of card changes that fail validation and provide clear, actionable error feedback.
- **FR-013**: System MUST preserve existing card configuration data when cards are disabled and later re-enabled.
- **FR-014**: System MUST provide a preview mode so administrators can review card layout and content before publishing.
- **FR-015**: System MUST record who changed card configuration and when for auditability.
- **FR-016**: System MUST save admin card configuration changes as draft updates until an authorized administrator explicitly publishes them.
- **FR-017**: System MUST keep the live Our Cause page unchanged while draft changes exist and are not yet published.
- **FR-018**: System MUST detect concurrent-update conflicts using version-aware draft saves and block silent overwrites.
- **FR-019**: System MUST present a conflict resolution flow that lets administrators review current live/draft values and choose how to proceed before saving.
- **FR-020**: System MUST sanitize rich-text content before save/publish and allow standard formatting, lists, and links.
- **FR-021**: System MUST block active content in rich-text fields, including scripts and untrusted embedded frames.
- **FR-022**: System MUST allow slideshow and video media to be sourced from either uploaded assets or validated external HTTPS URLs.
- **FR-023**: System MUST validate external media URLs at save time and provide an administrator-facing fallback/error state when media is unavailable.
- **FR-024**: Public-facing card rendering MUST meet WCAG 2.1 AA standards, including sufficient colour contrast, keyboard navigation, and screen-reader labels for interactive and media elements.
- **FR-025**: Admin card authoring controls MUST meet WCAG 2.1 AA standards, including keyboard-accessible reordering, labelled inputs, and visible focus indicators.

### Key Entities *(include if feature involves data)*

- **Cause Page Card**: A configurable content block shown on the Our Cause page, with attributes such as type, title/header, style settings, enabled state, display order, and collapsible setting.
- **Card Template**: A predefined card structure that governs allowed content inputs and behavior (text, slideshow, video, built-in section).
- **Slide Item**: A single slideshow entry with a defined variant (image-only, text-over-image, text-only), media/text content, and order position.
- **Video Settings**: Playback and presentation preferences associated with a video card, including auto-start and default audio behavior.
- **Built-In Section Card**: A mapped representation of existing event sections that can be managed through the same controls as custom cards.
- **Card Configuration Revision**: A historical record of card configuration changes including editor identity, timestamp, and changed fields.

### Assumptions & Dependencies

- Administrators manage cards at the event level and changes apply only to the selected event.
- Existing access controls for event administrators remain the source of authorization.
- Existing built-in sections already have underlying content sources and are only being surfaced as configurable cards.
- Visitor-facing behavior should prioritize readability and accessibility when style choices conflict with usability.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 90% of event administrators can create and publish a new custom card in under 4 minutes on first attempt.
- **SC-002**: 95% of card configuration changes (create, edit, reorder, enable/disable) are visible on the Our Cause page within 30 seconds of publish.
- **SC-003**: 99% of valid card configurations are saved without validation-related support intervention.
- **SC-004**: At least 80% of pilot events use card reordering and visibility controls for both custom and built-in sections within the first month.
- **SC-005**: Support requests related to "cannot customize Our Cause sections" decrease by at least 50% within one release cycle after rollout.
