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

    # Super Admin Seed (for initial setup)
    super_admin_email: EmailStr
    super_admin_password: str
    super_admin_first_name: str = "Super"
    super_admin_last_name: str = "Admin"

    # Rate Limiting
    rate_limit_login_attempts: int = 5
    rate_limit_login_window_minutes: int = 15

    # CORS
    cors_origins: str = "http://localhost:5173,http://localhost:5174"

    def get_cors_origins_list(self) -> list[str]:
        """Parse CORS origins from comma-separated string."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @field_validator("jwt_secret_key")
    @classmethod
    def validate_jwt_secret(cls, v: str) -> str:
        """Ensure JWT secret is long enough."""
        if len(v) < 32:
            raise ValueError("JWT_SECRET_KEY must be at least 32 characters")
        return v


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()  # type: ignore[call-arg]
