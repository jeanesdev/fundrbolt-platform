"""Consent service for GDPR compliance and user consent management.

This service provides methods for recording, tracking, and managing
user consent to legal documents.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.consent import (
    ConsentAction,
    ConsentAuditLog,
    ConsentStatus,
    UserConsent,
)
from app.models.legal_document import LegalDocument, LegalDocumentType
from app.models.user import User
from app.schemas.consent import (
    ConsentAcceptRequest,
    ConsentHistoryResponse,
    ConsentResponse,
    ConsentStatusResponse,
)


class ConsentService:
    """Service for user consent management operations."""

    async def accept_consent(
        self,
        db: AsyncSession,
        user: User,
        request: ConsentAcceptRequest,
        ip_address: str,
        user_agent: str | None,
    ) -> ConsentResponse:
        """Record user acceptance of legal documents.

        When user accepts new documents, any existing ACTIVE consent
        is marked as SUPERSEDED.

        Args:
            db: Database session
            user: User accepting consent
            request: Consent acceptance request
            ip_address: User's IP address
            user_agent: User's user agent

        Returns:
            Created consent record

        Raises:
            ValueError: If documents don't exist or aren't published
        """
        # Validate documents exist and are published
        tos_doc = await self._get_published_document(
            db=db,
            document_id=request.tos_document_id,
        )
        privacy_doc = await self._get_published_document(
            db=db,
            document_id=request.privacy_document_id,
        )

        if not tos_doc:
            raise ValueError(
                f"Terms of Service document {request.tos_document_id} not found or not published"
            )
        if not privacy_doc:
            raise ValueError(
                f"Privacy Policy document {request.privacy_document_id} not found or not published"
            )

        # Mark any existing ACTIVE consent as SUPERSEDED
        stmt = select(UserConsent).where(
            UserConsent.user_id == user.id,
            UserConsent.status == ConsentStatus.ACTIVE,
        )
        result = await db.execute(stmt)
        existing_consent = result.scalar_one_or_none()

        if existing_consent:
            existing_consent.status = ConsentStatus.SUPERSEDED
            existing_consent.updated_at = datetime.now(UTC)

        # Create new consent
        consent = UserConsent(
            user_id=user.id,
            tos_document_id=request.tos_document_id,
            privacy_document_id=request.privacy_document_id,
            ip_address=ip_address,
            user_agent=user_agent,
            status=ConsentStatus.ACTIVE,
        )

        db.add(consent)

        # Log to audit trail
        audit_log = ConsentAuditLog(
            user_id=user.id,
            action=ConsentAction.CONSENT_GIVEN,
            details={
                "tos_document_id": str(request.tos_document_id),
                "tos_version": tos_doc.version,
                "privacy_document_id": str(request.privacy_document_id),
                "privacy_version": privacy_doc.version,
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(audit_log)

        await db.commit()
        await db.refresh(consent)

        return ConsentResponse.model_validate(consent)

    async def withdraw_consent(
        self,
        db: AsyncSession,
        user: User,
        ip_address: str,
        user_agent: str | None,
    ) -> ConsentResponse:
        """Withdraw user's active consent.

        This marks the account for deactivation as per GDPR requirements.

        Args:
            db: Database session
            user: User withdrawing consent
            ip_address: User's IP address
            user_agent: User's user agent

        Returns:
            Updated consent record

        Raises:
            ValueError: If no active consent found
        """
        # Find active consent
        stmt = select(UserConsent).where(
            UserConsent.user_id == user.id,
            UserConsent.status == ConsentStatus.ACTIVE,
        )
        result = await db.execute(stmt)
        consent = result.scalar_one_or_none()

        if not consent:
            raise ValueError("No active consent found for user")

        # Mark consent as withdrawn
        consent.status = ConsentStatus.WITHDRAWN
        consent.withdrawn_at = datetime.now(UTC)
        consent.updated_at = datetime.now(UTC)

        # Log to audit trail
        audit_log = ConsentAuditLog(
            user_id=user.id,
            action=ConsentAction.CONSENT_WITHDRAWN,
            details={"consent_id": str(consent.id)},
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(audit_log)

        # Mark user as inactive (GDPR compliance)
        user.is_active = False
        user.updated_at = datetime.now(UTC)

        await db.commit()
        await db.refresh(consent)

        return ConsentResponse.model_validate(consent)

    async def get_consent_status(
        self,
        db: AsyncSession,
        user: User,
    ) -> ConsentStatusResponse:
        """Get user's current consent status.

        Args:
            db: Database session
            user: User to check consent for

        Returns:
            Consent status with version information
        """
        # Get user's active consent
        stmt = select(UserConsent).where(
            UserConsent.user_id == user.id,
            UserConsent.status == ConsentStatus.ACTIVE,
        )
        result = await db.execute(stmt)
        consent = result.scalar_one_or_none()

        # Get latest published versions
        latest_tos = await self._get_latest_published(
            db=db,
            document_type=LegalDocumentType.TERMS_OF_SERVICE,
        )
        latest_privacy = await self._get_latest_published(
            db=db,
            document_type=LegalDocumentType.PRIVACY_POLICY,
        )

        if not latest_tos or not latest_privacy:
            raise ValueError("Latest legal documents not found")

        # If no active consent, user needs to consent
        if not consent:
            return ConsentStatusResponse(
                has_active_consent=False,
                current_tos_version=None,
                current_privacy_version=None,
                latest_tos_version=latest_tos.version,
                latest_privacy_version=latest_privacy.version,
                consent_required=True,
            )

        # Get versions from consent
        tos_doc_stmt = select(LegalDocument).where(LegalDocument.id == consent.tos_document_id)
        privacy_doc_stmt = select(LegalDocument).where(
            LegalDocument.id == consent.privacy_document_id
        )

        tos_result = await db.execute(tos_doc_stmt)
        privacy_result = await db.execute(privacy_doc_stmt)

        tos_doc = tos_result.scalar_one()
        privacy_doc = privacy_result.scalar_one()

        # Check if user's consent is outdated
        consent_required = (
            tos_doc.version != latest_tos.version or privacy_doc.version != latest_privacy.version
        )

        return ConsentStatusResponse(
            has_active_consent=True,
            current_tos_version=tos_doc.version,
            current_privacy_version=privacy_doc.version,
            latest_tos_version=latest_tos.version,
            latest_privacy_version=latest_privacy.version,
            consent_required=consent_required,
        )

    async def get_consent_history(
        self,
        db: AsyncSession,
        user: User,
        page: int = 1,
        per_page: int = 20,
    ) -> ConsentHistoryResponse:
        """Get user's consent history with pagination.

        Args:
            db: Database session
            user: User to get history for
            page: Page number (1-indexed)
            per_page: Items per page

        Returns:
            Paginated consent history
        """
        # Build query
        stmt = (
            select(UserConsent)
            .where(UserConsent.user_id == user.id)
            .order_by(UserConsent.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
        )

        result = await db.execute(stmt)
        consents = result.scalars().all()

        # Get total count
        count_stmt = select(UserConsent).where(UserConsent.user_id == user.id)
        count_result = await db.execute(count_stmt)
        total = len(count_result.scalars().all())

        return ConsentHistoryResponse(
            consents=[ConsentResponse.model_validate(c) for c in consents],
            total=total,
            page=page,
            per_page=per_page,
        )

    async def request_data_export(
        self,
        db: AsyncSession,
        user: User,
        ip_address: str,
        user_agent: str | None,
    ) -> None:
        """Request GDPR data export (async job triggered).

        Args:
            db: Database session
            user: User requesting export
            ip_address: User's IP address
            user_agent: User's user agent
        """
        # Log to audit trail
        audit_log = ConsentAuditLog(
            user_id=user.id,
            action=ConsentAction.DATA_EXPORT_REQUESTED,
            details={"user_id": str(user.id), "email": user.email},
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(audit_log)
        await db.commit()

        # TODO: Trigger async job to generate data export
        # This would typically use Celery/RQ/etc. to generate the export
        # For now, just log the request

    async def request_data_deletion(
        self,
        db: AsyncSession,
        user: User,
        ip_address: str,
        user_agent: str | None,
    ) -> None:
        """Request GDPR data deletion (30-day grace period).

        Args:
            db: Database session
            user: User requesting deletion
            ip_address: User's IP address
            user_agent: User's user agent
        """
        # Log to audit trail
        audit_log = ConsentAuditLog(
            user_id=user.id,
            action=ConsentAction.DATA_DELETION_REQUESTED,
            details={"user_id": str(user.id), "email": user.email},
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(audit_log)

        # Mark user as inactive
        user.is_active = False
        user.updated_at = datetime.now(UTC)

        # Delete social identity links (GDPR: remove provider associations)
        from app.services.social_auth_service import SocialAuthService

        await SocialAuthService.delete_social_links_for_user(db, user.id)

        await db.commit()

        # TODO: Schedule deletion job for 30 days from now
        # This would typically use Celery beat or similar for scheduled deletion

    # Helper methods

    async def _get_published_document(
        self,
        db: AsyncSession,
        document_id: uuid.UUID,
    ) -> LegalDocument | None:
        """Get published document by ID."""
        stmt = select(LegalDocument).where(
            LegalDocument.id == document_id,
            LegalDocument.status == "published",
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def _get_latest_published(
        self,
        db: AsyncSession,
        document_type: LegalDocumentType,
    ) -> LegalDocument | None:
        """Get latest published document of a type."""
        stmt = (
            select(LegalDocument)
            .where(
                LegalDocument.document_type == document_type,
                LegalDocument.status == "published",
            )
            .order_by(LegalDocument.published_at.desc())
            .limit(1)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
