"""Unit tests for SocialAuthService._build_authorization_url."""

import urllib.parse

from app.schemas.social_auth import ProviderKey
from app.services.social_auth_service import SocialAuthService


def test_google_auth_url_includes_select_account_prompt() -> None:
    """Google authorization URL must include prompt=select_account."""
    url = SocialAuthService._build_authorization_url(
        provider=ProviderKey.GOOGLE,
        state="test_state",
        redirect_uri="https://example.com/callback",
        pkce_verifier="verifier",
    )
    params = dict(urllib.parse.parse_qsl(urllib.parse.urlparse(url).query))
    assert params.get("prompt") == "select_account", (
        "Google OAuth URL must include prompt=select_account so users see the account picker"
    )


def test_non_google_providers_do_not_include_prompt() -> None:
    """Non-Google providers should not have a prompt parameter injected."""
    for provider in (ProviderKey.FACEBOOK, ProviderKey.MICROSOFT):
        url = SocialAuthService._build_authorization_url(
            provider=provider,
            state="test_state",
            redirect_uri="https://example.com/callback",
            pkce_verifier="verifier",
        )
        params = dict(urllib.parse.parse_qsl(urllib.parse.urlparse(url).query))
        assert "prompt" not in params, (
            f"Provider {provider} should not have prompt injected into its auth URL"
        )
