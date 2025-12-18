# Fundrbolt Rename Checklist

Generated: 2025-12-18
Source: Derived from research.md plus fresh grep counts of "Fundrbolt" across the monorepo.

## Current Fundrbolt Reference Counts (pre-rename)
- Code: 2,867 (backend 2,715; frontend/fundrbolt-admin 48; frontend/donor-pwa 62; frontend/landing-site 39; frontend/shared 3)
- Infrastructure: 247 (infrastructure/*)
- Documentation: 1,456 (docs 560; .specify 896)
- GitHub workflows/config: 70 (.github/*)
- Total tracked: 4,630

Command used (no ripgrep available):
```
grep -R -i "fundrbolt" <path> --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.venv \
  --exclude=*.png --exclude=*.jpg --exclude=*.jpeg --exclude=*.gif --exclude=*.svg --exclude=*.ico \
  --exclude=*.pdf --exclude=*.woff --exclude=*.woff2 --exclude=*.ttf --exclude=*.eot
```

## Hotspots
- backend/: High density of Fundrbolt strings in config, API responses, middleware, tests.
- infrastructure/: Resource names, parameters, and scripts carry Fundrbolt identifiers.
- docs/ and .specify/: Specification and documentation contain legacy brand text; update after implementation.
- .github/: Workflow names, artifact labels, and repository references.

## Tracking Notes
- Re-run counts after each phase (Foundational, US1, US2, US3) to confirm reductions.
- Keep this checklist updated with any newly discovered references or special cases.
