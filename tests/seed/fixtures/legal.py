from __future__ import annotations

from datetime import UTC, datetime

from factories import LegalDocumentFactory, create_factory_model
from helpers import bind_all_factories
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.legal_document import (
    LegalDocument,
    LegalDocumentStatus,
    LegalDocumentType,
)


async def seed(session: AsyncSession, state: dict[str, object]) -> dict[str, int]:
    bind_all_factories(session)
    counts = {"created": 0, "unchanged": 0}
    refs: dict[str, str] = {}
    for doc_type in (
        LegalDocumentType.TERMS_OF_SERVICE,
        LegalDocumentType.PRIVACY_POLICY,
    ):
        result = await session.execute(
            select(LegalDocument).where(
                LegalDocument.document_type == doc_type,
                LegalDocument.version == "1.0",
            )
        )
        document = result.scalar_one_or_none()
        if document is None:
            document = await create_factory_model(
                session,
                LegalDocumentFactory,
                document_type=doc_type,
                version="1.0",
                status=LegalDocumentStatus.PUBLISHED,
                published_at=datetime.now(UTC),
            )
            counts["created"] += 1
        else:
            document.status = LegalDocumentStatus.PUBLISHED
            document.published_at = document.published_at or datetime.now(UTC)
            await session.commit()
            counts["unchanged"] += 1
        refs[doc_type.value] = str(document.id)
    state["legal_documents"] = refs
    return counts
