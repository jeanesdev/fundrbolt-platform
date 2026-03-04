"""Structured logging configuration."""

import json
import logging
import re
import sys
from datetime import datetime
from typing import Any

from app.core.config import get_settings

settings = get_settings()

# Patterns to redact from log messages (social auth tokens, secrets)
_REDACT_PATTERNS = [
    re.compile(
        r"(access_token|refresh_token|id_token|code|state|pkce_verifier|step_up_token|verification_token|confirmation_token)=([^\s&]+)",
        re.IGNORECASE,
    ),
    re.compile(r"(Bearer\s+)[A-Za-z0-9\-._~+/]+=*", re.IGNORECASE),
]


def redact_sensitive(text: str) -> str:
    """Replace sensitive tokens/secrets in text with [REDACTED]."""
    for pattern in _REDACT_PATTERNS:
        text = pattern.sub(lambda m: f"{m.group(1)}[REDACTED]", text)
    return text


class JSONFormatter(logging.Formatter):
    """Custom JSON formatter for structured logging."""

    def format(self, record: logging.LogRecord) -> str:
        """Format log record as JSON.

        Args:
            record: Log record

        Returns:
            str: JSON formatted log entry
        """
        log_data: dict[str, Any] = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": redact_sensitive(record.getMessage()),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        # Add extra fields if present
        if hasattr(record, "user_id"):
            log_data["user_id"] = record.user_id
        if hasattr(record, "request_id"):
            log_data["request_id"] = record.request_id
        if hasattr(record, "ip_address"):
            log_data["ip_address"] = record.ip_address

        return json.dumps(log_data)


def setup_logging() -> None:
    """Configure application logging.

    Sets up:
    - JSON formatted logs for production
    - Console logs for development
    - Appropriate log levels based on environment
    """
    # Determine log level
    if settings.debug:
        log_level = logging.DEBUG
    else:
        log_level = logging.INFO

    # Create handler
    handler = logging.StreamHandler(sys.stdout)

    # Set formatter based on environment
    if settings.environment == "production":
        handler.setFormatter(JSONFormatter())
    else:
        # Human-readable format for development
        formatter = logging.Formatter(
            fmt="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    root_logger.addHandler(handler)

    # Reduce noise from third-party libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Get a logger instance.

    Args:
        name: Logger name (typically __name__)

    Returns:
        logging.Logger: Configured logger

    Example:
        logger = get_logger(__name__)
        logger.info("User logged in", extra={"user_id": user.id})
    """
    return logging.getLogger(name)
