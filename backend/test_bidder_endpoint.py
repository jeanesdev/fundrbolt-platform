"""Quick test for available bidder numbers endpoint."""

import httpx


async def test():
    # This test requires:
    # 1. Backend server running
    # 2. Valid event_id with seating configured
    # 3. Valid NPO admin auth token

    # Test endpoint
    event_id = "YOUR_EVENT_ID_HERE"  # Replace with actual event ID
    token = "YOUR_TOKEN_HERE"  # Replace with actual token

    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        response = await client.get(
            f"/api/v1/admin/events/{event_id}/seating/bidder-numbers/available",
            headers={"Authorization": f"Bearer {token}"},
            params={"limit": 5},
        )

        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")

        if response.status_code == 200:
            data = response.json()
            print(f"\nAvailable numbers: {data['available_numbers']}")
            print(f"Total available: {data['total_available']}")
            print(f"Total assigned: {data['total_assigned']}")


if __name__ == "__main__":
    print("Note: Update event_id and token in script before running")
    # asyncio.run(test())  # Uncomment after updating values
