# Quickstart: Ticket Package Management

**Feature**: 015-ticket-management-admin | **Date**: 2026-01-06

## Overview

This guide provides step-by-step instructions for implementing the ticket package management feature. Follow these phases sequentially.

## Prerequisites

- ✅ Branch `015-ticket-management-admin` checked out
- ✅ Backend dependencies installed (`cd backend && poetry install`)
- ✅ Frontend dependencies installed (`cd frontend/fundrbolt-admin && pnpm install`)
- ✅ PostgreSQL and Redis running locally (via `docker-compose up`)
- ✅ Azure Blob Storage account configured (see `.env.example`)

## Phase 1: Database Schema & Models

### 1.1 Create Database Migration

**File**: `backend/alembic/versions/xxx_add_ticket_management.py`

```bash
cd backend
poetry run alembic revision -m "add ticket management tables"
```

**Migration Content**:
- Create 7 new tables: `ticket_packages`, `custom_ticket_options`, `option_responses`, `promo_codes`, `promo_code_applications`, `ticket_purchases`, `assigned_tickets`
- Add indexes on all foreign keys and query filters
- Add CHECK constraints for data validation
- Create PostgreSQL trigger for audit log immutability
- See `data-model.md` for complete table definitions

**Run Migration**:
```bash
poetry run alembic upgrade head
```

### 1.2 Create SQLAlchemy Models

**Files**:
- `backend/app/models/ticket_package.py` - TicketPackage model with version column
- `backend/app/models/custom_ticket_option.py` - CustomTicketOption model with JSONB choices
- `backend/app/models/option_response.py` - OptionResponse model
- `backend/app/models/promo_code.py` - PromoCode model with version column
- `backend/app/models/promo_code_application.py` - PromoCodeApplication model
- `backend/app/models/ticket_purchase.py` - TicketPurchase model
- `backend/app/models/assigned_ticket.py` - AssignedTicket model

**Key Implementation Points**:
- Use `version_id_col=True` for `TicketPackage.version` and `PromoCode.version`
- Add relationships: `ticket_package.custom_options`, `ticket_package.purchases`, etc.
- Use `JSONB` for `CustomTicketOption.choices` (PostgreSQL only)
- Add `CheckConstraint` for validation (sold_count >= 0, quantity_limit validation, etc.)

**Example Model**:
```python
from sqlalchemy import Column, String, Integer, Numeric, Boolean, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class TicketPackage(Base):
    __tablename__ = "ticket_packages"

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(UUID, ForeignKey("events.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    quantity_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sold_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, version_id_col=True)

    # Relationships
    custom_options: Mapped[list["CustomTicketOption"]] = relationship(back_populates="package")
    purchases: Mapped[list["TicketPurchase"]] = relationship(back_populates="package")

    __table_args__ = (
        CheckConstraint("sold_count >= 0", name="sold_count_non_negative"),
        CheckConstraint("quantity_limit IS NULL OR quantity_limit >= sold_count", name="quantity_within_limit"),
    )
```

### 1.3 Create Pydantic Schemas

**Files**:
- `backend/app/schemas/ticket_package.py` - Request/response schemas for ticket packages
- `backend/app/schemas/custom_option.py` - Request/response schemas for custom options
- `backend/app/schemas/promo_code.py` - Request/response schemas for promo codes
- `backend/app/schemas/ticket_purchase.py` - Request/response schemas for purchases

**Example Schema**:
```python
from pydantic import BaseModel, Field, validator
from decimal import Decimal
from uuid import UUID

class TicketPackageCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    price: Decimal = Field(ge=0)
    quantity_limit: int | None = Field(None, ge=0)
    display_order: int = 0

class TicketPackageResponse(BaseModel):
    id: UUID
    event_id: UUID
    name: str
    description: str | None
    price: Decimal
    quantity_limit: int | None
    sold_count: int
    display_order: int
    image_url: str | None
    is_enabled: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
```

## Phase 2: Service Layer

### 2.1 Ticket Package Service

**File**: `backend/app/services/ticket_package_service.py`

**Key Functions**:
- `create_package()` - Create new package
- `update_package()` - Update with audit logging if sold_count > 0
- `delete_package()` - Soft delete (set is_enabled=False if sales exist)
- `reorder_packages()` - Update display_order for drag-and-drop
- `enable_package()` / `disable_package()` - Toggle visibility

