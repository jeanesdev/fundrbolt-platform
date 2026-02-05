# Implementation Plan: Image Generator Utility (Dev CLI)

**Branch**: `020-image-generator-util` | **Date**: 2026-02-04 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/020-image-generator-util/spec.md`

## Summary

Build a dev-only CLI utility that reads auction item image prompts from JSON, generates images via Azure OpenAI, and saves sanitized, uniquely named files locally. The approach uses the official Azure OpenAI Python client, base64 image responses, and deterministic skip/fail behaviors per the clarified requirements.

## Technical Context

**Language/Version**: Python 3.11+
**Primary Dependencies**: OpenAI Python SDK (Azure OpenAI), standard library (argparse, json, pathlib, logging)
**Storage**: Local filesystem (image output folder)
**Testing**: pytest (focused on parsing, naming, and error handling)
**Target Platform**: Linux/macOS/Windows CLI (dev workstation)
**Project Type**: Backend utility (CLI script under backend/scripts)
**Performance Goals**: Generate at least 25 prompts in under 10 minutes on a standard dev workstation
**Constraints**: Dev-only CLI, no API exposure; requires output folder; skip existing files; stop on first generation failure; fail if credentials missing
**Scale/Scope**: Tens to hundreds of prompts per run; single-user execution

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Donor-Driven Engagement | Pass | Dev-only utility does not affect donor UX. |
| Real-Time Reliability | Pass | Not applicable to CLI batch generation. |
| Production-Grade Quality | Pass | CLI will be documented, testable, and maintainable. |
| Solo Developer Efficiency | Pass | Minimal, focused scope with standard tooling. |
| Data Security and Privacy | Pass | No user PII processed; credentials from env only. |
| Minimalist Development (YAGNI) | Pass | Only requirements specified in spec are included. |

**Post-Design Re-check**: Pass (no violations introduced in Phase 1 artifacts).

## Project Structure

### Documentation (this feature)

```
specs/020-image-generator-util/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── README.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
backend/
├── scripts/
│   └── image_generator_cli.py
└── README.md

backend/
└── app/
    └── tasks/
        └── image_generation/  # (only if split into modules)
```

**Structure Decision**: Implement as a single CLI script under backend/scripts, with optional helper module(s) under backend/app/tasks only if needed for shared utilities.

## Phase 0: Outline & Research

**Outputs**:
- [research.md](research.md)

## Phase 1: Design & Contracts

**Data Model**:
- [data-model.md](data-model.md)

**Contracts**:
- [contracts/README.md](contracts/README.md) (no API endpoints for CLI utility)

**Quickstart**:
- [quickstart.md](quickstart.md)

**Agent Context Update**:
- Run update script to sync agent context after Phase 1 artifacts.

## Phase 2: Implementation Planning (Preview)

- Implement CLI argument parsing and validation.
- Implement JSON parsing for single vs multi prompt fields.
- Implement prompt prefix/suffix application.
- Implement Azure OpenAI image generation client wrapper.
- Implement filename sanitization and collision handling.
- Implement file writing, skip existing behavior, and stop-on-failure handling.
- Add logging and summary output.
- Document usage in backend/README.md.
- Add tests for parsing, naming, and error behaviors.

## Complexity Tracking

No constitution violations; no complexity exceptions required.
