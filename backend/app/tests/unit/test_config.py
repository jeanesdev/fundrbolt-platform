"""Unit tests for Settings validation."""

import pytest
from pydantic import ValidationError

from app.core.config import Settings


def _settings(**overrides: object) -> Settings:
    base = {
        "database_url": "postgresql://user:password@localhost:5432/fundrbolt",
        "redis_url": "redis://localhost:6379/0",
        "jwt_secret_key": "x" * 32,
    }
    base.update(overrides)
    return Settings(**base)


def test_email_backend_defaults_to_azure_acs(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EMAIL_BACKEND", raising=False)
    settings = _settings()
    assert settings.email_backend == "azure_acs"


@pytest.mark.parametrize("backend_name", ["mailpit", "console", "azure_acs"])
def test_email_backend_accepts_supported_values(backend_name: str) -> None:
    settings = _settings(email_backend=backend_name)
    assert settings.email_backend == backend_name


def test_email_backend_rejects_invalid_value() -> None:
    with pytest.raises(ValidationError):
        _settings(email_backend="ses")
