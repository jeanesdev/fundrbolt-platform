"""Prometheus metrics helpers and common metrics definitions.

This module exposes counters and helpers that other modules can import and
increment. The /metrics endpoint will use the default registry to expose
metrics in Prometheus text format.
"""

from prometheus_client import Counter, Gauge

# HTTP request counter (labels added later when middleware is added)
HTTP_REQUESTS_TOTAL = Counter(
    "augeo_http_requests_total",
    "Total number of HTTP requests processed",
    ["method", "path", "status"],
)

# Failure counters for key subsystems
DB_FAILURES_TOTAL = Counter("augeo_db_failures_total", "Total DB failure events")
REDIS_FAILURES_TOTAL = Counter("augeo_redis_failures_total", "Total Redis failure events")
EMAIL_FAILURES_TOTAL = Counter("augeo_email_failures_total", "Total email send failures")

# Contact form submission counters
CONTACT_SUBMISSIONS_TOTAL = Counter(
    "augeo_contact_submissions_total",
    "Total number of contact form submissions",
    ["status"],  # success or failure
)

# Simple gauges for introspection
UP = Gauge("augeo_up", "Application up (1 = up, 0 = down)")


def set_up(value: int = 1) -> None:
    """Set the `augeo_up` gauge (1 for up, 0 for down)."""

    UP.set(value)


__all__ = [
    "HTTP_REQUESTS_TOTAL",
    "DB_FAILURES_TOTAL",
    "REDIS_FAILURES_TOTAL",
    "EMAIL_FAILURES_TOTAL",
    "CONTACT_SUBMISSIONS_TOTAL",
    "UP",
    "set_up",
]
