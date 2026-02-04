---
description: "Task list for Image Generator Utility (Dev CLI)"
---

# Tasks: Image Generator Utility (Dev CLI)

**Input**: Design documents from /specs/020-image-generator-util/
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not requested in the specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: [ID] [P?] [Story] Description
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Ensure CLI script location exists at backend/scripts/image_generator_cli.py
- [ ] T002 Add OpenAI Python SDK dependency in backend/pyproject.toml (poetry add openai)
- [ ] T003 [P] Add environment variable documentation in backend/README.md for Azure OpenAI settings

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [ ] T004 Implement config loading and validation for required env vars in backend/scripts/image_generator_cli.py
- [ ] T005 Implement JSON loading and schema validation (single vs list fields) in backend/scripts/image_generator_cli.py
- [ ] T006 Implement filename sanitization helper and uniqueness handling in backend/scripts/image_generator_cli.py

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Generate demo images from a JSON list (Priority: P1) 🎯 MVP

**Goal**: Generate and save images for each prompt in the input JSON.

**Independent Test**: Run the CLI against a small JSON file with valid prompts and confirm images are saved to the output folder.

### Implementation for User Story 1

- [ ] T007 [US1] Implement CLI argument parsing for input/output/prompt prefix/suffix in backend/scripts/image_generator_cli.py
- [ ] T008 [US1] Implement prompt preparation and iteration over items/prompts in backend/scripts/image_generator_cli.py
- [ ] T009 [US1] Implement Azure OpenAI image generation call and base64 decoding in backend/scripts/image_generator_cli.py
- [ ] T010 [US1] Implement file write flow to output folder in backend/scripts/image_generator_cli.py

**Checkpoint**: User Story 1 functional and testable independently

---

## Phase 4: User Story 2 - Safe, predictable file naming (Priority: P2)

**Goal**: Ensure filenames are sanitized, unique, and derived from item name + image filename.

**Independent Test**: Use item names with special characters and duplicate filenames and verify outputs are sanitized and uniquely indexed.

### Implementation for User Story 2

- [ ] T011 [US2] Apply sanitized naming rules and collision resolution to output filenames in backend/scripts/image_generator_cli.py
- [ ] T012 [US2] Implement skip-existing behavior with logged status in backend/scripts/image_generator_cli.py

**Checkpoint**: User Story 2 functional and testable independently

---

## Phase 5: User Story 3 - Transparent progress and failure handling (Priority: P3)

**Goal**: Provide clear logging, summaries, and stop-on-failure behavior.

**Independent Test**: Include one invalid prompt and confirm the run logs progress, fails fast, and outputs a summary.

### Implementation for User Story 3

- [ ] T013 [US3] Implement structured logging for per-item/prompt progress in backend/scripts/image_generator_cli.py
- [ ] T014 [US3] Implement run summary output (saved/skipped/failed counts) in backend/scripts/image_generator_cli.py
- [ ] T015 [US3] Enforce stop-on-first-generation-failure behavior in backend/scripts/image_generator_cli.py

**Checkpoint**: User Story 3 functional and testable independently

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final documentation and usability checks

- [ ] T016 [P] Update backend/README.md with CLI usage example and flags
- [ ] T017 [P] Validate quickstart example against current CLI flags in specs/020-image-generator-util/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: Depend on Foundational phase completion
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Independent of US1 output
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Independent of US1/US2 output

### Parallel Opportunities

- T002 and T003 can run in parallel with T001
- T004, T005, and T006 can run in parallel once setup completes
- User story phases can proceed in parallel after Phase 2, with no shared file conflicts if coordinated

---

## Parallel Example: User Story 1

```bash
Task: "Implement CLI argument parsing for input/output/prompt prefix/suffix in backend/scripts/image_generator_cli.py"
Task: "Implement prompt preparation and iteration over items/prompts in backend/scripts/image_generator_cli.py"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. STOP and validate User Story 1 independently

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Validate
3. Add User Story 2 → Validate
4. Add User Story 3 → Validate
5. Finish Polish phase
