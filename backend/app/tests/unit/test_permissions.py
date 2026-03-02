"""Unit tests for permission checking logic.

These tests verify the PermissionService methods that check
whether a user can perform specific actions based on their role.

Unlike contract/integration tests, unit tests focus on isolated
business logic without making HTTP requests or database calls.
"""

import uuid

import pytest

# Note: PermissionService doesn't exist yet, will be created in implementation
# These tests define the expected interface and behavior


class MockUser:
    """Mock user object for testing."""

    def __init__(
        self,
        id: uuid.UUID,
        role: str,
        npo_id: uuid.UUID | None = None,
    ):
        self.id = id
        self.role = role
        self.role_name = role  # PermissionService uses role_name
        self.npo_id = npo_id


class TestPermissionService:
    """Unit tests for PermissionService methods."""

    @pytest.mark.asyncio
    async def test_super_admin_can_view_all_users(self) -> None:
        """Test that super_admin can view all users regardless of NPO."""
        from app.services.permission_service import PermissionService

        user = MockUser(id=uuid.uuid4(), role="super_admin")
        service = PermissionService()

        # Super admin can view any user
        assert await service.can_view_user(user, target_user_npo_id=None) is True
        assert await service.can_view_user(user, target_user_npo_id=uuid.uuid4()) is True

    @pytest.mark.asyncio
    async def test_npo_admin_can_view_users_in_their_npo(self) -> None:
        """Test that npo_admin can only view users in their NPO."""
        from app.services.permission_service import PermissionService

        npo_id = uuid.uuid4()
        user = MockUser(id=uuid.uuid4(), role="npo_admin", npo_id=npo_id)
        service = PermissionService()

        # Can view users in same NPO
        assert await service.can_view_user(user, target_user_npo_id=npo_id) is True

        # Cannot view users in different NPO
        other_npo_id = uuid.uuid4()
        assert await service.can_view_user(user, target_user_npo_id=other_npo_id) is False

        # Cannot view users with no NPO
        assert await service.can_view_user(user, target_user_npo_id=None) is False

    @pytest.mark.asyncio
    async def test_donor_cannot_view_users(self) -> None:
        """Test that donor cannot view user lists."""
        from app.services.permission_service import PermissionService

        user = MockUser(id=uuid.uuid4(), role="donor")
        service = PermissionService()

        # Donors cannot view any users
        assert await service.can_view_user(user, target_user_npo_id=None) is False
        assert await service.can_view_user(user, target_user_npo_id=uuid.uuid4()) is False

    @pytest.mark.asyncio
    async def test_staff_cannot_view_users(self) -> None:
        """Test that staff cannot view general user lists."""
        from app.services.permission_service import PermissionService

        user = MockUser(id=uuid.uuid4(), role="staff")
        service = PermissionService()

        # Staff cannot view general user lists (only event-specific)
        assert await service.can_view_user(user, target_user_npo_id=None) is False
        assert await service.can_view_user(user, target_user_npo_id=uuid.uuid4()) is False

    @pytest.mark.asyncio
    async def test_super_admin_can_create_users(self) -> None:
        """Test that super_admin can create users in any NPO."""
        from app.services.permission_service import PermissionService

        user = MockUser(id=uuid.uuid4(), role="super_admin")
        service = PermissionService()

        assert await service.can_create_user(user, target_npo_id=None) is True
        assert await service.can_create_user(user, target_npo_id=uuid.uuid4()) is True

    @pytest.mark.asyncio
    async def test_npo_admin_can_create_users_in_their_npo(self) -> None:
        """Test that npo_admin can only create users in their NPO."""
        from app.services.permission_service import PermissionService

        npo_id = uuid.uuid4()
        user = MockUser(id=uuid.uuid4(), role="npo_admin", npo_id=npo_id)
        service = PermissionService()

        # Can create users in same NPO
        assert await service.can_create_user(user, target_npo_id=npo_id) is True

        # Cannot create users in different NPO
        other_npo_id = uuid.uuid4()
        assert await service.can_create_user(user, target_npo_id=other_npo_id) is False

        # Can create users with no NPO (donors) within their NPO context
        assert await service.can_create_user(user, target_npo_id=None) is True

    @pytest.mark.asyncio
    async def test_donor_cannot_create_users(self) -> None:
        """Test that donor cannot create users."""
        from app.services.permission_service import PermissionService

        user = MockUser(id=uuid.uuid4(), role="donor")
        service = PermissionService()

        assert await service.can_create_user(user, target_npo_id=None) is False
        assert await service.can_create_user(user, target_npo_id=uuid.uuid4()) is False

    @pytest.mark.asyncio
    async def test_staff_cannot_create_users(self) -> None:
        """Test that staff cannot create users."""
        from app.services.permission_service import PermissionService

        user = MockUser(id=uuid.uuid4(), role="staff")
        service = PermissionService()

        assert await service.can_create_user(user, target_npo_id=None) is False
        assert await service.can_create_user(user, target_npo_id=uuid.uuid4()) is False

    @pytest.mark.asyncio
    async def test_super_admin_can_assign_any_role(self) -> None:
        """Test that super_admin can assign any role."""
        from app.services.permission_service import PermissionService

        user = MockUser(id=uuid.uuid4(), role="super_admin")
        service = PermissionService()

        # Can assign any role
        for role in ["super_admin", "npo_admin", "event_coordinator", "staff", "donor"]:
            assert await service.can_assign_role(user, target_role=role) is True

    @pytest.mark.asyncio
    async def test_npo_admin_can_assign_limited_roles(self) -> None:
        """Test that npo_admin can only assign non-super_admin roles."""
        from app.services.permission_service import PermissionService

        npo_id = uuid.uuid4()
        user = MockUser(id=uuid.uuid4(), role="npo_admin", npo_id=npo_id)
        service = PermissionService()

        # Cannot assign super_admin
        assert await service.can_assign_role(user, target_role="super_admin") is False

        # Can assign other roles
        for role in ["npo_admin", "event_coordinator", "staff", "donor"]:
            assert await service.can_assign_role(user, target_role=role) is True

    @pytest.mark.asyncio
    async def test_donor_cannot_assign_roles(self) -> None:
        """Test that donor cannot assign roles."""
        from app.services.permission_service import PermissionService

        user = MockUser(id=uuid.uuid4(), role="donor")
        service = PermissionService()

        for role in ["super_admin", "npo_admin", "event_coordinator", "staff", "donor"]:
            assert await service.can_assign_role(user, target_role=role) is False

    @pytest.mark.asyncio
    async def test_staff_cannot_assign_roles(self) -> None:
        """Test that staff cannot assign roles."""
        from app.services.permission_service import PermissionService

        user = MockUser(id=uuid.uuid4(), role="staff")
        service = PermissionService()

        for role in ["super_admin", "npo_admin", "event_coordinator", "staff", "donor"]:
            assert await service.can_assign_role(user, target_role=role) is False

    @pytest.mark.asyncio
    async def test_npo_admin_role_requires_npo_id(self) -> None:
        """Test validation that npo_admin role requires npo_id."""
        from app.services.permission_service import PermissionService

        service = PermissionService()

        # npo_admin requires npo_id
        assert service.role_requires_npo_id("npo_admin") is True
        assert service.role_requires_npo_id("event_coordinator") is True
        assert service.role_requires_npo_id("staff") is True

        # Other roles don't require npo_id
        assert service.role_requires_npo_id("super_admin") is False
        assert service.role_requires_npo_id("donor") is False

    @pytest.mark.asyncio
    async def test_donor_and_staff_roles_forbid_npo_id(self) -> None:
        """Test validation that donor and staff roles must not have npo_id."""
        from app.services.permission_service import PermissionService

        service = PermissionService()

        # donor forbids npo_id
        assert service.role_forbids_npo_id("donor") is True
        assert service.role_forbids_npo_id("staff") is False

        # Other roles don't forbid npo_id
        assert service.role_forbids_npo_id("super_admin") is False
        assert service.role_forbids_npo_id("npo_admin") is False
        assert service.role_forbids_npo_id("event_coordinator") is False

    @pytest.mark.asyncio
    async def test_can_modify_user_checks_permissions(self) -> None:
        """Test that can_modify_user checks appropriate permissions."""
        from app.services.permission_service import PermissionService

        npo_id = uuid.uuid4()
        service = PermissionService()

        # Super admin can modify anyone
        super_admin = MockUser(id=uuid.uuid4(), role="super_admin")
        assert await service.can_modify_user(super_admin, target_user_npo_id=npo_id) is True
        assert await service.can_modify_user(super_admin, target_user_npo_id=None) is True

        # NPO admin can modify users in their NPO
        npo_admin = MockUser(id=uuid.uuid4(), role="npo_admin", npo_id=npo_id)
        assert await service.can_modify_user(npo_admin, target_user_npo_id=npo_id) is True
        assert await service.can_modify_user(npo_admin, target_user_npo_id=uuid.uuid4()) is False

        # Donor cannot modify users
        donor = MockUser(id=uuid.uuid4(), role="donor")
        assert await service.can_modify_user(donor, target_user_npo_id=None) is False

    @pytest.mark.asyncio
    async def test_event_coordinator_has_limited_permissions(self) -> None:
        """Test that event_coordinator has appropriate limited permissions."""
        from app.services.permission_service import PermissionService

        npo_id = uuid.uuid4()
        user = MockUser(id=uuid.uuid4(), role="event_coordinator", npo_id=npo_id)
        service = PermissionService()

        # Event coordinator can view users in their NPO
        assert await service.can_view_user(user, target_user_npo_id=npo_id) is True
        assert await service.can_view_user(user, target_user_npo_id=uuid.uuid4()) is False

        # Event coordinator can create staff for events
        assert await service.can_create_user(user, target_npo_id=npo_id) is True
        assert await service.can_create_user(user, target_npo_id=uuid.uuid4()) is False

        # Event coordinator can assign limited roles (staff, donor)
        assert await service.can_assign_role(user, target_role="staff") is True
        assert await service.can_assign_role(user, target_role="donor") is True
        assert await service.can_assign_role(user, target_role="npo_admin") is False
        assert await service.can_assign_role(user, target_role="super_admin") is False
