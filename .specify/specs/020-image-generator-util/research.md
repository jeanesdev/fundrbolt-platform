# Research Findings: Image Generator Utility (Dev CLI)

## Decision 1: Use Azure OpenAI image generation via official Python client
- **Decision**: Use the official OpenAI Python SDK configured for Azure OpenAI endpoints for image generation.
- **Rationale**: The SDK is the supported client for Azure OpenAI, simplifies authentication and request construction, and aligns with Python 3.11+ support.
- **Alternatives considered**:
  - Direct REST calls (more boilerplate and manual error handling).
  - Legacy Azure OpenAI SDKs (inconsistent or deprecated APIs).

## Decision 2: Receive image content as base64 in the response
- **Decision**: Request base64-encoded image content in the response and write it to disk directly.
- **Rationale**: Avoids additional HTTP downloads, reduces failure points, and ensures consistent output handling.
- **Alternatives considered**:
  - URL-based downloads (extra network calls and expiration handling).

## Decision 3: Support both single and multi-image fields in JSON
- **Decision**: Accept either `image_prompt`/`image_filename` (single) or `image_prompts`/`image_filenames` (lists) per item.
- **Rationale**: Matches existing example data and reduces the need for pre-processing.
- **Alternatives considered**:
  - Enforce one canonical schema (would require JSON normalization).

## Decision 4: Simple, deterministic filename sanitization
- **Decision**: Sanitize filenames by allowing alphanumeric characters, hyphens, underscores, and dots; replace spaces with hyphens; trim length; ensure uniqueness with numeric suffixes.
- **Rationale**: Portable across filesystems and deterministic for repeatable runs.
- **Alternatives considered**:
  - Full slugification libraries (additional dependency not required for dev utility).

## Decision 5: Deterministic behavior for reruns
- **Decision**: Skip existing output files and log them as skipped; stop on first generation failure.
- **Rationale**: Prevents accidental overwrites while keeping run outcomes predictable; immediate failure prevents partial mixed sets.
- **Alternatives considered**:
  - Always overwrite (risk of accidental loss).
  - Continue on failure (could create partial sets without clear stopping point).
