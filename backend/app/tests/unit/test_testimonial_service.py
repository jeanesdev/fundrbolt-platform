"""Unit tests for TestimonialService."""

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.testimonial import AuthorRole, Testimonial
from app.schemas.testimonial import TestimonialCreate, TestimonialUpdate
from app.services.testimonial_service import TestimonialService


@pytest.fixture
def testimonial_service(db_session: AsyncSession) -> TestimonialService:
    """Create TestimonialService instance."""
    return TestimonialService(db_session)


@pytest.mark.asyncio
async def test_get_published_testimonials(
    testimonial_service: TestimonialService,
    db_session: AsyncSession,
    test_super_admin_user,
) -> None:
    """Test getting published testimonials."""
    # Create a published testimonial
    testimonial = Testimonial(
        quote_text="This is a test testimonial with sufficient length",
        author_name="Test Author",
        author_role=AuthorRole.DONOR.value,
        organization_name="Test Org",
        display_order=1,
        is_published=True,
        created_by=test_super_admin_user.id,
    )
    db_session.add(testimonial)
    await db_session.commit()
    test_id = testimonial.id

    testimonials = await testimonial_service.get_published_testimonials()

    assert len(testimonials) >= 1
    assert any(t.id == test_id for t in testimonials)
    # All should be published
    assert all(t.is_published for t in testimonials)


@pytest.mark.asyncio
async def test_get_published_testimonials_with_pagination(
    testimonial_service: TestimonialService,
) -> None:
    """Test pagination of published testimonials."""
    # Get first page
    page1 = await testimonial_service.get_published_testimonials(skip=0, limit=2)
    assert len(page1) <= 2

    # Get second page
    page2 = await testimonial_service.get_published_testimonials(skip=2, limit=2)
    assert len(page2) <= 2

    # Pages should not overlap
    if len(page1) > 0 and len(page2) > 0:
        page1_ids = {t.id for t in page1}
        page2_ids = {t.id for t in page2}
        assert page1_ids.isdisjoint(page2_ids)


@pytest.mark.asyncio
async def test_get_published_testimonials_with_role_filter(
    testimonial_service: TestimonialService,
    db_session: AsyncSession,
    test_super_admin_user,
) -> None:
    """Test filtering testimonials by role."""
    # Create testimonials with different roles
    donor_testimonial = Testimonial(
        quote_text="Donor testimonial with enough length for validation",
        author_name="Donor",
        author_role=AuthorRole.DONOR.value,
        display_order=1,
        is_published=True,
        created_by=test_super_admin_user.id,
    )
    auctioneer_testimonial = Testimonial(
        quote_text="Auctioneer testimonial with sufficient character count",
        author_name="Auctioneer",
        author_role=AuthorRole.AUCTIONEER.value,
        display_order=2,
        is_published=True,
        created_by=test_super_admin_user.id,
    )
    db_session.add_all([donor_testimonial, auctioneer_testimonial])
    await db_session.commit()

    # Filter by donor
    donor_results = await testimonial_service.get_published_testimonials(
        role_filter=AuthorRole.DONOR
    )
    assert all(t.author_role == AuthorRole.DONOR.value for t in donor_results)

    # Filter by auctioneer
    auctioneer_results = await testimonial_service.get_published_testimonials(
        role_filter=AuthorRole.AUCTIONEER
    )
    assert all(t.author_role == AuthorRole.AUCTIONEER.value for t in auctioneer_results)


@pytest.mark.asyncio
async def test_count_published_testimonials(
    testimonial_service: TestimonialService,
    db_session: AsyncSession,
    test_super_admin_user,
) -> None:
    """Test counting published testimonials."""
    # Create a published testimonial
    testimonial = Testimonial(
        quote_text="Count test testimonial with sufficient length",
        author_name="Counter",
        author_role=AuthorRole.DONOR.value,
        display_order=1,
        is_published=True,
        created_by=test_super_admin_user.id,
    )
    db_session.add(testimonial)
    await db_session.commit()

    count = await testimonial_service.count_published_testimonials()
    assert count >= 1


