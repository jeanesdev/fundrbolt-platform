"""
Auto-assignment service for table seating.

Implements party-aware sequential table filling algorithm.
"""

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.event import Event
from app.models.event_registration import EventRegistration
from app.models.registration_guest import RegistrationGuest


class AutoAssignService:
    """Service for automatic table assignment with party awareness."""

    @staticmethod
    async def auto_assign_guests(
        db: AsyncSession,
        event_id: UUID,
    ) -> dict[str, Any]:
        """
        Auto-assign unassigned guests to tables using party-aware algorithm.

        Algorithm:
        1. Group guests by registration (party)
        2. Sort parties by size (largest first)
        3. Fill tables sequentially, keeping parties together
        4. If party is too large for remaining capacity, split to new table

        Args:
            db: Database session
            event_id: Event UUID

        Returns:
            dict with:
                - assigned_count: Number of guests assigned
                - assignments: List of assignment records
                - unassigned_count: Number remaining unassigned
                - warnings: List of warning messages

        Raises:
            ValueError: If seating not configured or validation fails
        """
        # Get event configuration
        event_query = select(Event).where(Event.id == event_id)
        event_result = await db.execute(event_query)
        event = event_result.scalar_one_or_none()

        if not event:
            raise ValueError(f"Event {event_id} not found")

        if event.table_count is None or event.max_guests_per_table is None:
            raise ValueError(f"Seating is not configured for event {event_id}")

        # Get unassigned guests grouped by registration
        unassigned_query = (
            select(RegistrationGuest)
            .join(EventRegistration)
            .where(
                EventRegistration.event_id == event_id,
                RegistrationGuest.status == "confirmed",
                RegistrationGuest.table_number.is_(None),
            )
            .options(selectinload(RegistrationGuest.registration))
            .order_by(RegistrationGuest.registration_id, RegistrationGuest.created_at)
        )
        guests_result = await db.execute(unassigned_query)
        unassigned_guests = list(guests_result.scalars().all())

        if not unassigned_guests:
            return {
                "assigned_count": 0,
                "assignments": [],
                "unassigned_count": 0,
                "warnings": [],
            }

        # Group guests by registration (party)
        parties: dict[UUID, list[RegistrationGuest]] = {}
        for guest in unassigned_guests:
            reg_id = guest.registration_id
            if reg_id not in parties:
                parties[reg_id] = []
            parties[reg_id].append(guest)

        # Sort parties by size (largest first) for better packing
        sorted_parties = sorted(parties.values(), key=len, reverse=True)

        # Get current table occupancy
        table_occupancy = await AutoAssignService._get_table_occupancy_map(
            db, event_id, event.table_count
        )

        # Assign guests to tables
        assignments = []
        warnings = []
        current_table = 1

        for party in sorted_parties:
            party_size = len(party)

            # Find table with enough capacity for the party
            assigned = False
            for table_num in range(current_table, event.table_count + 1):
                available = event.max_guests_per_table - table_occupancy.get(table_num, 0)

                if party_size <= available:
                    # Assign entire party to this table
                    for guest in party:
                        guest.table_number = table_num
                        assignments.append(
                            {
                                "guest_id": guest.id,
                                "guest_name": guest.name,
                                "table_number": table_num,
                                "bidder_number": guest.bidder_number,
                                "registration_id": guest.registration_id,
                            }
                        )
                    table_occupancy[table_num] = table_occupancy.get(table_num, 0) + party_size
                    current_table = table_num  # Continue filling from this table
                    assigned = True
                    break

            if not assigned:
                # Party too large for any single table, need to split
                # This is a warning condition but we'll handle it
                remaining_party = list(party)
                split_count = 0

                for table_num in range(1, event.table_count + 1):
                    if not remaining_party:
                        break

                    available = event.max_guests_per_table - table_occupancy.get(table_num, 0)
                    if available > 0:
                        # Assign as many as possible to this table
                        guests_to_assign = remaining_party[:available]
                        for guest in guests_to_assign:
                            guest.table_number = table_num
                            assignments.append(
                                {
                                    "guest_id": guest.id,
                                    "guest_name": guest.name,
                                    "table_number": table_num,
                                    "bidder_number": guest.bidder_number,
                                    "registration_id": guest.registration_id,
                                }
                            )
                            split_count += 1
                        table_occupancy[table_num] = table_occupancy.get(table_num, 0) + len(
                            guests_to_assign
                        )
                        remaining_party = remaining_party[available:]

                if split_count > 0:
                    warnings.append(
                        f"Party of {party_size} (registration {party[0].registration_id}) "
                        f"was split across multiple tables due to capacity constraints"
                    )

                if remaining_party:
                    warnings.append(
                        f"Could not assign {len(remaining_party)} guests from party "
                        f"(registration {party[0].registration_id}) - no available capacity"
                    )

        # Commit all assignments
        await db.commit()

        # Get final unassigned count
        final_unassigned = await AutoAssignService._count_unassigned_guests(db, event_id)

        return {
            "assigned_count": len(assignments),
            "assignments": assignments,
            "unassigned_count": final_unassigned,
            "warnings": warnings,
        }

    @staticmethod
    async def _get_table_occupancy_map(
        db: AsyncSession,
        event_id: UUID,
        table_count: int,
    ) -> dict[int, int]:
        """
        Get current occupancy for all tables.

        Args:
            db: Database session
            event_id: Event UUID
            table_count: Number of tables

        Returns:
            dict[int, int]: Map of table_number -> current_occupancy
        """
        from sqlalchemy import func

        query = (
            select(
                RegistrationGuest.table_number,
                func.count(RegistrationGuest.id).label("count"),
            )
            .join(EventRegistration)
            .where(
                EventRegistration.event_id == event_id,
                RegistrationGuest.status == "confirmed",
                RegistrationGuest.table_number.isnot(None),
            )
            .group_by(RegistrationGuest.table_number)
        )
        result = await db.execute(query)
        rows = result.all()

        return {int(row[0]): int(row[1]) for row in rows}

    @staticmethod
    async def _count_unassigned_guests(
        db: AsyncSession,
        event_id: UUID,
    ) -> int:
        """
        Count guests without table assignments.

        Args:
            db: Database session
            event_id: Event UUID

        Returns:
            int: Number of unassigned guests
        """
        from sqlalchemy import func

        query = (
            select(func.count(RegistrationGuest.id))
            .join(EventRegistration)
            .where(
                EventRegistration.event_id == event_id,
                RegistrationGuest.status == "confirmed",
                RegistrationGuest.table_number.is_(None),
            )
        )
        result = await db.execute(query)
        return result.scalar_one()
