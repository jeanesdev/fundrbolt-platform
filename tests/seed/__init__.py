"""Seed package helpers for beta integration fixtures."""

from __future__ import annotations

import sys
from pathlib import Path

SEED_DIR = Path(__file__).resolve().parent
REPO_ROOT = SEED_DIR.parent.parent
BACKEND_DIR = REPO_ROOT / "backend"

for path in (str(BACKEND_DIR), str(SEED_DIR)):
    if path not in sys.path:
        sys.path.insert(0, path)