**Example Implementation**:
```python
async def update_package(
    package_id: UUID,
    updates: TicketPackageUpdate,
    db: AsyncSession,
    user: User
) -> TicketPackage:
    """Update ticket package with audit logging."""
    package = await db.get(TicketPackage, package_id)
    if not package:
        raise PackageNotFoundError()

    # Log changes if package has sales
    if package.sold_count > 0:
        for field, new_value in updates.dict(exclude_unset=True).items():
            old_value = getattr(package, field)
            if old_value != new_value:
                audit = AuditLog(
                    entity_type="ticket_package",
                    entity_id=package_id,
                    action="updated",
                    user_id=user.id,
                    field_name=field,
                    old_value=str(old_value),
                    new_value=str(new_value)
                )
                db.add(audit)

    # Apply updates
    for field, value in updates.dict(exclude_unset=True).items():
        setattr(package, field, value)

    await db.commit()
    return package
```

### 2.2 Promo Code Service

**File**: `backend/app/services/promo_code_service.py`

**Key Functions**:
- `validate_promo_code()` - Check expiration, usage limits with Redis caching
- `apply_promo_code()` - Calculate discount and create application record
- `increment_usage()` - Increment current_uses with optimistic locking

**Redis Caching**:
```python
async def validate_promo_code(
    code: str,
    event_id: UUID,
    user_id: UUID,
    redis: Redis,
    db: AsyncSession
) -> PromoCode:
    """Validate promo code with Redis caching."""
    cache_key = f"promo:{event_id}:{code}"

    # Check cache (60-second TTL)
    cached = await redis.get(cache_key)
    if cached:
        promo_data = json.loads(cached)
        promo = PromoCode(**promo_data)
    else:
        # Query database
        result = await db.execute(
            select(PromoCode).where(
                PromoCode.code == code,
                PromoCode.event_id == event_id
            )
        )
        promo = result.scalar_one_or_none()
        if not promo:
            raise PromoCodeNotFoundError()

        # Cache for 60 seconds
        await redis.setex(cache_key, 60, json.dumps(promo.to_dict()))

    # Validate (always check DB for usage counts)
    if promo.expires_at and datetime.now(UTC) > promo.expires_at:
        raise PromoCodeExpiredError()

    if promo.max_total_uses:
        total = await db.scalar(
            select(func.count(PromoCodeApplication.id))
            .where(PromoCodeApplication.promo_code_id == promo.id)
        )
        if total >= promo.max_total_uses:
            raise PromoCodeMaxUsesError()

    # Check per-donor limit...

    return promo
```

### 2.3 Ticket Purchase Service

**File**: `backend/app/services/ticket_purchase_service.py`

**Key Functions**:
- `purchase_tickets()` - Create purchase with concurrency control
- `validate_custom_options()` - Enforce required vs optional responses
- `create_assigned_tickets()` - Generate QR codes and ticket numbers

**Optimistic Locking**:
```python
async def purchase_tickets(
    package_id: UUID,
    quantity: int,
    option_responses: list[OptionResponseData],
    promo_code: str | None,
    db: AsyncSession,
    redis: Redis,
    user: User,
    max_retries: int = 3
) -> TicketPurchase:
    """Purchase tickets with optimistic locking."""
    for attempt in range(max_retries):
        try:
            # Load package (includes version)
            package = await db.get(TicketPackage, package_id)

            # Check availability
            if package.quantity_limit:
                if package.sold_count + quantity > package.quantity_limit:
                    raise SoldOutError()

            # Validate custom options
            await validate_custom_options(package, option_responses, db)

            # Apply promo code if provided
            discount = 0
            if promo_code:
                promo = await validate_promo_code(promo_code, package.event_id, user.id, redis, db)
                discount = calculate_discount(package.price * quantity, promo)

            # Create purchase
            purchase = TicketPurchase(
                package_id=package_id,
                user_id=user.id,
                quantity=quantity,
                base_price=package.price * quantity,
                discount_amount=discount,
                total_price=max(0, package.price * quantity - discount)
            )
            db.add(purchase)

            # Increment sold count (version increments automatically)
            package.sold_count += quantity

            # Commit (fails with StaleDataError if version mismatch)
            await db.commit()

            # Invalidate sales cache
            await redis.delete(f"sales:event:{package.event_id}")

            return purchase

        except StaleDataError:
            await db.rollback()
            if attempt == max_retries - 1:
                raise ConcurrencyError("Too many concurrent purchases")
            await asyncio.sleep(0.1 * (2 ** attempt))  # Exponential backoff
```

### 2.4 Image Upload Service

**File**: `backend/app/services/image_service.py`

**Key Functions**:
- `upload_package_image()` - Upload to Azure Blob Storage with virus scanning
- `delete_package_image()` - Remove from Blob Storage
- `validate_image()` - Check MIME type, magic bytes, size

