"""Celery application configuration for background task processing."""

from celery import Celery

from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "fundrbolt",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    task_always_eager=settings.celery_task_always_eager,
    task_eager_propagates=settings.celery_task_always_eager,
    worker_prefetch_multiplier=1,
    task_routes={
        "app.tasks.notification_tasks.*": {"queue": "notifications"},
    },
    beat_schedule={
        "purge-expired-notifications": {
            "task": "app.tasks.notification_tasks.purge_expired_notifications",
            "schedule": 86400.0,  # daily
        },
        "process-monthly-donations": {
            "task": "app.tasks.recurring_donation_tasks.process_monthly_donations",
            "schedule": 86400.0,  # daily at celery beat startup time
        },
    },
)

celery_app.autodiscover_tasks(["app.tasks"])