@pytest.mark.asyncio
async def test_count_published_testimonials_with_filter(
    testimonial_service: TestimonialService,
    db_session: AsyncSession,
    test_super_admin_user,
) -> None:
    """Test counting published testimonials with role filter."""
    # Create a donor testimonial
    testimonial = Testimonial(
        quote_text="Donor count test with sufficient character length",
        author_name="Donor Counter",
        author_role=AuthorRole.DONOR.value,
        display_order=1,
        is_published=True,
        created_by=test_super_admin_user.id,
    )
    db_session.add(testimonial)
    await db_session.commit()

    count = await testimonial_service.count_published_testimonials(role_filter=AuthorRole.DONOR)
    assert count >= 1


@pytest.mark.asyncio
async def test_get_testimonial_by_id(
    testimonial_service: TestimonialService,
    db_session: AsyncSession,
    test_super_admin_user,
) -> None:
    """Test getting testimonial by ID."""
    # Create testimonial
    created = Testimonial(
        quote_text="Get by ID test with sufficient length",
        author_name="Test Author",
        author_role=AuthorRole.DONOR.value,
        display_order=1,
        is_published=True,
        created_by=test_super_admin_user.id,
    )
    db_session.add(created)
    await db_session.commit()
    await db_session.refresh(created)
    test_id = created.id
    test_quote = created.quote_text

    testimonial = await testimonial_service.get_testimonial_by_id(test_id)  # type: ignore[arg-type]

    assert testimonial is not None
    assert testimonial.id == test_id  # type: ignore[comparison-overlap]
    assert testimonial.quote_text == test_quote  # type: ignore[comparison-overlap]


@pytest.mark.asyncio
async def test_get_testimonial_by_id_not_found(
    testimonial_service: TestimonialService,
) -> None:
    """Test getting non-existent testimonial returns None."""
    testimonial = await testimonial_service.get_testimonial_by_id(uuid.uuid4())
    assert testimonial is None


@pytest.mark.asyncio
async def test_create_testimonial(
    testimonial_service: TestimonialService,
    test_super_admin_user,
) -> None:
    """Test creating a new testimonial."""
    data = TestimonialCreate(
        quote_text="New testimonial with sufficient length for validation",
        author_name="New Author",
        author_role=AuthorRole.DONOR,
        organization_name="New Org",
        display_order=99,
        is_published=False,
    )

    testimonial = await testimonial_service.create_testimonial(
        data, created_by=test_super_admin_user.id
    )

    assert testimonial.id is not None
    assert testimonial.quote_text == data.quote_text  # type: ignore[comparison-overlap]
    assert testimonial.author_name == data.author_name  # type: ignore[comparison-overlap]
    assert testimonial.author_role == data.author_role.value  # type: ignore[comparison-overlap]
    assert testimonial.organization_name == data.organization_name  # type: ignore[comparison-overlap]
    assert testimonial.is_published == data.is_published  # type: ignore[comparison-overlap]
    assert testimonial.created_by == test_super_admin_user.id  # type: ignore[comparison-overlap]


@pytest.mark.asyncio
async def test_update_testimonial(
    testimonial_service: TestimonialService,
    db_session: AsyncSession,
    test_super_admin_user,
) -> None:
    """Test updating an existing testimonial."""
    # Create testimonial
    created = Testimonial(
        quote_text="Original quote with sufficient length",
        author_name="Original Author",
        author_role=AuthorRole.DONOR.value,
        display_order=1,
        is_published=True,
        created_by=test_super_admin_user.id,
    )
    db_session.add(created)
    await db_session.commit()
    await db_session.refresh(created)
    test_id = created.id
    original_author = created.author_name

    update_data = TestimonialUpdate(
        quote_text="Updated quote text with enough characters for validation"
    )  # type: ignore[call-arg]

    updated = await testimonial_service.update_testimonial(test_id, update_data)  # type: ignore[arg-type]

    assert updated is not None
    assert updated.quote_text == update_data.quote_text  # type: ignore[comparison-overlap]
    assert updated.author_name == original_author  # type: ignore[comparison-overlap]