**Azure Blob Integration**:
```python
from azure.storage.blob.aio import BlobServiceClient

async def upload_package_image(
    file: UploadFile,
    event_id: UUID,
    package_id: UUID
) -> str:
    """Upload image to Azure Blob Storage."""
    # Validate
    if file.size > 5 * 1024 * 1024:  # 5MB
        raise ImageTooLargeError()

    if file.content_type not in ["image/jpeg", "image/png", "image/webp"]:
        raise InvalidImageFormatError()

    # Upload
    blob_service = BlobServiceClient.from_connection_string(settings.AZURE_STORAGE_CONNECTION)
    container = blob_service.get_container_client("ticket-images")
    blob_name = f"{event_id}/{package_id}/{uuid4()}.{file.filename.split('.')[-1]}"
    blob_client = container.get_blob_client(blob_name)

    await blob_client.upload_blob(file.file, overwrite=False)

    # Azure Defender scans automatically

    return blob_client.url
```

## Phase 3: API Endpoints

### 3.1 Admin Endpoints

**File**: `backend/app/api/v1/admin/ticket_packages.py`

**Endpoints**:
- `GET /admin/events/{event_id}/tickets/packages` - List packages
- `POST /admin/events/{event_id}/tickets/packages` - Create package
- `PATCH /admin/events/{event_id}/tickets/packages/{package_id}` - Update package
- `DELETE /admin/events/{event_id}/tickets/packages/{package_id}` - Delete package
- `POST /admin/events/{event_id}/tickets/packages/reorder` - Reorder packages
- `POST /admin/events/{event_id}/tickets/packages/{package_id}/image` - Upload image

**Example Endpoint**:
```python
from fastapi import APIRouter, Depends, UploadFile
from app.services import ticket_package_service
from app.middleware.auth import require_role

router = APIRouter(prefix="/admin/events/{event_id}/tickets", tags=["Ticket Packages (Admin)"])

@router.get("/packages")
async def list_packages(
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("event_coordinator"))
) -> dict:
    """List ticket packages for event."""
    packages = await ticket_package_service.list_packages(event_id, db)
    return {"packages": packages}

@router.post("/packages")
async def create_package(
    event_id: UUID,
    data: TicketPackageCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("event_coordinator"))
) -> TicketPackageResponse:
    """Create new ticket package."""
    package = await ticket_package_service.create_package(event_id, data, user, db)
    return package
```

### 3.2 Public Endpoints

**File**: `backend/app/api/v1/public/ticket_purchases.py`

**Endpoints**:
- `GET /events/{event_id}/tickets/packages` - List available packages (public)
- `POST /events/{event_id}/tickets/purchase` - Purchase tickets
- `GET /events/{event_id}/promo-codes/{code}/validate` - Validate promo code

## Phase 4: Frontend (Admin PWA)

### 4.1 API Client

**File**: `frontend/fundrbolt-admin/src/services/api/ticketPackages.ts`

```typescript
import { api } from './client';

export const ticketPackagesApi = {
  list: (eventId: string) => api.get(`/admin/events/${eventId}/tickets/packages`),
  create: (eventId: string, data: TicketPackageCreate) =>
    api.post(`/admin/events/${eventId}/tickets/packages`, data),
  update: (eventId: string, packageId: string, data: TicketPackageUpdate) =>
    api.patch(`/admin/events/${eventId}/tickets/packages/${packageId}`, data),
  delete: (eventId: string, packageId: string) =>
    api.delete(`/admin/events/${eventId}/tickets/packages/${packageId}`),
  uploadImage: (eventId: string, packageId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/admin/events/${eventId}/tickets/packages/${packageId}/image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  reorder: (eventId: string, packageIds: string[]) =>
    api.post(`/admin/events/${eventId}/tickets/packages/reorder`, { package_ids: packageIds })
};
```

### 4.2 Zustand Store

**File**: `frontend/fundrbolt-admin/src/services/stores/ticketPackageStore.ts`

```typescript
import { create } from 'zustand';

interface TicketPackageStore {
  packages: TicketPackage[];
  salesCounts: Record<string, number>;
  setPackages: (packages: TicketPackage[]) => void;
  updateSalesCount: (packageId: string, count: number) => void;
}

export const useTicketPackageStore = create<TicketPackageStore>((set) => ({
  packages: [],
  salesCounts: {},
  setPackages: (packages) => set({ packages }),
  updateSalesCount: (packageId, count) =>
    set((state) => ({
      salesCounts: { ...state.salesCounts, [packageId]: count }
    }))
}));
```

