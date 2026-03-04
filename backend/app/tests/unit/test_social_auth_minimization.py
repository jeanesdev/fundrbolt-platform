"""Unit tests for provider claim minimization."""

from app.schemas.social_auth import ProviderKey
from app.services.social_auth_service import SocialAuthService


def test_simulated_claims_contain_only_whitelisted_fields() -> None:
    """Verify simulated provider claims only include whitelisted fields."""
    allowed_keys = {"sub", "email", "email_verified", "name", "given_name", "family_name"}
    claims = SocialAuthService._simulate_provider_claims(ProviderKey.GOOGLE, "test_code")
    for key in claims:
        assert key in allowed_keys, f"Unexpected claim field: {key}"


def test_simulated_claims_exclude_sensitive_fields() -> None:
    """Verify claims don't include sensitive provider metadata."""
    sensitive_keys = {"access_token", "refresh_token", "id_token", "password", "secret"}
    claims = SocialAuthService._simulate_provider_claims(ProviderKey.GOOGLE, "test_code")
    for key in sensitive_keys:
        assert key not in claims, f"Sensitive field found in claims: {key}"


def test_provider_scopes_are_minimal() -> None:
    """Verify each provider requests only minimal scopes."""
    scopes = SocialAuthService._get_scopes(ProviderKey.GOOGLE)
    assert "openid" in scopes
    assert "email" in scopes
    # Should not request excessive permissions
    excessive = {"contacts", "calendar", "drive", "photos", "admin"}
    for scope in scopes:
        assert scope not in excessive, f"Excessive scope: {scope}"
