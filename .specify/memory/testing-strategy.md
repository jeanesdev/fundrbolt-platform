# Fundrbolt Testing Strategy

## Test Pyramid

```

       ┌────────────┐
       │    E2E     │  10-15 tests (Playwright)
       │   Tests    │  Full user flows
       └────────────┘
      ┌──────────────┐
      │ Integration  │  50-100 tests
      │    Tests     │  API + DB + External services
      └──────────────┘
    ┌──────────────────┐
    │   Unit Tests     │  500+ tests (80%+ coverage)
    │                  │  Business logic, validation
    └──────────────────┘
    ```

## Unit Tests (80%+ coverage)
**Tool:** pytest
**Location:** `backend/tests/unit/`

**What to test:**
- Business logic (bid validation, auction rules)
- Pydantic models (validation)
- Utility functions

**Example:**
```

def test_bid_validation_minimum_amount():
item = Item(starting_bid=100, bid_increment=25)
assert validate_bid(item, amount=99) == False
assert validate_bid(item, amount=100) == True

```

## Integration Tests
**Tool:** pytest + TestClient (FastAPI)
**Location:** `backend/tests/integration/`

**What to test:**
- API endpoints (auth, CRUD)
- Database interactions
- WebSocket connections
- External services (mocked)

**Example:**
```

def test_place_bid_api(client, test_event, test_item):
response = client.post(
f"/api/v1/items/{test_item.id}/bids",
json={"amount": 200},
headers={"Authorization": f"Bearer {token}"}
)
assert response.status_code == 201
assert response.json()["amount"] == 200

```

## E2E Tests (10-15 critical flows)
**Tool:** Playwright
**Location:** `frontend/tests/e2e/`

**Critical flows:**
1. Donor registers → logs in → browses items → places bid → wins item
2. Event coordinator creates event → adds items → launches auction
3. Auctioneer starts live auction → sees bids → closes auction
4. Staff checks in donor → assigns paddle

## Load Tests (Phase 2)
**Tool:** Locust
**Target:** 100+ concurrent bidders per event

**Scenarios:**
- 100 users placing bids simultaneously
- 500 WebSocket connections sustained
- Leaderboard updates <500ms under load