### 4.3 Drag-and-Drop Component

**File**: `frontend/fundrbolt-admin/src/components/tickets/TicketPackageList.tsx`

**Install dnd-kit**:
```bash
cd frontend/fundrbolt-admin
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Implementation**:
```typescript
import { DndContext, closestCenter, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

export function TicketPackageList({ eventId }: Props) {
  const { packages, setPackages } = useTicketPackageStore();
  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = packages.findIndex(p => p.id === active.id);
      const newIndex = packages.findIndex(p => p.id === over.id);
      const reordered = arrayMove(packages, oldIndex, newIndex);

      setPackages(reordered);
      await ticketPackagesApi.reorder(eventId, reordered.map(p => p.id));
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={packages.map(p => p.id)} strategy={verticalListSortingStrategy}>
        {packages.map(pkg => (
          <SortablePackageCard key={pkg.id} package={pkg} />
        ))}
      </SortableContext>
    </DndContext>
  );
}
```

### 4.4 Real-Time Sales Tracking

**File**: `frontend/fundrbolt-admin/src/hooks/useRealTimeSales.ts`

```typescript
export function useRealTimeSales(eventId: string) {
  const { updateSalesCount } = useTicketPackageStore();

  useEffect(() => {
    const fetchSales = async () => {
      const response = await ticketPackagesApi.getSales(eventId);
      Object.entries(response.data.counts).forEach(([packageId, count]) => {
        updateSalesCount(packageId, count as number);
      });
    };

    // Initial fetch
    fetchSales();

    // Poll every 3 seconds
    const interval = setInterval(fetchSales, 3000);

    return () => clearInterval(interval);
  }, [eventId]);
}
```

### 4.5 UI Components

**Files to Create**:
- `TicketPackageForm.tsx` - Create/edit package form with validation
- `TicketPackageCard.tsx` - Display package with sales count, enable/disable buttons
- `TicketPackageImageUpload.tsx` - Drag-and-drop image upload with preview
- `CustomOptionsList.tsx` - Manage custom options (up to 4)
- `CustomOptionForm.tsx` - Add/edit custom option with type selector
- `PromoCodeList.tsx` - List promo codes with usage stats
- `PromoCodeForm.tsx` - Create/edit promo code with expiration picker

## Phase 5: Testing

### 5.1 Contract Tests

**File**: `backend/tests/contract/test_ticket_api_contracts.py`

```python
def test_create_package_contract(client):
    """Test POST /admin/events/{event_id}/tickets/packages contract."""
    response = client.post(
        f"/admin/events/{event_id}/tickets/packages",
        json={
            "name": "VIP Table",
            "price": 1200.00,
            "quantity_limit": 10
        },
        headers=auth_headers
    )
    assert response.status_code == 201
    data = response.json()
    assert "id" in data
    assert data["name"] == "VIP Table"
    assert data["price"] == 1200.00
```

### 5.2 Integration Tests

**File**: `backend/tests/integration/test_ticket_purchase_flows.py`

```python
async def test_purchase_with_promo_code_flow(db, client):
    """Test full ticket purchase flow with promo code."""
    # Create package
    package = await create_test_package(db)

    # Create promo code
    promo = await create_test_promo_code(db, discount_type="percentage", discount_value=20)

    # Purchase tickets
    response = client.post(
        f"/events/{package.event_id}/tickets/purchase",
        json={
            "package_id": str(package.id),
            "quantity": 2,
            "promo_code": promo.code,
            "option_responses": []
        }
    )

    assert response.status_code == 201
    data = response.json()
    assert data["discount_amount"] == 480.00  # 20% of 2400
    assert data["total_price"] == 1920.00
```

### 5.3 Concurrency Tests

**File**: `backend/tests/integration/test_ticket_concurrency.py`

```python
async def test_optimistic_locking_prevents_overselling(db):
    """Test that optimistic locking prevents overselling at quantity limit."""
    package = await create_test_package(db, quantity_limit=10, sold_count=9)

    # Attempt 2 concurrent purchases of last ticket
    tasks = [
        purchase_tickets(package.id, 1, db),
        purchase_tickets(package.id, 1, db)
    ]

    results = await asyncio.gather(*tasks, return_exceptions=True)

    # One should succeed, one should fail
    assert sum(isinstance(r, SoldOutError) for r in results) == 1
    assert sum(isinstance(r, TicketPurchase) for r in results) == 1