@pytest.mark.asyncio
async def test_update_testimonial_not_found(
    testimonial_service: TestimonialService,
) -> None:
    """Test updating non-existent testimonial returns None."""
    update_data = TestimonialUpdate(quote_text="Updated quote text with sufficient length")  # type: ignore[call-arg]
    updated = await testimonial_service.update_testimonial(uuid.uuid4(), update_data)
    assert updated is None


@pytest.mark.asyncio
async def test_delete_testimonial(
    testimonial_service: TestimonialService,
    db_session: AsyncSession,
    test_super_admin_user,
) -> None:
    """Test soft deleting a testimonial."""
    # Create testimonial
    created = Testimonial(
        quote_text="Delete test testimonial with sufficient length",
        author_name="Delete Me",
        author_role=AuthorRole.DONOR.value,
        display_order=1,
        is_published=True,
        created_by=test_super_admin_user.id,
    )
    db_session.add(created)
    await db_session.commit()
    await db_session.refresh(created)
    test_id = created.id

    success = await testimonial_service.delete_testimonial(test_id)  # type: ignore[arg-type]
    assert success is True

    # Verify it's soft deleted
    deleted = await testimonial_service.get_testimonial_by_id(test_id)  # type: ignore[arg-type]
    assert deleted is None  # Should not be returned after soft delete


@pytest.mark.asyncio
async def test_delete_testimonial_not_found(
    testimonial_service: TestimonialService,
) -> None:
    """Test deleting non-existent testimonial returns False."""
    success = await testimonial_service.delete_testimonial(uuid.uuid4())
    assert success is False


@pytest.mark.asyncio
async def test_get_all_testimonials(
    testimonial_service: TestimonialService,
    db_session: AsyncSession,
    test_super_admin_user,
) -> None:
    """Test getting all testimonials (admin view)."""
    # Create testimonial
    created = Testimonial(
        quote_text="Admin view test with sufficient length",
        author_name="Admin Viewer",
        author_role=AuthorRole.DONOR.value,
        display_order=1,
        is_published=True,
        created_by=test_super_admin_user.id,
    )
    db_session.add(created)
    await db_session.commit()
    test_id = created.id

    testimonials = await testimonial_service.get_all_testimonials()

    assert len(testimonials) >= 1
    assert any(t.id == test_id for t in testimonials)


@pytest.mark.asyncio
async def test_testimonials_ordered_by_display_order(
    testimonial_service: TestimonialService,
    db_session: AsyncSession,
    test_super_admin_user,
) -> None:
    """Test that testimonials are returned in display_order."""
    # Create testimonials with specific order
    t1 = Testimonial(
        quote_text="First testimonial with minimum required length",
        author_name="First",
        author_role=AuthorRole.DONOR.value,
        display_order=3,
        is_published=True,
        created_by=test_super_admin_user.id,
    )
    t2 = Testimonial(
        quote_text="Second testimonial with sufficient text content",
        author_name="Second",
        author_role=AuthorRole.DONOR.value,
        display_order=1,
        is_published=True,
        created_by=test_super_admin_user.id,
    )
    t3 = Testimonial(
        quote_text="Third testimonial with adequate character count",
        author_name="Third",
        author_role=AuthorRole.DONOR.value,
        display_order=2,
        is_published=True,
        created_by=test_super_admin_user.id,
    )
    db_session.add_all([t1, t2, t3])
    await db_session.commit()

    testimonials = await testimonial_service.get_published_testimonials(limit=100)

    # Find our test testimonials
    our_testimonials = [t for t in testimonials if t.author_name in ["First", "Second", "Third"]]

    # Should be ordered by display_order
    assert len(our_testimonials) == 3
    assert our_testimonials[0].display_order <= our_testimonials[1].display_order  # type: ignore[comparison-overlap]
    assert our_testimonials[1].display_order <= our_testimonials[2].display_order  # type: ignore[comparison-overlap]
