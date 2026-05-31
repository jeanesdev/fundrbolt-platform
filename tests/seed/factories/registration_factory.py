from __future__ import annotations

import factory

from app.models.event_registration import EventRegistration
from app.models.registration_guest import RegistrationGuest

from .base import BaseFactory


class RegistrationFactory(BaseFactory):
    class Meta:
        model = EventRegistration

    number_of_guests = 1


class RegistrationGuestFactory(BaseFactory):
    class Meta:
        model = RegistrationGuest

    name = factory.Faker("name")
    email = factory.LazyAttribute(
        lambda o: f"{o.name.replace(' ', '.').lower()}@fundrbolt.com"
    )
    phone = "+1-555-0101"
    invited_by_admin = False
    checked_in = False
    status = "confirmed"
    is_primary = False
    is_table_captain = False