```

### 5.4 Frontend Tests

**File**: `frontend/fundrbolt-admin/tests/tickets/TicketPackageForm.test.tsx`

```typescript
describe('TicketPackageForm', () => {
  it('validates required fields', async () => {
    render(<TicketPackageForm eventId="test-event" />);

    const submitButton = screen.getByRole('button', { name: /create/i });
    fireEvent.click(submitButton);

    expect(await screen.findByText(/package name is required/i)).toBeInTheDocument();
    expect(await screen.findByText(/price is required/i)).toBeInTheDocument();
  });

  it('creates package successfully', async () => {
    const mockCreate = vi.fn().mockResolvedValue({ id: '123', name: 'VIP Table' });
    vi.spyOn(ticketPackagesApi, 'create').mockImplementation(mockCreate);

    render(<TicketPackageForm eventId="test-event" />);

    fireEvent.change(screen.getByLabelText(/package name/i), { target: { value: 'VIP Table' } });
    fireEvent.change(screen.getByLabelText(/price/i), { target: { value: '1200' } });
    fireEvent.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith('test-event', { name: 'VIP Table', price: 1200 });
    });
  });
});
```

## Phase 6: Documentation & Deployment

### 6.1 Update Agent Context

Run the agent context update script:

```bash
cd /home/jjeanes/fundrbolt-platform
.specify/scripts/bash/update-agent-context.sh copilot
```

This will add ticket management technologies to `.github/copilot-instructions.md`.

### 6.2 Run Pre-Commit Hooks

```bash
make check-commits
# or
./scripts/safe-commit.sh
```

### 6.3 Commit Changes

```bash
git add -A
git commit -m "feat(tickets): implement ticket package management (015)

- Add 7 database tables for ticket packages, custom options, promo codes
- Implement optimistic locking for concurrency control
- Add audit logging with PostgreSQL immutability trigger
- Create admin PWA UI with drag-and-drop reordering (dnd-kit)
- Add real-time sales tracking with 3-second polling
- Implement Azure Blob Storage integration for package images
- Add promo code validation with Redis caching
- Create 25+ API endpoints (admin + public)
- Add comprehensive tests (contract, integration, concurrency)
- Export sales data as CSV

Closes #015"
```

### 6.4 Create Pull Request

```bash
gh pr create --title "feat(tickets): Ticket Package Management (015)" \
             --body "$(cat pr-body.md)" \
             --base main
```

## Verification Checklist

Before marking feature complete, verify:

- [ ] All database migrations run successfully
- [ ] All 224+ backend tests pass (`poetry run pytest`)
- [ ] All frontend tests pass (`pnpm test`)
- [ ] Pre-commit hooks pass (formatting, linting, type checking)
- [ ] OpenAPI spec accessible at `http://localhost:8000/docs`
- [ ] Admin UI loads without errors
- [ ] Can create ticket package with image upload
- [ ] Can add up to 4 custom options per package
- [ ] Can create promo code with expiration and usage limits
- [ ] Can reorder packages via drag-and-drop
- [ ] Sales counts update within 3 seconds
- [ ] Audit trail visible for packages with sales
- [ ] CSV export downloads successfully
- [ ] Optimistic locking prevents overselling (run concurrency test)
- [ ] Azure Blob Storage integration works (upload/delete images)

## Troubleshooting

### Database Migration Fails

```bash
# Check current migration status
poetry run alembic current

# Rollback last migration
poetry run alembic downgrade -1

# Re-run migration
poetry run alembic upgrade head
```

### Redis Connection Issues

```bash
# Check Redis is running
docker-compose ps redis

# Test connection
redis-cli ping
```

### Azure Blob Storage Errors

```bash
# Verify environment variables
echo $AZURE_STORAGE_CONNECTION_STRING

# Test connection with Azure CLI
az storage container list --connection-string "$AZURE_STORAGE_CONNECTION_STRING"
```

### Frontend Build Errors

```bash
# Clear cache and reinstall
cd frontend/fundrbolt-admin
rm -rf node_modules .vite
pnpm install
pnpm dev
```

## Next Steps

After completing this feature, proceed to:
1. **Manual QA**: Test all user stories from spec.md
2. **Load Testing**: Simulate 100+ concurrent purchases (Phase 2)
3. **Security Review**: Audit auth, audit logging, file upload validation
4. **Documentation**: Update user guide with ticket package setup instructions
5. **Deployment**: Deploy to staging environment for beta testing

## Support

For issues or questions:
- Review `spec.md` for functional requirements
- Check `data-model.md` for database schema details
- Refer to `contracts/openapi.yaml` for API documentation
- Search existing tests for implementation examples
