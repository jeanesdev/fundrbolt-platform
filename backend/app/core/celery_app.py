"""Celery application instance for FundrBolt background tasks.

Reads broker URL from CELERY_BROKER_URL env var (defaults to REDIS_URL with db 1).
Result backend uses the same Redis instance.

Usage:
    from app.core.celery_app import celery_app

Beat schedule entries:
  - expire_pending_transactions: every 5 minutes
  - retry_failed_receipts: every 10 minutes
"""

from celery import Celery

from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "fundrbolt",
    broker=str(settings.celery_broker_url),
    backend=str(settings.celery_broker_url),
    include=["app.tasks.payment_tasks"],
)

celery_app.conf.update(
    timezone="UTC",
    enable_utc=True,
    task_always_eager=False,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)

celery_app.conf.beat_schedule = {
    "expire-pending-transactions": {
        "task": "app.tasks.payment_tasks.expire_pending_transactions",
        "schedule": 300.0,  # every 5 minutes
    },
    "retry-failed-receipts": {
        "task": "app.tasks.payment_tasks.retry_failed_receipts",
        "schedule": 600.0,  # every 10 minutes
    },
}
