"""Celery application configuration for background task processing."""

from celery import Celery

from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "fundrbolt",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=[
        "app.tasks.notification_tasks",
        "app.tasks.run_of_show_tasks",
        "app.tasks.recurring_donation_tasks",
        "app.tasks.checkout_tasks",
        "app.tasks.payment_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    # Force broker-backed async execution for runtime reliability.
    # Eager mode in this app path executes tasks inline and can trigger
    # nested event-loop/asyncpg issues in notification delivery.
    task_always_eager=False,
    task_eager_propagates=False,
    worker_prefetch_multiplier=1,
    task_routes={
        "app.tasks.notification_tasks.*": {"queue": "notifications"},
        "app.tasks.run_of_show_tasks.*": {"queue": "notifications"},
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
