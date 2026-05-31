from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal

import factory

from app.models.event import Event, EventStatus
from app.models.event_table import EventTable

from .base import BaseFactory


class EventFactory(BaseFactory):
    class Meta:
        model = Event

    name = factory.Sequence(lambda n: f"Seed Event {n}")
    slug = factory.Sequence(lambda n: f"seed-event-{n}")
    status = EventStatus.DRAFT
    event_datetime = factory.LazyFunction(
        lambda: datetime.now(UTC) + timedelta(days=30)
    )
    timezone = "America/New_York"
    venue_name = "FundrBolt Hall"
    venue_address = "100 Giving Way"
    venue_city = "Austin"
    venue_state = "Texas"
    venue_zip = "73301"
    fundraising_goal = Decimal("50000.00")
    logo_url = factory.LazyAttribute(
        lambda o: f"https://example.test/assets/{o.slug}.png"
    )
    primary_color = "#11294c"
    secondary_color = "#f59e0b"
    background_color = "#ffffff"
    accent_color = "#2563eb"
    hero_transition_style = "fade"
    table_count = 5
    max_guests_per_table = 50
    checkout_open = True
    version = 1
    updated_by = factory.SelfAttribute("created_by")


class EventTableFactory(BaseFactory):
    class Meta:
        model = EventTable

    table_number = factory.Sequence(lambda n: n + 1)
    custom_capacity = None
    table_name = factory.LazyAttribute(lambda o: f"Table {o.table_number}")
