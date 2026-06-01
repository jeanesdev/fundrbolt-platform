"""
Root-level pytest configuration.

Sets local test service URLs before any app module is imported.
In CI, DATABASE_URL / REDIS_URL are already present in os.environ (set by the
workflow's `env:` block), so these defaults are never applied there.
Locally, they are absent from os.environ (pydantic reads them from .env only
at Settings() instantiation time, which happens *after* this file runs), so
the defaults here ensure tests always use the local Docker services rather
than whatever remote URL is in .env.
"""

import os

if "DATABASE_URL" not in os.environ:
    os.environ["DATABASE_URL"] = (
        "postgresql+asyncpg://fundrbolt_user:fundrbolt_password@localhost:5432/fundrbolt_db"
    )

if "REDIS_URL" not in os.environ:
    os.environ["REDIS_URL"] = "redis://localhost:6379/0"

if "EMAIL_BACKEND" not in os.environ:
    os.environ["EMAIL_BACKEND"] = "console"

if "PAYMENT_GATEWAY_BACKEND" not in os.environ:
    os.environ["PAYMENT_GATEWAY_BACKEND"] = "stub"
