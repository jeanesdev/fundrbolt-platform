from __future__ import annotations

import factory

from app.models.sponsor import LogoSize, Sponsor

from .base import BaseFactory


class SponsorFactory(BaseFactory):
    class Meta:
        model = Sponsor

    name = factory.Sequence(lambda n: f"Seed Sponsor {n}")
    logo_url = factory.LazyAttribute(
        lambda o: f"https://example.test/logos/{o.name.lower().replace(' ', '-')}.png"
    )
    logo_blob_name = factory.LazyAttribute(
        lambda o: f"logos/{o.name.lower().replace(' ', '-')}.png"
    )
    thumbnail_url = factory.LazyAttribute(
        lambda o: f"https://example.test/logos/{o.name.lower().replace(' ', '-')}-thumb.png"
    )
    thumbnail_blob_name = factory.LazyAttribute(
        lambda o: f"logos/{o.name.lower().replace(' ', '-')}-thumb.png"
    )
    logo_size = LogoSize.LARGE.value
    display_order = factory.Sequence(lambda n: n)
    sponsor_level = "Gold"
