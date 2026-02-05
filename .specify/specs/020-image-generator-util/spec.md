# Feature Specification: Image Generator Utility (Dev CLI)

**Feature Branch**: `020-image-generator-util`
**Created**: 2026-02-04
**Status**: Draft
**Input**: User description: "image-generator-util Create a dev-only CLI utility (no API usage) that reads a JSON file of auction items like ignore/example_auction_items.json with 1+ image prompts per item, sends each prompt to Azure OpenAI image generation, downloads the images, and saves them locally under filenames derived from item names. CLI uses flags like --input <json>, --output <folder>, etc. Support multiple prompts per item and name each image with the image_filename from json with index if > 1 image per item. Ensure safe filename sanitization and log progress/errors. Target Python 3.11+ with Poetry, place under backend/scripts or backend/app/tasks, and document usage in backend/README.md."

## Clarifications

### Session 2026-02-04

- Q: How should the CLI handle existing output files? → A: Skip existing files and log as skipped.
- Q: Should the CLI allow optional prompt prefix/suffix flags that apply to all prompts? → A: Yes, allow optional prompt prefix/suffix flags that apply to all prompts.
- Q: Should the output folder be required? → A: Yes, the CLI must require an explicit output folder and fail if missing.
- Q: How should the CLI behave when credentials are missing? → A: Fail the run with an error if credentials are missing.
- Q: What should the CLI do after the first generation failure? → A: Stop on first failure.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate demo images from a JSON list (Priority: P1)

As a developer, I want to run a command-line utility that reads a JSON file of auction items with image prompts and saves generated images to a local folder so I can quickly create demo assets for testing.

**Why this priority**: This is the primary reason for the utility and the minimum viable value.

**Independent Test**: Provide a small JSON file with two items and at least one prompt each, run the CLI with input/output options, and verify image files are written for every prompt.

**Acceptance Scenarios**:

1. **Given** a valid JSON file with multiple items and prompts, **When** the CLI is run with an output folder, **Then** the tool generates one image per prompt and saves them to the output folder.
2. **Given** an item with multiple prompts, **When** the CLI is run, **Then** the saved filenames are derived from the item name and the image filename in the JSON and uniquely indexed when multiple images exist.

---

### User Story 2 - Safe, predictable file naming (Priority: P2)

As a developer, I want filenames to be safe for common filesystems so that saved images are easy to find and do not fail due to invalid characters.

**Why this priority**: Prevents failed runs and ensures assets are reusable.

**Independent Test**: Use item names with special characters and long names, then verify output filenames are sanitized and still identifiable.

**Acceptance Scenarios**:

1. **Given** item names with special characters or spaces, **When** the CLI saves images, **Then** filenames are sanitized and remain unique and readable.

---

### User Story 3 - Transparent progress and failure handling (Priority: P3)

As a developer, I want clear progress logging and error summaries so I can rerun only what failed without guessing.

**Why this priority**: Improves efficiency and reduces troubleshooting time.

**Independent Test**: Include one intentionally invalid prompt or unreachable generation target and verify the run completes, logs the failure, and reports a summary.

**Acceptance Scenarios**:

1. **Given** a mix of valid and invalid prompts, **When** the CLI runs, **Then** it logs progress for each prompt, records failures, and completes the run with a summary of successes and failures.

---

### Edge Cases

- JSON file is missing required fields or has invalid structure.
- Output folder does not exist or is not writable.
- Two prompts would produce identical filenames without an index.
- Item name is extremely long or contains only invalid filename characters.
- No prompts provided for an item.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a command-line interface that accepts an input JSON file path and an output folder path as options.
- **FR-002**: The system MUST read a list of auction items where each item can contain one or more image prompts.
- **FR-003**: The system MUST generate one image per prompt and save each image as a local file in the output folder.
- **FR-004**: The system MUST derive filenames from the item name and the image filename provided in the JSON, adding a numeric index when an item has multiple images or a filename collision would occur.
- **FR-005**: The system MUST sanitize filenames to be safe and portable across common filesystems.
- **FR-006**: The system MUST log progress for each item and prompt and provide a run summary including counts of successes and failures.
- **FR-007**: The system MUST continue processing remaining prompts when one prompt fails, and record the failure in the run summary.
- **FR-008**: The system MUST be usable only as a development-time command-line utility and MUST NOT be exposed via an application API.
- **FR-009**: The system MUST skip generation for outputs that already exist, log them as skipped, and continue processing remaining prompts.
- **FR-010**: The system MUST allow optional prompt prefix and/or suffix options that apply to every prompt in the input file.
- **FR-011**: The system MUST require an explicit output folder option and fail with an error if it is missing.
- **FR-012**: The system MUST fail the run with a clear error when required credentials are missing.
- **FR-013**: The system MUST stop processing further prompts after the first generation failure.

### Key Entities *(include if feature involves data)*

- **Auction Item**: A record containing an item name and one or more image prompts.
- **Image Prompt**: A text prompt associated with an auction item that requests an image.
- **Generated Image**: A locally saved file produced for an image prompt, with a sanitized filename.
- **Run Summary**: A record of totals for processed prompts, successes, and failures with error details.

### Assumptions & Dependencies

- The developer has access to an image generation service suitable for development and testing.
- The input JSON file follows a consistent structure with required fields for item names, prompts, and image filenames.
- The output folder is a local filesystem path where the developer has write permissions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a valid input file, 100% of prompts produce corresponding image files in the output folder.
- **SC-002**: Filenames are unique and sanitized for 100% of saved images, including items with duplicate or invalid names.
- **SC-003**: The CLI run reports a summary with counts of total prompts, successes, and failures on every execution.
- **SC-004**: A developer can complete a full demo-image generation run for at least 25 prompts in under 10 minutes on a standard development workstation.
