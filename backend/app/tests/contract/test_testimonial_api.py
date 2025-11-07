"""Contract tests for testimonial public API endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_testimonials_returns_200(client: AsyncClient) -> None:
    """Test GET /public/testimonials returns 200."""
    response = await client.get("/api/v1/public/testimonials")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_get_testimonials_with_pagination(client: AsyncClient) -> None:
    """Test GET /public/testimonials with pagination parameters."""
    response = await client.get("/api/v1/public/testimonials", params={"limit": 5, "skip": 0})
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) <= 5


@pytest.mark.asyncio
async def test_get_testimonials_with_role_filter(client: AsyncClient) -> None:
    """Test GET /public/testimonials with role filter."""
    response = await client.get("/api/v1/public/testimonials", params={"role": "donor"})
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    # All returned testimonials should have role "donor"
    for testimonial in data:
        assert testimonial["author_role"] == "donor"


@pytest.mark.asyncio
async def test_get_testimonials_response_structure(client: AsyncClient) -> None:
    """Test GET /public/testimonials returns correct structure."""
    response = await client.get("/api/v1/public/testimonials", params={"limit": 1})
    assert response.status_code == 200
    data = response.json()

    if len(data) > 0:
        testimonial = data[0]
        required_fields = [
            "id",
            "quote_text",
            "author_name",
            "author_role",
            "organization_name",
            "photo_url",
            "display_order",
            "is_published",
            "created_at",
        ]
        for field in required_fields:
            assert field in testimonial

        # Verify types
        assert isinstance(testimonial["id"], str)
        assert isinstance(testimonial["quote_text"], str)
        assert isinstance(testimonial["author_name"], str)
        assert testimonial["author_role"] in ["donor", "auctioneer", "npo_admin"]
        assert isinstance(testimonial["display_order"], int)
        assert isinstance(testimonial["is_published"], bool)
        assert testimonial["is_published"] is True  # Only published should be returned


@pytest.mark.asyncio
async def test_get_testimonials_count(client: AsyncClient) -> None:
    """Test GET /public/testimonials/count returns count."""
    response = await client.get("/api/v1/public/testimonials/count")
    assert response.status_code == 200
    data = response.json()
    assert "count" in data
    assert isinstance(data["count"], int)
    assert data["count"] >= 0


@pytest.mark.asyncio
async def test_get_testimonials_count_with_filter(client: AsyncClient) -> None:
    """Test GET /public/testimonials/count with role filter."""
    response = await client.get("/api/v1/public/testimonials/count", params={"role": "donor"})
    assert response.status_code == 200
    data = response.json()
    assert "count" in data
    assert isinstance(data["count"], int)


@pytest.mark.asyncio
async def test_get_testimonials_invalid_role_filter(client: AsyncClient) -> None:
    """Test GET /public/testimonials with invalid role returns 422."""
    response = await client.get("/api/v1/public/testimonials", params={"role": "invalid_role"})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_get_testimonials_negative_pagination(client: AsyncClient) -> None:
    """Test GET /public/testimonials with negative pagination returns 422."""
    response = await client.get("/api/v1/public/testimonials", params={"skip": -1, "limit": 10})
    assert response.status_code == 422
