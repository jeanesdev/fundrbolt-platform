"""Application configuration using Pydantic Settings."""

from functools import lru_cache
from typing import Literal

from pydantic import EmailStr, PostgresDsn, RedisDsn, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Project
    project_name: str = "Fundrbolt Platform API"

    # Environment
    environment: Literal["development", "staging", "production", "test"] = "development"
    debug: bool = False

    # Database
    database_url: PostgresDsn

    # Redis
    redis_url: RedisDsn

    # JWT Configuration
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # Azure Communication Services (Email) - Optional for local dev
    azure_communication_connection_string: str | None = None
    email_from_address: EmailStr
    email_from_name: str = "Fundrbolt Platform"

    # Azure Blob Storage (for NPO logo uploads) - Optional for local dev
    azure_storage_connection_string: str | None = None
    azure_storage_container_name: str = "npo-assets"
    azure_storage_account_name: str | None = None

    # Azure CDN (for branding assets in emails)
    azure_cdn_logo_base_url: str = "https://fundrboltdevstor.blob.core.windows.net/branding/logos"

    # Frontend URLs (for email links)
    frontend_admin_url: str = "http://localhost:5173"
    frontend_donor_url: str = "http://localhost:5174"

    # Social Authentication
    social_auth_enabled: bool = False
    social_auth_enabled_providers: str = "apple,google,facebook,microsoft"
    social_auth_callback_base_url: str = "http://localhost:8000/api/v1"
    social_auth_apple_client_id: str | None = None
    social_auth_apple_client_secret: str | None = None
    social_auth_google_client_id: str | None = None
    social_auth_google_client_secret: str | None = None
    social_auth_facebook_client_id: str | None = None
    social_auth_facebook_client_secret: str | None = None
    social_auth_microsoft_client_id: str | None = None
    social_auth_microsoft_client_secret: str | None = None

    # Super Admin Seed (for initial setup)
    super_admin_email: EmailStr
    super_admin_password: str
    super_admin_first_name: str = "Super"
    super_admin_last_name: str = "Admin"

    # Rate Limiting
    rate_limit_login_attempts: int = 5
    rate_limit_login_window_minutes: int = 15

    # CORS
    cors_origins: str = (
        "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174"
    )

    def get_cors_origins_list(self) -> list[str]:
        """Parse CORS origins from comma-separated string."""
        parsed_origins = [
            origin.strip() for origin in self.cors_origins.split(",") if origin.strip()
        ]

        origin_set = set(parsed_origins)
        for origin in parsed_origins:
            if "localhost" in origin:
                origin_set.add(origin.replace("localhost", "127.0.0.1"))
            if "127.0.0.1" in origin:
                origin_set.add(origin.replace("127.0.0.1", "localhost"))

        return sorted(origin_set)

    @field_validator("jwt_secret_key")
    @classmethod
    def validate_jwt_secret(cls, v: str) -> str:
        """Ensure JWT secret is long enough."""
        if len(v) < 32:
            raise ValueError("JWT_SECRET_KEY must be at least 32 characters")
        return v

    @field_validator("social_auth_enabled_providers")
    @classmethod
    def validate_social_auth_enabled_providers(cls, v: str) -> str:
        """Ensure configured social auth providers are supported."""
        allowed_providers = {"apple", "google", "facebook", "microsoft"}
        configured_providers = {
            provider.strip().lower() for provider in v.split(",") if provider.strip()
        }
        invalid_providers = configured_providers - allowed_providers
        if invalid_providers:
            invalid_list = ", ".join(sorted(invalid_providers))
            raise ValueError(f"Invalid SOCIAL_AUTH_ENABLED_PROVIDERS values: {invalid_list}")
        return ",".join(sorted(configured_providers))

    def get_social_auth_enabled_providers(self) -> list[str]:
        """Get normalized social auth enabled providers list."""
        return [
            provider.strip().lower()
            for provider in self.social_auth_enabled_providers.split(",")
            if provider.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()  # type: ignore[call-arg]
