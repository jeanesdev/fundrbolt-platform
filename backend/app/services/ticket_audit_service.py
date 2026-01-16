"""Service for creating immutable audit trail entries."""

import json
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ticket_management import TicketAuditLog


class TicketAuditService:
    """Service for creating ticket management audit log entries.

    Business Rules:
    - All CREATE and UPDATE operations on ticket packages, promo codes, and custom options are logged
    - Audit logs are immutable (enforced by database trigger)
    - field_name is the column that changed
    - old_value/new_value are JSON-encoded strings for complex types
    """

    def __init__(self, db: AsyncSession):
        """Initialize TicketAuditService with database session."""
        self.db = db

    async def create_audit_entry(
        self,
        entity_type: str,
        entity_id: uuid.UUID,
        coordinator_id: uuid.UUID,
        field_name: str,
        old_value: Any,
        new_value: Any,
    ) -> TicketAuditLog:
        """Create a new audit log entry.

        Args:
            entity_type: Type of entity (e.g., "ticket_package", "promo_code")
            entity_id: UUID of the entity
            coordinator_id: UUID of the user making the change
            field_name: Name of the field that changed
            old_value: Previous value (will be JSON-encoded if not string)
            new_value: New value (will be JSON-encoded if not string)

        Returns:
            Created TicketAuditLog instance
        """
        # Convert complex types to JSON strings
        old_value_str = self._serialize_value(old_value)
        new_value_str = self._serialize_value(new_value)

        audit_log = TicketAuditLog(
            entity_type=entity_type,
            entity_id=entity_id,
            coordinator_id=coordinator_id,
            field_name=field_name,
            old_value=old_value_str,
            new_value=new_value_str,
        )

        self.db.add(audit_log)
        await self.db.flush()  # Get ID without committing transaction
        return audit_log

    async def create_audit_entries_bulk(
        self,
        entity_type: str,
        entity_id: uuid.UUID,
        coordinator_id: uuid.UUID,
        changes: dict[str, tuple[Any, Any]],
    ) -> list[TicketAuditLog]:
        """Create multiple audit log entries for a single update operation.

        Args:
            entity_type: Type of entity
            entity_id: UUID of the entity
            coordinator_id: UUID of the user making the change
            changes: Dict mapping field_name -> (old_value, new_value)

        Returns:
            List of created TicketAuditLog instances
        """
        audit_logs = []

        for field_name, (old_value, new_value) in changes.items():
            audit_log = await self.create_audit_entry(
                entity_type=entity_type,
                entity_id=entity_id,
                coordinator_id=coordinator_id,
                field_name=field_name,
                old_value=old_value,
                new_value=new_value,
            )
            audit_logs.append(audit_log)

        return audit_logs

    # Helper methods for common operations

    async def log_package_created(
        self,
        package_id: uuid.UUID,
        event_id: uuid.UUID,
        user_id: uuid.UUID,
        package_name: str,
        price: Decimal,
        quantity: int,
    ) -> TicketAuditLog:
        """Log creation of a new ticket package."""
        return await self.create_audit_entry(
            entity_type="ticket_package",
            entity_id=package_id,
            coordinator_id=user_id,
            field_name="created",
            old_value=None,
            new_value=json.dumps(
                {
                    "event_id": str(event_id),
                    "package_name": package_name,
                    "price": str(price),
                    "quantity": quantity,
                }
            ),
        )

    async def log_package_updated(
        self,
        package_id: uuid.UUID,
        event_id: uuid.UUID,
        user_id: uuid.UUID,
        changes: dict[str, tuple[Any, Any]],
    ) -> list[TicketAuditLog]:
        """Log updates to a ticket package."""
        return await self.create_audit_entries_bulk(
            entity_type="ticket_package",
            entity_id=package_id,
            coordinator_id=user_id,
            changes=changes,
        )

    async def log_package_deleted(
        self,
        package_id: uuid.UUID,
        event_id: uuid.UUID,
        user_id: uuid.UUID,
        package_name: str,
    ) -> TicketAuditLog:
        """Log soft deletion of a ticket package."""
        return await self.create_audit_entry(
            entity_type="ticket_package",
            entity_id=package_id,
            coordinator_id=user_id,
            field_name="deleted",
            old_value=package_name,
            new_value="soft_deleted",
        )

    @staticmethod
    def _serialize_value(value: Any) -> str | None:
        """Convert value to string for storage in audit log.

        Args:
            value: Value to serialize (can be str, int, float, bool, dict, list, None, datetime, Decimal)

        Returns:
            String representation (JSON for complex types)
        """
        if value is None:
            return None

        if isinstance(value, (str, int, float, bool)):
            return str(value)

        if isinstance(value, datetime):
            return value.isoformat()

        # For Decimal, dict, list, etc.
        try:
            return json.dumps(value, default=str)
        except (TypeError, ValueError):
            return str(value)
