"""Audit logging service for security events.

Logs authentication and authorization events for compliance and security monitoring.
Persists audit events to database and logs to structured logger.
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger

logger = get_logger(__name__)


class AuditEventType(str, Enum):
    """Types of audit events to log."""

    LOGIN_SUCCESS = "login_success"
    LOGIN_FAILED = "login_failed"
    LOGOUT = "logout"
    SESSION_REVOKED = "session_revoked"
    PASSWORD_RESET_REQUEST = "password_reset_request"
    PASSWORD_RESET_COMPLETE = "password_reset_complete"
    PASSWORD_CHANGED = "password_changed"
    EMAIL_VERIFICATION = "email_verification"
    ACCOUNT_CREATED = "account_created"
    ACCOUNT_DEACTIVATED = "account_deactivated"
    ACCOUNT_REACTIVATED = "account_reactivated"
    TOKEN_REFRESHED = "token_refreshed"
    UNAUTHORIZED_ACCESS_ATTEMPT = "unauthorized_access_attempt"
    ROLE_CHANGED = "role_changed"
    USER_CREATED = "user_created"
    USER_UPDATED = "user_updated"
    USER_DELETED = "user_deleted"
    # NPO-specific events
    NPO_CREATED = "npo_created"
    NPO_UPDATED = "npo_updated"
    NPO_STATUS_CHANGED = "npo_status_changed"
    NPO_APPLICATION_SUBMITTED = "npo_application_submitted"
    NPO_APPLICATION_APPROVED = "npo_application_approved"
    NPO_APPLICATION_REJECTED = "npo_application_rejected"
    NPO_MEMBER_INVITED = "npo_member_invited"
    NPO_MEMBER_ADDED = "npo_member_added"
    NPO_MEMBER_REMOVED = "npo_member_removed"
    NPO_MEMBER_ROLE_CHANGED = "npo_member_role_changed"
    NPO_BRANDING_UPDATED = "npo_branding_updated"
    # Auction item events
    AUCTION_ITEM_CREATED = "auction_item_created"
    AUCTION_ITEM_UPDATED = "auction_item_updated"
    AUCTION_ITEM_DELETED = "auction_item_deleted"
    AUCTION_ITEM_PUBLISHED = "auction_item_published"
    AUCTION_ITEM_WITHDRAWN = "auction_item_withdrawn"
    AUCTION_ITEM_IMPORT = "auction_item_import"
    # Ticket sales import events
    TICKET_SALES_IMPORT = "ticket_sales_import"
    # Table customization events (Feature 014)
    TABLE_CAPACITY_CHANGED = "table_capacity_changed"
    TABLE_NAME_CHANGED = "table_name_changed"
    TABLE_CAPTAIN_ASSIGNED = "table_captain_assigned"
    TABLE_CAPTAIN_REMOVED = "table_captain_removed"
    # Registration import events (Feature 022)
    REGISTRATION_IMPORT = "registration_import"


class AuditService:
    """Service for logging security and authentication audit events.

    Uses structured logging to capture security events with full context.
    In production, these logs should be sent to a SIEM or log aggregation service.
    """

    @staticmethod
    async def log_login_success(
        db: AsyncSession | None,
        user_id: uuid.UUID,
        email: str,
        ip_address: str | None = None,
        user_agent: str | None = None,
        session_id: uuid.UUID | None = None,
    ) -> None:
        """Log successful login event to database and logger.

        Args:
            db: Database session for persisting audit log (optional for backward compatibility)
            user_id: UUID of authenticated user
            email: User's email address
            ip_address: Optional client IP address
            user_agent: Optional client user agent
            session_id: Optional session UUID
        """
        from app.models.audit_log import AuditLog

        # Create database record if db session provided
        if db is not None:
            audit_log = AuditLog(
                user_id=user_id,
                action="login_success",
                ip_address=ip_address or "unknown",
                user_agent=user_agent,
                event_metadata={
                    "email": email,
                    "session_id": str(session_id) if session_id else None,
                },
            )
            db.add(audit_log)
            await db.commit()

        # Also log to structured logger for redundancy
        logger.info(
            "User login successful",
            extra={
                "event_type": AuditEventType.LOGIN_SUCCESS.value,
                "user_id": str(user_id),
                "email": email,
                "ip_address": ip_address,
                "user_agent": user_agent,
                "session_id": str(session_id) if session_id else None,
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

    @staticmethod
    async def log_login_failed(
        db: AsyncSession,
        email: str,
        reason: str,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> None:
        """Log failed login attempt to database and logger.

        Args:
            db: Database session for persisting audit log
            email: Email address used in attempt
            reason: Reason for failure (e.g., "invalid_credentials", "email_not_verified")
            ip_address: Optional client IP address
            user_agent: Optional client user agent
        """
        from app.models.audit_log import AuditLog

        # Create database record (user_id is NULL for failed attempts)
        audit_log = AuditLog(
            user_id=None,  # NULL for failed login attempts
            action="login_failed",
            ip_address=ip_address or "unknown",
            user_agent=user_agent,
            event_metadata={
                "email": email,
                "reason": reason,
            },
        )
        db.add(audit_log)
        await db.commit()

        # Also log to structured logger
        logger.warning(
            "User login failed",
            extra={
                "event_type": AuditEventType.LOGIN_FAILED.value,
                "email": email,
                "reason": reason,
                "ip_address": ip_address,
                "user_agent": user_agent,
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

    @staticmethod
    @staticmethod
    async def log_logout(
        db: AsyncSession,
        user_id: uuid.UUID,
        email: str,
        ip_address: str | None = None,
        session_id: uuid.UUID | None = None,
    ) -> None:
        """Log user logout event to database and logger.

        Args:
            db: Database session for persisting audit log
            user_id: UUID of user logging out
            email: User's email address
            ip_address: Optional client IP address
            session_id: Optional session UUID being terminated
        """
        from app.models.audit_log import AuditLog

        # Create database record
        audit_log = AuditLog(
            user_id=user_id,
            action="logout",
            ip_address=ip_address or "unknown",
            user_agent=None,
            event_metadata={
                "email": email,
                "session_id": str(session_id) if session_id else None,
            },
        )
        db.add(audit_log)
        await db.commit()

        # Also log to structured logger
        logger.info(
            "User logout",
            extra={
                "event_type": AuditEventType.LOGOUT.value,
                "user_id": str(user_id),
                "email": email,
                "ip_address": ip_address,
                "session_id": str(session_id) if session_id else None,
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

    @staticmethod
    def log_session_revoked(
        user_id: uuid.UUID,
        email: str,
        session_jti: str,
        reason: str | None = None,
        ip_address: str | None = None,
        revoked_by_user_id: uuid.UUID | None = None,
    ) -> None:
        """Log session revocation event.

        Args:
            user_id: UUID of user whose session was revoked
            email: User's email address
            session_jti: JWT ID of the revoked session
            reason: Optional reason for revocation
                (e.g., "password_reset", "security_breach", "manual_logout")
            ip_address: Optional IP address where revocation occurred
            revoked_by_user_id: Optional UUID of admin who revoked session
                (if different from user)
        """
        logger.warning(
            "Session revoked",
            extra={
                "event_type": AuditEventType.SESSION_REVOKED.value,
                "user_id": str(user_id),
                "email": email,
                "session_jti": session_jti,
                "reason": reason,
                "ip_address": ip_address,
                "revoked_by_user_id": str(revoked_by_user_id) if revoked_by_user_id else None,
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

    @staticmethod
    def log_account_created(
        user_id: uuid.UUID,
        email: str,
        ip_address: str | None = None,
    ) -> None:
        """Log new account creation.

        Args:
            user_id: UUID of newly created user
            email: User's email address
            ip_address: Optional client IP address
        """
        logger.info(
            "User account created",
            extra={
                "event_type": AuditEventType.ACCOUNT_CREATED.value,
                "user_id": str(user_id),
                "email": email,
                "ip_address": ip_address,
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

    @staticmethod
    def log_password_reset_request(
        email: str,
        ip_address: str | None = None,
    ) -> None:
        """Log password reset request.

        Args:
            email: Email address requesting reset
            ip_address: Optional client IP address
        """
        logger.info(
            "Password reset requested",
            extra={
                "event_type": AuditEventType.PASSWORD_RESET_REQUEST.value,
                "email": email,
                "ip_address": ip_address,
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

    @staticmethod
    def log_password_reset_complete(
        user_id: uuid.UUID,
        email: str,
        ip_address: str | None = None,
    ) -> None:
        """Log successful password reset completion.

        Args:
            user_id: UUID of user whose password was reset
            email: User's email address
            ip_address: Optional client IP address
        """
        logger.info(
            "Password reset completed",
            extra={
                "event_type": AuditEventType.PASSWORD_RESET_COMPLETE.value,
                "user_id": str(user_id),
                "email": email,
                "ip_address": ip_address,
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

    @staticmethod
    async def log_password_changed(
        db: AsyncSession,
        user_id: uuid.UUID,
        email: str,
        ip_address: str | None = None,
    ) -> None:
        """Log password change by authenticated user to database and logger.

        Args:
            db: Database session for persisting audit log
            user_id: UUID of user who changed their password
            email: User's email address
            ip_address: Optional client IP address
        """
        from app.models.audit_log import AuditLog

        # Create database record
        audit_log = AuditLog(
            user_id=user_id,
            action="password_changed",
            ip_address=ip_address or "unknown",
            user_agent=None,
            event_metadata={"email": email},
        )
        db.add(audit_log)
        await db.commit()

        # Also log to structured logger
        logger.info(
            "Password changed",
            extra={
                "event_type": AuditEventType.PASSWORD_CHANGED.value,
                "user_id": str(user_id),
                "email": email,
                "ip_address": ip_address,
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

    @staticmethod
    async def log_email_verification(
        db: AsyncSession,
        user_id: uuid.UUID,
        email: str,
        ip_address: str | None = None,
    ) -> None:
        """Log email verification completion to database and logger.

        Args:
            db: Database session for persisting audit log
            user_id: UUID of user whose email was verified
            email: Email address that was verified
            ip_address: Optional client IP address
        """
        from app.models.audit_log import AuditLog

        # Create database record
        audit_log = AuditLog(
            user_id=user_id,
            action="email_verified",
            ip_address=ip_address or "unknown",
            user_agent=None,
            event_metadata={"email": email},
        )
        db.add(audit_log)
        await db.commit()

        # Also log to structured logger
        logger.info(
            "Email verified",
            extra={
                "event_type": AuditEventType.EMAIL_VERIFICATION.value,
                "user_id": str(user_id),
                "email": email,
                "ip_address": ip_address,
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

    @staticmethod
    def log_token_refreshed(
        user_id: uuid.UUID,
        email: str,
        ip_address: str | None = None,
    ) -> None:
        """Log access token refresh.

        Args:
            user_id: UUID of user refreshing token
            email: User's email address
            ip_address: Optional client IP address
        """
        logger.info(
            "Access token refreshed",
            extra={
                "event_type": AuditEventType.TOKEN_REFRESHED.value,
                "user_id": str(user_id),
                "email": email,
                "ip_address": ip_address,
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

    @staticmethod
    def log_unauthorized_access_attempt(
        resource: str,
        reason: str,
        ip_address: str | None = None,
        user_id: uuid.UUID | None = None,
    ) -> None:
        """Log unauthorized access attempt.

        Args:
            resource: Resource being accessed
            reason: Reason for denial (e.g., "invalid_token", "insufficient_permissions")
            ip_address: Optional client IP address
            user_id: Optional UUID if user was partially authenticated
        """
        logger.warning(
            "Unauthorized access attempt",
            extra={
                "event_type": AuditEventType.UNAUTHORIZED_ACCESS_ATTEMPT.value,
                "resource": resource,
                "reason": reason,
                "ip_address": ip_address,
                "user_id": str(user_id) if user_id else None,
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

    @staticmethod
    async def log_account_deactivated(
        db: AsyncSession | None,
        user_id: uuid.UUID,
        email: str,
        reason: str | None = None,
        admin_user_id: uuid.UUID | None = None,
        ip_address: str | None = None,
    ) -> None:
        """Log account deactivation to database and logger.

        Args:
            db: Database session for persisting audit log (optional for backward compatibility)
            user_id: UUID of deactivated user
            email: User's email address
            reason: Optional reason for deactivation
            admin_user_id: Optional UUID of admin who deactivated account
            ip_address: Optional IP address
        """
        from app.models.audit_log import AuditLog

        # Create database record if db session provided
        if db is not None:
            audit_log = AuditLog(
                user_id=user_id,
                action="account_deactivated",
                ip_address=ip_address or "unknown",
                user_agent=None,
                event_metadata={
                    "email": email,
                    "reason": reason,
                    "admin_user_id": str(admin_user_id) if admin_user_id else None,
                },
            )
            db.add(audit_log)
            await db.commit()

        # Also log to structured logger
        logger.warning(
            "User account deactivated",
            extra={
                "event_type": AuditEventType.ACCOUNT_DEACTIVATED.value,
                "user_id": str(user_id),
                "email": email,
                "reason": reason,
                "admin_user_id": str(admin_user_id) if admin_user_id else None,
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

    @staticmethod
    async def log_role_changed(
        db: AsyncSession | None,
        user_id: uuid.UUID,
        email: str,
        old_role: str,
        new_role: str,
        admin_user_id: uuid.UUID,
        admin_email: str,
        ip_address: str | None = None,
    ) -> None:
        """Log role change event to database and logger.

        Args:
            db: Database session for persisting audit log (optional for backward compatibility)
            user_id: UUID of user whose role changed
            email: User's email address
            old_role: Previous role name
            new_role: New role name
            admin_user_id: UUID of admin who changed the role
            admin_email: Email of admin who changed the role
            ip_address: Optional IP address of admin
        """
        from app.models.audit_log import AuditLog

        # Create database record if db session provided
        if db is not None:
            audit_log = AuditLog(
                user_id=user_id,
                action="role_changed",
                ip_address=ip_address or "unknown",
                user_agent=None,
                event_metadata={
                    "email": email,
                    "old_role": old_role,
                    "new_role": new_role,
                    "admin_user_id": str(admin_user_id),
                    "admin_email": admin_email,
                },
            )
            db.add(audit_log)
            await db.commit()

        # Also log to structured logger
        logger.info(
            "User role changed",
            extra={
                "event_type": AuditEventType.ROLE_CHANGED.value,
                "user_id": str(user_id),
                "email": email,
                "old_role": old_role,
                "new_role": new_role,
                "admin_user_id": str(admin_user_id),
                "admin_email": admin_email,
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

    @staticmethod
    async def log_user_created(
        db: AsyncSession | None,
        user_id: uuid.UUID,
        email: str,
        role: str,
        admin_user_id: uuid.UUID,
        admin_email: str,
        ip_address: str | None = None,
    ) -> None:
        """Log user creation event to database and logger.

        Args:
            db: Database session for persisting audit log (optional for backward compatibility)
            user_id: UUID of created user
            email: New user's email address
            role: Assigned role name
            admin_user_id: UUID of admin who created the user
            admin_email: Email of admin who created the user
            ip_address: Optional IP address of admin
        """
        from app.models.audit_log import AuditLog

        # Create database record if db session provided
        if db is not None:
            audit_log = AuditLog(
                user_id=user_id,
                action="user_created",
                ip_address=ip_address or "unknown",
                user_agent=None,
                event_metadata={
                    "email": email,
                    "role": role,
                    "admin_user_id": str(admin_user_id),
                    "admin_email": admin_email,
                },
            )
            db.add(audit_log)
            await db.commit()

        # Also log to structured logger
        logger.info(
            "User created by admin",
            extra={
                "event_type": AuditEventType.USER_CREATED.value,
                "user_id": str(user_id),
                "email": email,
                "role": role,
                "admin_user_id": str(admin_user_id),
                "admin_email": admin_email,
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

    @staticmethod
    async def log_user_updated(
        db: AsyncSession | None,
        user_id: uuid.UUID,
        email: str,
        fields_updated: list[str],
        admin_user_id: uuid.UUID,
        admin_email: str,
        ip_address: str | None = None,
    ) -> None:
        """Log user profile update event to database and logger.

        Args:
            db: Database session for persisting audit log (optional for backward compatibility)
            user_id: UUID of updated user
            email: User's email address
            fields_updated: List of field names that were updated
            admin_user_id: UUID of admin who updated the user
            admin_email: Email of admin who updated the user
            ip_address: Optional IP address of admin
        """
        from app.models.audit_log import AuditLog

        # Create database record if db session provided
        if db is not None:
            audit_log = AuditLog(
                user_id=user_id,
                action="user_updated",
                ip_address=ip_address or "unknown",
                user_agent=None,
                event_metadata={
                    "email": email,
                    "fields_updated": fields_updated,
                    "admin_user_id": str(admin_user_id),
                    "admin_email": admin_email,
                },
            )
            db.add(audit_log)
            await db.commit()

        # Also log to structured logger
        logger.info(
            "User profile updated",
            extra={
                "event_type": AuditEventType.USER_UPDATED.value,
                "user_id": str(user_id),
                "email": email,
                "fields_updated": fields_updated,
                "admin_user_id": str(admin_user_id),
                "admin_email": admin_email,
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

    @staticmethod
    async def log_user_deleted(
        db: AsyncSession | None,
        user_id: uuid.UUID,
        email: str,
        admin_user_id: uuid.UUID,
        admin_email: str,
        ip_address: str | None = None,
    ) -> None:
        """Log user deletion/deactivation event to database and logger.

        Args:
            db: Database session for persisting audit log (optional for backward compatibility)
            user_id: UUID of deleted user
            email: User's email address
            admin_user_id: UUID of admin who deleted the user
            admin_email: Email of admin who deleted the user
            ip_address: Optional IP address of admin
        """
        from app.models.audit_log import AuditLog

        # Create database record if db session provided
        if db is not None:
            audit_log = AuditLog(
                user_id=user_id,
                action="user_deleted",
                ip_address=ip_address or "unknown",
                user_agent=None,
                event_metadata={
                    "email": email,
                    "admin_user_id": str(admin_user_id),
                    "admin_email": admin_email,
                },
            )
            db.add(audit_log)
            await db.commit()

        # Also log to structured logger
        logger.warning(
            "User deleted/deactivated",
            extra={
                "event_type": AuditEventType.USER_DELETED.value,
                "user_id": str(user_id),
                "email": email,
                "admin_user_id": str(admin_user_id),
                "admin_email": admin_email,
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

    @staticmethod
    async def log_account_reactivated(
        db: AsyncSession | None,
        user_id: uuid.UUID,
        email: str,
        admin_user_id: uuid.UUID | None = None,
        ip_address: str | None = None,
    ) -> None:
        """Log account reactivation to database and logger.

        Args:
            db: Database session for persisting audit log (optional for backward compatibility)
            user_id: UUID of reactivated user
            email: User's email address
            admin_user_id: Optional UUID of admin who reactivated account
            ip_address: Optional IP address
        """
        from app.models.audit_log import AuditLog

        # Create database record if db session provided
        if db is not None:
            audit_log = AuditLog(
                user_id=user_id,
                action="account_reactivated",
                ip_address=ip_address or "unknown",
                user_agent=None,
                event_metadata={
                    "email": email,
                    "admin_user_id": str(admin_user_id) if admin_user_id else None,
                },
            )
            db.add(audit_log)
            await db.commit()

        # Also log to structured logger
        logger.info(
            "User account reactivated",
            extra={
                "event_type": AuditEventType.ACCOUNT_REACTIVATED.value,
                "user_id": str(user_id),
                "email": email,
                "admin_user_id": str(admin_user_id) if admin_user_id else None,
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

    # ============================================
    # NPO-specific audit log methods
    # ============================================

    @staticmethod
    async def log_npo_created(
        db: AsyncSession,
        npo_id: uuid.UUID,
        npo_name: str,
        created_by_user_id: uuid.UUID,
        created_by_email: str,
        ip_address: str | None = None,
    ) -> None:
        """Log NPO creation event."""
        from app.models.audit_log import AuditLog

        audit_log = AuditLog(
            user_id=created_by_user_id,
            action="npo_created",
            ip_address=ip_address or "unknown",
            user_agent=None,
            event_metadata={
                "npo_id": str(npo_id),
                "npo_name": npo_name,
                "created_by_email": created_by_email,
            },
        )
        db.add(audit_log)
        await db.commit()

        logger.info(
            "NPO created",
            extra={
                "event_type": AuditEventType.NPO_CREATED.value,
                "npo_id": str(npo_id),
                "npo_name": npo_name,
                "created_by_user_id": str(created_by_user_id),
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

    @staticmethod
    async def log_npo_application_reviewed(
        db: AsyncSession,
        npo_id: uuid.UUID,
        npo_name: str,
        status: str,
        reviewed_by_user_id: uuid.UUID,
        reviewed_by_email: str,
        ip_address: str | None = None,
    ) -> None:
        """Log NPO application review event."""
        from app.models.audit_log import AuditLog

        event_type = (
            AuditEventType.NPO_APPLICATION_APPROVED
            if status == "approved"
            else AuditEventType.NPO_APPLICATION_REJECTED
        )

        audit_log = AuditLog(
            user_id=reviewed_by_user_id,
            action=event_type.value,
            ip_address=ip_address or "unknown",
            user_agent=None,
            event_metadata={
                "npo_id": str(npo_id),
                "npo_name": npo_name,
                "status": status,
                "reviewed_by_email": reviewed_by_email,
            },
        )
        db.add(audit_log)
        await db.commit()

        logger.info(
            f"NPO application {status}",
            extra={
                "event_type": event_type.value,
                "npo_id": str(npo_id),
                "npo_name": npo_name,
                "reviewed_by_user_id": str(reviewed_by_user_id),
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

    @staticmethod
    async def log_npo_member_added(
        db: AsyncSession,
        npo_id: uuid.UUID,
        npo_name: str,
        member_user_id: uuid.UUID,
        member_email: str,
        role: str,
        added_by_user_id: uuid.UUID,
        ip_address: str | None = None,
    ) -> None:
        """Log NPO member addition event."""
        from app.models.audit_log import AuditLog

        audit_log = AuditLog(
            user_id=added_by_user_id,
            action="npo_member_added",
            ip_address=ip_address or "unknown",
            user_agent=None,
            event_metadata={
                "npo_id": str(npo_id),
                "npo_name": npo_name,
                "member_user_id": str(member_user_id),
                "member_email": member_email,
                "role": role,
            },
        )
        db.add(audit_log)
        await db.commit()

        logger.info(
            "NPO member added",
            extra={
                "event_type": AuditEventType.NPO_MEMBER_ADDED.value,
                "npo_id": str(npo_id),
                "npo_name": npo_name,
                "member_user_id": str(member_user_id),
                "added_by_user_id": str(added_by_user_id),
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

    @staticmethod
    async def log_npo_member_removed(
        db: AsyncSession,
        npo_id: uuid.UUID,
        npo_name: str,
        member_user_id: uuid.UUID,
        member_email: str,
        removed_by_user_id: uuid.UUID,
        reason: str | None = None,
        ip_address: str | None = None,
    ) -> None:
        """Log NPO member removal event."""
        from app.models.audit_log import AuditLog

        audit_log = AuditLog(
            user_id=removed_by_user_id,
            action="npo_member_removed",
            ip_address=ip_address or "unknown",
            user_agent=None,
            event_metadata={
                "npo_id": str(npo_id),
                "npo_name": npo_name,
                "member_user_id": str(member_user_id),
                "member_email": member_email,
                "reason": reason,
            },
        )
        db.add(audit_log)
        await db.commit()

        logger.warning(
            "NPO member removed",
            extra={
                "event_type": AuditEventType.NPO_MEMBER_REMOVED.value,
                "npo_id": str(npo_id),
                "member_user_id": str(member_user_id),
                "removed_by_user_id": str(removed_by_user_id),
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

    @staticmethod
    async def log_npo_updated(
        db: AsyncSession,
        npo_id: uuid.UUID,
        npo_name: str,
        updated_by_user_id: uuid.UUID,
        updated_by_email: str,
        changes: dict[str, Any],
        ip_address: str | None = None,
    ) -> None:
        """Log NPO update event."""
        from app.models.audit_log import AuditLog

        audit_log = AuditLog(
            user_id=updated_by_user_id,
            action="npo_updated",
            ip_address=ip_address or "unknown",
            user_agent=None,
            event_metadata={
                "npo_id": str(npo_id),
                "npo_name": npo_name,
                "updated_by_email": updated_by_email,
                "changes": changes,
            },
        )
        db.add(audit_log)
        await db.commit()

        logger.info(
            "NPO updated",
            extra={
                "event_type": AuditEventType.NPO_UPDATED.value,
                "npo_id": str(npo_id),
                "npo_name": npo_name,
                "updated_by_user_id": str(updated_by_user_id),
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

    @staticmethod
    async def log_npo_status_changed(
        db: AsyncSession,
        npo_id: uuid.UUID,
        npo_name: str,
        old_status: str | None,
        new_status: str,
        changed_by_user_id: uuid.UUID,
        changed_by_email: str,
        notes: str | None = None,
        ip_address: str | None = None,
    ) -> None:
        """Log NPO status change event."""
        from app.models.audit_log import AuditLog

        audit_log = AuditLog(
            user_id=changed_by_user_id,
            action="npo_status_changed",
            ip_address=ip_address or "unknown",
            user_agent=None,
            event_metadata={
                "npo_id": str(npo_id),
                "npo_name": npo_name,
                "old_status": old_status,
                "new_status": new_status,
                "notes": notes,
                "changed_by_email": changed_by_email,
            },
        )
        db.add(audit_log)
        await db.commit()

        logger.info(
            "NPO status changed",
            extra={
                "event_type": AuditEventType.NPO_STATUS_CHANGED.value,
                "npo_id": str(npo_id),
                "npo_name": npo_name,
                "old_status": old_status,
                "new_status": new_status,
                "changed_by_user_id": str(changed_by_user_id),
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

    @staticmethod
    async def log_auction_item_created(
        db: AsyncSession,
        item_id: uuid.UUID,
        event_id: uuid.UUID,
        bid_number: int,
        title: str,
        created_by_user_id: uuid.UUID,
        ip_address: str | None = None,
    ) -> None:
        """Log auction item creation event."""
        from app.models.audit_log import AuditLog

        audit_log = AuditLog(
            user_id=created_by_user_id,
            action="auction_item_created",
            ip_address=ip_address or "unknown",
            user_agent=None,
            event_metadata={
                "item_id": str(item_id),
                "event_id": str(event_id),
                "bid_number": bid_number,
                "title": title,
            },
        )
        db.add(audit_log)
        await db.commit()

        logger.info(
            "Auction item created",
            extra={
                "event_type": AuditEventType.AUCTION_ITEM_CREATED.value,
                "item_id": str(item_id),
                "event_id": str(event_id),
                "bid_number": bid_number,
                "title": title,
                "created_by_user_id": str(created_by_user_id),
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

    @staticmethod
    async def log_auction_item_updated(
        db: AsyncSession,
        item_id: uuid.UUID,
        event_id: uuid.UUID,
        bid_number: int,
        title: str,
        updated_fields: dict[str, Any],
        updated_by_user_id: uuid.UUID,
        ip_address: str | None = None,
    ) -> None:
        """Log auction item update event."""
        from app.models.audit_log import AuditLog

        audit_log = AuditLog(
            user_id=updated_by_user_id,
            action="auction_item_updated",
            ip_address=ip_address or "unknown",
            user_agent=None,
            event_metadata={
                "item_id": str(item_id),
                "event_id": str(event_id),
                "bid_number": bid_number,
                "title": title,
                "updated_fields": updated_fields,
            },
        )
        db.add(audit_log)
        await db.commit()

        logger.info(
            "Auction item updated",
            extra={
                "event_type": AuditEventType.AUCTION_ITEM_UPDATED.value,
                "item_id": str(item_id),
                "event_id": str(event_id),
                "bid_number": bid_number,
                "title": title,
                "updated_fields": list(updated_fields.keys()),
                "updated_by_user_id": str(updated_by_user_id),
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

    @staticmethod
    async def log_auction_item_deleted(
        db: AsyncSession,
        item_id: uuid.UUID,
        event_id: uuid.UUID,
        bid_number: int,
        title: str,
        deleted_by_user_id: uuid.UUID,
        is_soft_delete: bool,
        ip_address: str | None = None,
    ) -> None:
        """Log auction item deletion event."""
        from app.models.audit_log import AuditLog

        audit_log = AuditLog(
            user_id=deleted_by_user_id,
            action="auction_item_deleted",
            ip_address=ip_address or "unknown",
            user_agent=None,
            event_metadata={
                "item_id": str(item_id),
                "event_id": str(event_id),
                "bid_number": bid_number,
                "title": title,
                "is_soft_delete": is_soft_delete,
            },
        )
        db.add(audit_log)
        await db.commit()

        logger.info(
            "Auction item deleted",
            extra={
                "event_type": AuditEventType.AUCTION_ITEM_DELETED.value,
                "item_id": str(item_id),
                "event_id": str(event_id),
                "bid_number": bid_number,
                "title": title,
                "is_soft_delete": is_soft_delete,
                "deleted_by_user_id": str(deleted_by_user_id),
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

    @staticmethod
    async def log_auction_item_import(
        db: AsyncSession,
        event_id: uuid.UUID,
        initiated_by_user_id: uuid.UUID,
        stage: str,
        total_rows: int,
        created_count: int,
        updated_count: int,
        error_count: int,
        ip_address: str | None = None,
    ) -> None:
        """Log auction item import attempts (preflight/commit)."""
        from app.models.audit_log import AuditLog

        audit_log = AuditLog(
            user_id=initiated_by_user_id,
            action="auction_item_import",
            ip_address=ip_address or "unknown",
            user_agent=None,
            event_metadata={
                "event_id": str(event_id),
                "stage": stage,
                "total_rows": total_rows,
                "created_count": created_count,
                "updated_count": updated_count,
                "error_count": error_count,
            },
        )
        db.add(audit_log)
        await db.commit()

        logger.info(
            "Auction item import",
            extra={
                "event_type": AuditEventType.AUCTION_ITEM_IMPORT.value,
                "event_id": str(event_id),
                "stage": stage,
                "total_rows": total_rows,
                "created_count": created_count,
                "updated_count": updated_count,
                "error_count": error_count,
                "initiated_by_user_id": str(initiated_by_user_id),
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

    @staticmethod
    async def log_ticket_sales_import(
        db: AsyncSession,
        event_id: uuid.UUID,
        initiated_by_user_id: uuid.UUID,
        stage: str,
        total_rows: int,
        error_count: int,
        ip_address: str | None = None,
    ) -> None:
        """Log ticket sales import attempts (preflight/commit)."""
        from app.models.audit_log import AuditLog

        audit_log = AuditLog(
            user_id=initiated_by_user_id,
            action="ticket_sales_import",
            ip_address=ip_address or "unknown",
            user_agent=None,
            event_metadata={
                "event_id": str(event_id),
                "stage": stage,
                "total_rows": total_rows,
                "error_count": error_count,
            },
        )
        db.add(audit_log)
        await db.commit()

        logger.info(
            "Ticket sales import",
            extra={
                "event_type": AuditEventType.TICKET_SALES_IMPORT.value,
                "event_id": str(event_id),
                "stage": stage,
                "total_rows": total_rows,
                "error_count": error_count,
                "initiated_by_user_id": str(initiated_by_user_id),
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

    @staticmethod
    async def log_table_customization_change(
        db: AsyncSession,
        event_id: uuid.UUID,
        table_number: int,
        admin_user_id: uuid.UUID,
        admin_email: str,
        change_type: str,  # "capacity", "name", "captain"
        old_value: Any | None,
        new_value: Any | None,
        ip_address: str | None = None,
    ) -> None:
        """Log table customization changes (capacity, name, captain) - Feature 014 T078.

        Args:
            db: Database session for persisting audit log
            event_id: UUID of the event
            table_number: Table number being customized
            admin_user_id: UUID of admin making the change
            admin_email: Email of admin making the change
            change_type: Type of change ("capacity", "name", "captain")
            old_value: Previous value (None if first time setting)
            new_value: New value (None if clearing)
            ip_address: Optional IP address of admin
        """
        from app.models.audit_log import AuditLog

        # Map change_type to audit event type
        action_map = {
            "capacity": "table_capacity_changed",
            "name": "table_name_changed",
            "captain_assigned": "table_captain_assigned",
            "captain_removed": "table_captain_removed",
        }
        action = action_map.get(change_type, "table_capacity_changed")

        # Create database record
        audit_log = AuditLog(
            user_id=admin_user_id,
            action=action,
            resource_type="event_table",
            resource_id=event_id,
            ip_address=ip_address or "unknown",
            user_agent=None,
            event_metadata={
                "event_id": str(event_id),
                "table_number": table_number,
                "admin_email": admin_email,
                "change_type": change_type,
                "old_value": str(old_value) if old_value is not None else None,
                "new_value": str(new_value) if new_value is not None else None,
            },
        )
        db.add(audit_log)
        await db.commit()

        # Also log to structured logger
        logger.info(
            f"Table customization changed: {change_type}",
            extra={
                "event_type": action,
                "event_id": str(event_id),
                "table_number": table_number,
                "admin_user_id": str(admin_user_id),
                "admin_email": admin_email,
                "change_type": change_type,
                "old_value": old_value,
                "new_value": new_value,
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

    @staticmethod
    async def log_registration_import(
        db: AsyncSession,
        event_id: uuid.UUID,
        initiated_by_user_id: uuid.UUID,
        stage: str,
        total_rows: int,
        created_count: int,
        error_count: int,
        ip_address: str | None = None,
    ) -> None:
        """Log registration import attempts (preflight/commit) - Feature 022."""
        from app.models.audit_log import AuditLog

        audit_log = AuditLog(
            user_id=initiated_by_user_id,
            action="registration_import",
            ip_address=ip_address or "unknown",
            user_agent=None,
            event_metadata={
                "event_id": str(event_id),
                "stage": stage,
                "total_rows": total_rows,
                "created_count": created_count,
                "error_count": error_count,
            },
        )
        db.add(audit_log)
        await db.commit()

        logger.info(
            "Registration import",
            extra={
                "event_type": AuditEventType.REGISTRATION_IMPORT.value,
                "event_id": str(event_id),
                "stage": stage,
                "total_rows": total_rows,
                "created_count": created_count,
                "error_count": error_count,
                "initiated_by_user_id": str(initiated_by_user_id),
                "timestamp": datetime.utcnow().isoformat(),
            },
        )
