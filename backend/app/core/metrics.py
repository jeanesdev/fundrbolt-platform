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

# Event metrics
EVENTS_CREATED_TOTAL = Counter(
    "augeo_events_created_total",
    "Total number of events created",
    ["npo_id"],
)

EVENTS_PUBLISHED_TOTAL = Counter(
    "augeo_events_published_total",
    "Total number of events published",
)

EVENTS_CLOSED_TOTAL = Counter(
    "augeo_events_closed_total",
    "Total number of events closed",
    ["closure_type"],  # manual or automatic
)

EVENT_MEDIA_UPLOADS_TOTAL = Counter(
    "augeo_event_media_uploads_total",
    "Total number of media files uploaded",
    ["status"],  # success or failure
)

EVENT_MEDIA_SCAN_RESULTS_TOTAL = Counter(
    "augeo_event_media_scan_results_total",
    "Total number of virus scan results",
    ["result"],  # clean or infected
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
    "EVENTS_CREATED_TOTAL",
    "EVENTS_PUBLISHED_TOTAL",
    "EVENTS_CLOSED_TOTAL",
    "EVENT_MEDIA_UPLOADS_TOTAL",
    "EVENT_MEDIA_SCAN_RESULTS_TOTAL",
    "UP",
    "set_up",
]
