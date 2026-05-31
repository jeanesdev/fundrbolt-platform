from __future__ import annotations

import factory

from app.models.legal_document import (
    LegalDocument,
    LegalDocumentStatus,
    LegalDocumentType,
)

from .base import BaseFactory


class LegalDocumentFactory(BaseFactory):
    class Meta:
        model = LegalDocument

    document_type = LegalDocumentType.TERMS_OF_SERVICE
    version = "1.0"
    content = factory.LazyAttribute(
        lambda o: f"{o.document_type.value} seed content v{o.version}"
    )
    status = LegalDocumentStatus.PUBLISHED
    published_at = factory.Faker("future_datetime")
