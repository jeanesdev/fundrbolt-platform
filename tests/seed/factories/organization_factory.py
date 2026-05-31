from __future__ import annotations

import factory

from app.models.npo import NPO, NPOStatus

from .base import BaseFactory


class NPOFactory(BaseFactory):
    class Meta:
        model = NPO

    name = factory.Sequence(lambda n: f"Seed Nonprofit {n}")
    slug = factory.Sequence(lambda n: f"seed-npo-{n}")
    description = "Seed nonprofit for beta automation."
    mission_statement = "Raise more money with reliable automation."
    email = factory.LazyAttribute(lambda o: f"{o.slug}@fundrbolt.com")
    phone = "+1-555-0900"
    status = NPOStatus.APPROVED
