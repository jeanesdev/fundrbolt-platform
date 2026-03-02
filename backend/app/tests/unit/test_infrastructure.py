"""Smoke tests for Phase 2 infrastructure."""

import pytest


@pytest.mark.unit
class TestInfrastructure:
    """Basic smoke tests to verify Phase 2 infrastructure is set up correctly."""

    def test_config_loads(self) -> None:
        """Test that configuration can be loaded."""
        from app.core.config import get_settings

        settings = get_settings()
        assert settings.project_name == "Fundrbolt Platform API"
        assert settings.jwt_algorithm == "HS256"

    def test_database_imports(self) -> None:
        """Test that database modules can be imported."""
        from app.core.database import async_engine, get_db

        assert async_engine is not None
        assert callable(get_db)

    def test_redis_imports(self) -> None:
        """Test that Redis modules can be imported."""
        from app.core.redis import RedisKeys, get_redis

        assert callable(get_redis)
        assert RedisKeys.session("test") == "session:test"

    def test_base_models_import(self) -> None:
        """Test that base models can be imported."""
        from app.models.base import Base, TimestampMixin, UUIDMixin

        assert Base is not None
        assert TimestampMixin is not None
        assert UUIDMixin is not None

    def test_error_classes_import(self) -> None:
        """Test that error classes can be imported."""
        from app.core.errors import (
            AuthenticationError,
        )

        # Test instantiation
        auth_error = AuthenticationError(detail="Test")
        assert auth_error.status_code == 401

    def test_logging_setup(self) -> None:
        """Test that logging can be set up."""
        from app.core.logging import get_logger, setup_logging

        setup_logging()
        logger = get_logger(__name__)
        assert logger is not None

    def test_fastapi_app_imports(self) -> None:
        """Test that FastAPI app can be imported."""
        from app.main import app

        assert app is not None
        assert app.title == "Fundrbolt Platform API"
