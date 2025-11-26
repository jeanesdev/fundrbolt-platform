"""Meal Selection Service - Business logic for managing attendee meal choices."""

import logging
import uuid

from fastapi import HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.event import FoodOption
from app.models.event_registration import EventRegistration
from app.models.meal_selection import MealSelection
from app.models.registration_guest import RegistrationGuest
from app.models.user import User
from app.schemas.meal_selection import MealSelectionCreateRequest, MealSelectionUpdateRequest

logger = logging.getLogger(__name__)


class MealSelectionService:
    """Service for meal selection operations."""

    @staticmethod
    async def create_meal_selection(
        db: AsyncSession,
        meal_data: MealSelectionCreateRequest,
        current_user: User,
    ) -> MealSelection:
        """
        Create a meal selection for an attendee.

        Args:
            db: Database session
            meal_data: Meal selection creation data
            current_user: User creating the selection

        Returns:
            Created MealSelection object

        Raises:
            HTTPException: If registration not found, unauthorized, or validation fails
        """
        # Ensure registration_id is set (should always be set by endpoint)
        if not meal_data.registration_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Registration ID is required",
            )

        # Verify registration exists and user owns it
        registration_result = await db.execute(
            select(EventRegistration)
            .where(EventRegistration.id == meal_data.registration_id)
            .options(selectinload(EventRegistration.event))
        )
        registration = registration_result.scalar_one_or_none()

        if not registration:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Registration with ID {meal_data.registration_id} not found",
            )

        if registration.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only add meal selections to your own registrations",
            )

        # Verify food option exists and belongs to the event
        food_option_result = await db.execute(
            select(FoodOption).where(FoodOption.id == meal_data.food_option_id)
        )
        food_option = food_option_result.scalar_one_or_none()

        if not food_option:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Food option with ID {meal_data.food_option_id} not found",
            )

        if food_option.event_id != registration.event_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Food option does not belong to this event",
            )

        # If guest_id provided, verify guest belongs to registration
        if meal_data.guest_id:
            guest_result = await db.execute(
                select(RegistrationGuest).where(RegistrationGuest.id == meal_data.guest_id)
            )
            guest = guest_result.scalar_one_or_none()

            if not guest or guest.registration_id != meal_data.registration_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Guest does not belong to this registration",
                )

        # Check for duplicate meal selection
        existing = await MealSelectionService._get_meal_selection(
            db, meal_data.registration_id, meal_data.guest_id
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Meal selection already exists for this attendee",
            )

        # Create meal selection
        meal_selection = MealSelection(
            registration_id=meal_data.registration_id,
            guest_id=meal_data.guest_id,
            food_option_id=meal_data.food_option_id,
        )

        db.add(meal_selection)
        await db.commit()
        await db.refresh(meal_selection, ["food_option"])

        logger.info(
            f"Meal selection created: registration {registration.id}, "
            f"guest {meal_data.guest_id or 'registrant'}, "
            f"food option {food_option.name}"
        )
        return meal_selection

    @staticmethod
    async def update_meal_selection(
        db: AsyncSession,
        meal_selection_id: uuid.UUID,
        meal_data: MealSelectionUpdateRequest,
        current_user: User,
    ) -> MealSelection:
        """
        Update a meal selection.

        Args:
            db: Database session
            meal_selection_id: Meal selection ID
            meal_data: Update data
            current_user: User performing the update

        Returns:
            Updated MealSelection object

        Raises:
            HTTPException: If meal selection not found or unauthorized
        """
        # Get meal selection with registration
        result = await db.execute(
            select(MealSelection)
            .where(MealSelection.id == meal_selection_id)
            .options(selectinload(MealSelection.registration).selectinload(EventRegistration.event))
        )
        meal_selection = result.scalar_one_or_none()

        if not meal_selection:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Meal selection with ID {meal_selection_id} not found",
            )

        # Verify ownership
        if meal_selection.registration.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only update meal selections from your own registrations",
            )

        # Verify new food option exists and belongs to the event
        food_option_result = await db.execute(
            select(FoodOption).where(FoodOption.id == meal_data.food_option_id)
        )
        food_option = food_option_result.scalar_one_or_none()

        if not food_option:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Food option with ID {meal_data.food_option_id} not found",
            )

        if food_option.event_id != meal_selection.registration.event_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Food option does not belong to this event",
            )

        # Update food option
        meal_selection.food_option_id = meal_data.food_option_id

        await db.commit()
        await db.refresh(meal_selection, ["food_option"])

        logger.info(f"Meal selection updated: {meal_selection_id} to {food_option.name}")
        return meal_selection

    @staticmethod
    async def get_registration_meal_selections(
        db: AsyncSession,
        registration_id: uuid.UUID,
    ) -> list[MealSelection]:
        """
        Get all meal selections for a registration.

        Args:
            db: Database session
            registration_id: Registration ID

        Returns:
            List of MealSelection objects
        """
        result = await db.execute(
            select(MealSelection)
            .where(MealSelection.registration_id == registration_id)
            .options(selectinload(MealSelection.food_option), selectinload(MealSelection.guest))
            .order_by(MealSelection.created_at.asc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def get_event_meal_summary(
        db: AsyncSession,
        event_id: uuid.UUID,
    ) -> dict[str, int]:
        """
        Get meal selection summary for an event (for catering planning).

        Args:
            db: Database session
            event_id: Event ID

        Returns:
            Dictionary mapping food option name to count
        """

        result = await db.execute(
            select(
                FoodOption.name,
                func.count(MealSelection.id).label("count"),
            )
            .join(MealSelection, MealSelection.food_option_id == FoodOption.id)
            .join(EventRegistration, MealSelection.registration_id == EventRegistration.id)
            .where(EventRegistration.event_id == event_id)
            .group_by(FoodOption.name)
        )

        # Type: SQLAlchemy's func.count() returns int at runtime despite mypy inference issues
        rows = result.all()
        counts: dict[str, int] = {}
        for row in rows:
            counts[row.name] = row.count  # type: ignore[assignment]
        return counts

    @staticmethod
    async def _get_meal_selection(
        db: AsyncSession,
        registration_id: uuid.UUID,
        guest_id: uuid.UUID | None,
    ) -> MealSelection | None:
        """
        Get meal selection for a specific attendee.

        Args:
            db: Database session
            registration_id: Registration ID
            guest_id: Guest ID (None for registrant)

        Returns:
            MealSelection or None if not found
        """
        conditions = [MealSelection.registration_id == registration_id]

        if guest_id is None:
            conditions.append(MealSelection.guest_id.is_(None))
        else:
            conditions.append(MealSelection.guest_id == guest_id)

        result = await db.execute(select(MealSelection).where(and_(*conditions)))
        return result.scalar_one_or_none()
