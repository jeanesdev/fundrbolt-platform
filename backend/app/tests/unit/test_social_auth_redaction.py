"""Unit tests for social auth log redaction policy."""

from app.schemas.social_auth import ProviderKey
from app.services.social_auth_service import SocialAuthService


def test_simulated_claims_do_not_contain_tokens() -> None:
    """Verify provider claims never include raw tokens or secrets."""
    claims = SocialAuthService._simulate_provider_claims(ProviderKey.GOOGLE, "test_code")
    forbidden = {"access_token", "refresh_token", "id_token", "client_secret"}
    for key in forbidden:
        assert key not in claims, f"Raw token/secret found in claims: {key}"


def test_simulated_claims_sub_is_opaque() -> None:
    """Verify the sub claim is a provider-scoped opaque identifier."""
    claims = SocialAuthService._simulate_provider_claims(ProviderKey.GOOGLE, "test_code")
    assert "sub" in claims
    # Sub should start with provider prefix
    assert claims["sub"].startswith("google_")


def test_different_providers_produce_distinct_subs() -> None:
    """Verify different providers produce different sub identifiers."""
    google_claims = SocialAuthService._simulate_provider_claims(ProviderKey.GOOGLE, "code1")
    apple_claims = SocialAuthService._simulate_provider_claims(ProviderKey.APPLE, "code1")
    assert google_claims["sub"] != apple_claims["sub"]


def test_provider_claims_email_is_present() -> None:
    """Verify claims always contain an email field."""
    for provider in ProviderKey:
        claims = SocialAuthService._simulate_provider_claims(provider, "test")
        assert "email" in claims, f"Email missing for provider {provider.value}"
