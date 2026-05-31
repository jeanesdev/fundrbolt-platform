from __future__ import annotations

import os

import factory

from app.core.security import hash_password
from app.models.user import User

from .base import BaseFactory


class UserFactory(BaseFactory):
    class Meta:
        model = User

    email = factory.Sequence(lambda n: f"automation+user{n}@fundrbolt.com")
    first_name = factory.Faker("first_name")
    last_name = factory.Faker("last_name")
    phone = "+1-555-0100"
    password_hash = factory.LazyFunction(
        lambda: hash_password(os.getenv("SEED_TEST_PASSWORD", "TestPassword123!"))
    )
    email_verified = True
    is_active = True
    has_local_password = True
