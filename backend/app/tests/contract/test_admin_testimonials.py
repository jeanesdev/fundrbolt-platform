"""Contract tests for admin testimonial API endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_admin_list_testimonials_requires_auth(client: AsyncClient) -> None:
    """Test GET /admin/testimonials requires authentication."""
    response = await client.get("/api/v1/admin/testimonials")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_admin_list_testimonials_requires_superadmin(
    authenticated_client: AsyncClient,
) -> None:
    """Test GET /admin/testimonials requires superadmin role."""
    response = await authenticated_client.get("/api/v1/admin/testimonials")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_admin_list_testimonials_success(
    authenticated_superadmin_client: AsyncClient,
) -> None:
    """Test GET /admin/testimonials returns list for superadmin."""
    response = await authenticated_superadmin_client.get("/api/v1/admin/testimonials")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_admin_create_testimonial_requires_auth(client: AsyncClient) -> None:
    """Test POST /admin/testimonials requires authentication."""
    response = await client.post(
        "/api/v1/admin/testimonials",
        json={
            "quote_text": "Test quote",
            "author_name": "Test Author",
            "author_role": "donor",
            "display_order": 1,
        },
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_admin_create_testimonial_requires_superadmin(
    authenticated_client: AsyncClient,
) -> None:
    """Test POST /admin/testimonials requires superadmin role."""
    response = await authenticated_client.post(
        "/api/v1/admin/testimonials",
        json={
            "quote_text": "Test quote",
            "author_name": "Test Author",
            "author_role": "donor",
            "display_order": 1,
        },
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_admin_create_testimonial_success(
    authenticated_superadmin_client: AsyncClient,
) -> None:
    """Test POST /admin/testimonials creates testimonial for superadmin."""
    response = await authenticated_superadmin_client.post(
        "/api/v1/admin/testimonials",
        json={
            "quote_text": "This is a test testimonial with enough content",
            "author_name": "Test Author",
            "author_role": "donor",
            "organization_name": "Test Org",
            "display_order": 99,
            "is_published": False,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["quote_text"] == "This is a test testimonial with enough content"
    assert data["author_name"] == "Test Author"
    assert data["author_role"] == "donor"
    assert data["organization_name"] == "Test Org"
    assert data["is_published"] is False


@pytest.mark.asyncio
async def test_admin_create_testimonial_validation(
    authenticated_superadmin_client: AsyncClient,
) -> None:
    """Test POST /admin/testimonials validates input."""
    # Missing required fields
    response = await authenticated_superadmin_client.post(
        "/api/v1/admin/testimonials",
        json={"quote_text": "Short"},
    )
    assert response.status_code == 422

    # Quote too short
    response = await authenticated_superadmin_client.post(
        "/api/v1/admin/testimonials",
        json={
            "quote_text": "Short",
            "author_name": "Test",
            "author_role": "donor",
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_admin_update_testimonial_requires_auth(client: AsyncClient) -> None:
    """Test PATCH /admin/testimonials/:id requires authentication."""
    response = await client.patch(
        "/api/v1/admin/testimonials/00000000-0000-0000-0000-000000000000",
        json={"quote_text": "Updated quote"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_admin_update_testimonial_not_found(
    authenticated_superadmin_client: AsyncClient,
) -> None:
    """Test PATCH /admin/testimonials/:id returns 404 for non-existent testimonial."""
    response = await authenticated_superadmin_client.patch(
        "/api/v1/admin/testimonials/00000000-0000-0000-0000-000000000000",
        json={"quote_text": "Updated quote with sufficient length"},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_admin_delete_testimonial_requires_auth(client: AsyncClient) -> None:
    """Test DELETE /admin/testimonials/:id requires authentication."""
    response = await client.delete(
        "/api/v1/admin/testimonials/00000000-0000-0000-0000-000000000000"
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_admin_delete_testimonial_not_found(
    authenticated_superadmin_client: AsyncClient,
) -> None:
    """Test DELETE /admin/testimonials/:id returns 404 for non-existent testimonial."""
    response = await authenticated_superadmin_client.delete(
        "/api/v1/admin/testimonials/00000000-0000-0000-0000-000000000000"
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_admin_get_testimonial_requires_auth(client: AsyncClient) -> None:
    """Test GET /admin/testimonials/:id requires authentication."""
    response = await client.get("/api/v1/admin/testimonials/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_admin_get_testimonial_not_found(
    authenticated_superadmin_client: AsyncClient,
) -> None:
    """Test GET /admin/testimonials/:id returns 404 for non-existent testimonial."""
    response = await authenticated_superadmin_client.get(
        "/api/v1/admin/testimonials/00000000-0000-0000-0000-000000000000"
    )
    assert response.status_code == 404
