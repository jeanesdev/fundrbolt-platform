# Research: Ticket Package Management

**Date**: 2026-01-06 | **Feature**: 015-ticket-management-admin

## Research Tasks

### 1. Drag-and-Drop Library Selection (React)

**Decision**: dnd-kit library

**Rationale**:
- **Modern & Maintained**: Active development, React 18+ compatible, TypeScript support
- **Accessibility**: Built-in keyboard navigation (WCAG 2.1 compliant), screen reader support
- **Performance**: Uses transform/translate for animations (GPU accelerated), minimal re-renders
- **Flexible**: Supports lists, grids, multiple containers, custom drag overlays
- **Small Bundle**: ~13KB gzipped vs 40KB+ for react-beautiful-dnd
- **Touch Support**: Works on tablets/mobile (critical for Admin PWA)

**Alternatives Considered**:
- **react-beautiful-dnd**: Deprecated by Atlassian, no React 18 support, larger bundle
- **react-dnd**: More complex API, less opinionated, steeper learning curve
- **SortableJS/react-sortablejs**: jQuery-era library, not idiomatic React
- **Custom implementation**: Would require 200+ lines for accessibility, touch support, animations

**Implementation**:
```typescript
import { DndContext, closestCenter, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
```

**Best Practices**:
- Use `restrictToVerticalAxis` for list reordering (prevents horizontal drift)
- Implement `onDragEnd` to call backend API for persistence
- Show visual feedback with `transform` and `transition` styles
- Disable drag for packages with active sales (FR-006 constraint)

### 2. Image Upload & Virus Scanning (Azure Blob Storage)

**Decision**: Azure Blob Storage + Azure Defender for Storage (virus scanning)

**Rationale**:
- **Managed Service**: No infrastructure setup, auto-scaling, 99.9% SLA
- **Cost-Effective**: $0.018/GB/month for hot tier, $0.0001 per 10k write operations
- **Virus Scanning**: Azure Defender for Storage scans on upload (uses Microsoft Malware Scanning)
- **CDN Integration**: Azure CDN can cache images globally for fast donor-facing display
- **Existing Stack**: Already using Blob Storage for event images, sponsor logos (013-fundrbolt-to-fundrbolt)
- **Python SDK**: azure-storage-blob with async support for FastAPI

**Alternatives Considered**:
- **ClamAV self-hosted**: Requires VM/container, maintenance overhead, resource-intensive scans
- **VirusTotal API**: $500/month for commercial use, rate limits, external dependency
- **AWS S3 + Lambda**: Would require multi-cloud setup, increased complexity

**Implementation (Backend)**:
```python
from azure.storage.blob.aio import BlobServiceClient
from azure.core.exceptions import AzureError

async def upload_ticket_image(file: UploadFile, event_id: str, package_id: str) -> str:
    """Upload ticket package image to Azure Blob Storage with virus scanning."""
    blob_service = BlobServiceClient.from_connection_string(settings.AZURE_STORAGE_CONNECTION)
    container = blob_service.get_container_client("ticket-images")

    # Generate unique blob name
    blob_name = f"{event_id}/{package_id}/{uuid4()}.{file.filename.split('.')[-1]}"
    blob_client = container.get_blob_client(blob_name)

    # Upload with metadata
    await blob_client.upload_blob(
        file.file,
        metadata={"event_id": event_id, "package_id": package_id, "uploaded_by": user_id},
        overwrite=False
    )

    # Azure Defender scans automatically on upload
    # If malware detected, blob is quarantined and upload fails

    return blob_client.url
```

**Security Considerations**:
- Enable Azure Defender for Storage ($0.02/GB scanned)
- Configure malware scanning to quarantine infected files
- Set blob access to private (require SAS tokens for read access)
- Validate file MIME type + magic bytes (not just extension)
- Enforce 5MB max file size at FastAPI endpoint + frontend
- Use SAS tokens with 1-hour expiry for temporary read access

**Best Practices**:
- Store blob URL in database (not file bytes)
- Use container per resource type (ticket-images, event-logos, etc.)
- Enable soft delete (30-day retention for accidental deletions)
- Tag blobs with event_id for cost tracking and cleanup

### 3. Real-Time Sales Count Updates (Polling vs WebSockets)

**Decision**: Polling with 3-second intervals (HTTP GET requests)

**Rationale**:
- **Simplicity**: No WebSocket infrastructure needed, uses existing REST API
- **Constitution Compliance**: 3-second update requirement is non-critical (SC-004), constitution allows >500ms for non-critical updates
- **Predictable Load**: Fixed request rate vs unpredictable WebSocket message bursts
- **Stateless**: No server-side connection state, easier to scale horizontally
- **Debugging**: Standard HTTP requests, visible in network tab, easier to troubleshoot
- **Redis Caching**: Sales counts cached in Redis (5-second TTL), minimal DB load

**Alternatives Considered**:
- **WebSockets (Socket.IO)**: Overkill for 3-second updates, requires persistent connections, more infrastructure complexity
- **Server-Sent Events (SSE)**: One-way only, still requires connection management, limited browser support in Safari
- **GraphQL Subscriptions**: Would require GraphQL server setup (not in constitution stack)

**Implementation (Frontend)**:
```typescript
// Custom hook for polling sales counts
export function useRealTimeSales(eventId: string, packageIds: string[]) {
  const [salesCounts, setSalesCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchSales = async () => {
      const response = await api.get(`/admin/events/${eventId}/tickets/sales`);
      setSalesCounts(response.data.counts);
    };

    // Initial fetch
    fetchSales();

    // Poll every 3 seconds
    const interval = setInterval(fetchSales, 3000);

    return () => clearInterval(interval);
  }, [eventId, packageIds]);

  return salesCounts;
}
```

**Backend Caching**:
```python
@router.get("/admin/events/{event_id}/tickets/sales")
async def get_sales_counts(
    event_id: str,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    user: User = Depends(require_role("event_coordinator"))
):
    """Get real-time sales counts for all ticket packages in an event."""
    cache_key = f"sales:event:{event_id}"

    # Check Redis cache (5-second TTL)
    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)

    # Query database if cache miss
    result = await db.execute(
        select(TicketPurchase.package_id, func.count(TicketPurchase.id))
        .where(TicketPurchase.event_id == event_id)
        .group_by(TicketPurchase.package_id)
    )
    counts = {str(pkg_id): count for pkg_id, count in result.all()}

    # Cache for 5 seconds
    await redis.setex(cache_key, 5, json.dumps(counts))

    return {"counts": counts}
```

**Performance Considerations**:
- Redis cache reduces DB queries to 1 every 5 seconds per event
- Invalidate cache on ticket purchase (FR-060)
- Use HTTP 304 Not Modified for unchanged data (ETag header)
- Batch fetch all packages in single request (not per-package)

### 4. Optimistic Locking Strategy (Concurrency Control)

**Decision**: SQLAlchemy version column with automatic retry logic

**Rationale**:
- **Built-In Support**: SQLAlchemy 2.0 has native `version_id_col` for optimistic locking
- **Database-Agnostic**: Works with PostgreSQL, MySQL, SQLite (portable solution)
- **Low Overhead**: No pessimistic locks, no row-level locking, scales horizontally
- **Constitution Compliance**: Handles 100+ concurrent coordinators without degradation
- **Race Condition Protection**: Prevents lost updates for quantity limits (FR-019) and promo code usage (FR-046)

**Alternatives Considered**:
- **Pessimistic Locking (SELECT FOR UPDATE)**: Blocks concurrent transactions, reduces throughput, risk of deadlocks
- **Database Constraints**: CHECK constraints only enforce at insert/update, don't handle race conditions between read and write
- **Redis Distributed Lock (Redlock)**: Adds network latency, requires lock expiry tuning, risk of lock leakage

**Implementation**:
```python
from sqlalchemy import Column, Integer, String, DateTime, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column

class TicketPackage(Base):
    __tablename__ = "ticket_packages"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True)
    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("events.id"))
    name: Mapped[str] = mapped_column(String(100))
    quantity_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sold_count: Mapped[int] = mapped_column(Integer, default=0)

    # Optimistic locking version column
    version: Mapped[int] = mapped_column(Integer, default=1, version_id_col=True)

    __table_args__ = (
        CheckConstraint("sold_count >= 0", name="sold_count_non_negative"),
        CheckConstraint("quantity_limit IS NULL OR quantity_limit >= 0", name="quantity_limit_non_negative"),
    )
```

**Service Layer with Retry Logic**:
```python
from sqlalchemy.exc import StaleDataError

async def purchase_tickets(
    package_id: uuid.UUID,
    quantity: int,
    db: AsyncSession,
    max_retries: int = 3
) -> TicketPurchase:
    """Purchase tickets with optimistic locking and retry logic."""
    for attempt in range(max_retries):
        try:
            # Load package (includes version column)
            package = await db.get(TicketPackage, package_id)

            # Check availability
            if package.quantity_limit is not None:
                if package.sold_count + quantity > package.quantity_limit:
                    raise SoldOutError("Ticket package sold out")

            # Increment sold count (version increments automatically)
            package.sold_count += quantity

            # Create purchase record
            purchase = TicketPurchase(
                package_id=package_id,
                quantity=quantity,
                ...
            )
            db.add(purchase)

            # Commit (fails with StaleDataError if version mismatch)
            await db.commit()
            return purchase

        except StaleDataError:
            await db.rollback()
            if attempt == max_retries - 1:
                raise ConcurrencyError("Too many concurrent purchases, try again")
            await asyncio.sleep(0.1 * (2 ** attempt))  # Exponential backoff

    raise ConcurrencyError("Purchase failed after retries")
```

**Best Practices**:
- Always include version column in SELECT queries
- Retry up to 3 times with exponential backoff (100ms, 200ms, 400ms)
- Return 409 Conflict to client on final retry failure (clear error message)
- Log concurrency conflicts for monitoring (track high contention packages)
- Use database CHECK constraints as secondary validation (belt-and-suspenders)

### 5. Audit Logging Strategy (Change Tracking)

**Decision**: Separate audit_logs table with triggers for immutability

**Rationale**:
- **Constitution Requirement**: Immutable audit trail with 7-year retention (constitution: transaction records 7 years)
- **Separation of Concerns**: Audit logs separate from application tables (prevents accidental modifications)
- **Query Performance**: No impact on ticket_packages table reads (audit logs queried separately)
- **Compliance**: Supports GDPR right-to-access, SOC 2 audit requirements
- **Immutability**: PostgreSQL triggers prevent UPDATE/DELETE on audit logs

**Alternatives Considered**:
- **Event Sourcing**: Overkill for ticket management, requires full CQRS architecture, complex replays
- **JSON Column in ticket_packages**: Makes queries slow, hard to index, violates normalization
- **Application-Level Logging**: Can be bypassed by direct DB access, not auditable

**Implementation**:
```python
class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid4)
    entity_type: Mapped[str] = mapped_column(String(50))  # "ticket_package", "promo_code", etc.
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID)
    action: Mapped[str] = mapped_column(String(20))  # "created", "updated", "deleted"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    field_name: Mapped[str | None] = mapped_column(String(50), nullable=True)  # For updates only
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("idx_audit_entity", "entity_type", "entity_id"),
        Index("idx_audit_user", "user_id"),
        Index("idx_audit_timestamp", "timestamp"),
    )
```

**PostgreSQL Trigger for Immutability**:
```sql
-- Prevent modifications to audit logs
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_immutable
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();
```

**Service Layer Integration**:
```python
async def update_ticket_package(
    package_id: uuid.UUID,
    updates: TicketPackageUpdate,
    db: AsyncSession,
    user: User
) -> TicketPackage:
    """Update ticket package with automatic audit logging."""
    package = await db.get(TicketPackage, package_id)

    # Check if package has sold tickets (FR-002)
    if package.sold_count > 0:
        # Log all changes for audit trail (FR-064-068)
        for field, new_value in updates.dict(exclude_unset=True).items():
            old_value = getattr(package, field)
            if old_value != new_value:
                audit_entry = AuditLog(
                    entity_type="ticket_package",
                    entity_id=package_id,
                    action="updated",
                    user_id=user.id,
                    field_name=field,
                    old_value=str(old_value),
                    new_value=str(new_value)
                )
                db.add(audit_entry)

    # Apply updates
    for field, value in updates.dict(exclude_unset=True).items():
        setattr(package, field, value)

    await db.commit()
    return package
```

**Best Practices**:
- Log all changes after first sale (FR-002)
- Store old_value and new_value as strings (handles any data type)
- Index on (entity_type, entity_id) for fast lookup
- Display audit trail in admin UI (FR-066)
- Warn coordinators before editing sold packages (FR-003)
- Set PostgreSQL trigger for immutability (prevents accidental deletes)

### 6. Promo Code Validation Strategy (Performance)

**Decision**: Redis caching + database validation with TTL

**Rationale**:
- **Performance**: Redis lookup <5ms vs PostgreSQL query ~20-50ms
- **Accuracy**: Cache-aside pattern with short TTL (60 seconds) ensures fresh data
- **Concurrency**: Optimistic locking in database prevents over-redemption
- **Constitution**: Meets <300ms p95 API latency requirement
- **Scalability**: Reduces DB load for high-traffic events (100+ concurrent purchases)

**Alternatives Considered**:
- **Database Only**: Slower (20-50ms per query), more load on PostgreSQL
- **Redis Only**: Risk of cache/DB inconsistency, harder to debug
- **GraphQL DataLoader**: Would require GraphQL setup (not in constitution stack)

**Implementation**:
```python
async def validate_promo_code(
    code: str,
    event_id: uuid.UUID,
    user_id: uuid.UUID,
    redis: Redis,
    db: AsyncSession
) -> PromoCode:
    """Validate promo code with Redis caching."""
    cache_key = f"promo:{event_id}:{code}"

    # Check Redis cache (60-second TTL)
    cached = await redis.get(cache_key)
    if cached:
        promo_data = json.loads(cached)
        promo = PromoCode(**promo_data)
    else:
        # Query database if cache miss
        result = await db.execute(
            select(PromoCode)
            .where(PromoCode.code == code, PromoCode.event_id == event_id)
        )
        promo = result.scalar_one_or_none()
        if not promo:
            raise PromoCodeNotFoundError("Invalid promo code")

        # Cache for 60 seconds
        await redis.setex(cache_key, 60, json.dumps(promo.to_dict()))

    # Validate expiration (FR-044)
    if promo.expires_at and datetime.now(UTC) > promo.expires_at:
        raise PromoCodeExpiredError("Promo code expired")

    # Validate usage limits (FR-042-043) - always check database for accuracy
    if promo.max_total_uses:
        total_uses = await db.scalar(
            select(func.count(PromoCodeApplication.id))
            .where(PromoCodeApplication.promo_code_id == promo.id)
        )
        if total_uses >= promo.max_total_uses:
            raise PromoCodeMaxUsesError("Promo code usage limit reached")

    if promo.max_uses_per_donor:
        user_uses = await db.scalar(
            select(func.count(PromoCodeApplication.id))
            .where(
                PromoCodeApplication.promo_code_id == promo.id,
                PromoCodeApplication.user_id == user_id
            )
        )
        if user_uses >= promo.max_uses_per_donor:
            raise PromoCodeMaxUsesPerDonorError("You have already used this promo code")

    return promo
```

**Best Practices**:
- Cache promo code metadata (discount, limits) with 60-second TTL
- Always query database for usage counts (prevent over-redemption)
- Invalidate cache on promo code update/deletion
- Return clear error messages for expired/maxed codes (FR-048-051)
- Use optimistic locking on PromoCodeApplication insert (handle concurrency)

### 7. CSV Export Strategy (Sales Data)

**Decision**: Streaming CSV export with pandas + FastAPI StreamingResponse

**Rationale**:
- **Memory Efficient**: Streams rows instead of loading all data into memory
- **Large Datasets**: Handles 10,000+ ticket purchases without timeout
- **Fast Export**: pandas.to_csv() is optimized C code, faster than manual CSV building
- **Excel Compatible**: Proper quoting, UTF-8 BOM for international characters
- **Constitution**: Uses existing pandas dependency (in backend/pyproject.toml)

**Alternatives Considered**:
- **csv.DictWriter**: Slower for large datasets, more boilerplate code
- **Background Task (Celery)**: Overkill for <10 second exports, adds complexity
- **Pre-Generated Reports**: Stale data, requires scheduled jobs, more storage

**Implementation**:
```python
from fastapi.responses import StreamingResponse
import pandas as pd
from io import BytesIO

@router.get("/admin/events/{event_id}/tickets/export")
async def export_sales_data(
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("event_coordinator"))
):
    """Export ticket sales data as CSV."""
    # Query sales data with joins
    result = await db.execute(
        select(
            TicketPurchase.id,
            TicketPackage.name.label("package_name"),
            TicketPurchase.quantity,
            TicketPurchase.price_paid,
            PromoCode.code.label("promo_code"),
            TicketPurchase.created_at,
            User.email.label("purchaser_email")
        )
        .join(TicketPackage, TicketPurchase.package_id == TicketPackage.id)
        .outerjoin(PromoCodeApplication, TicketPurchase.id == PromoCodeApplication.purchase_id)
        .outerjoin(PromoCode, PromoCodeApplication.promo_code_id == PromoCode.id)
        .join(User, TicketPurchase.user_id == User.id)
        .where(TicketPurchase.event_id == event_id)
        .order_by(TicketPurchase.created_at.desc())
    )

    # Convert to DataFrame
    df = pd.DataFrame(result.all(), columns=result.keys())

    # Format currency and dates
    df['price_paid'] = df['price_paid'].apply(lambda x: f"${x:.2f}")
    df['created_at'] = df['created_at'].dt.strftime('%Y-%m-%d %H:%M:%S')

    # Export to CSV with UTF-8 BOM (Excel compatibility)
    buffer = BytesIO()
    df.to_csv(buffer, index=False, encoding='utf-8-sig')
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=ticket-sales-{event_id}.csv"
        }
    )
```

**Best Practices**:
- Include all relevant fields: package name, quantity, price, promo code, purchaser email, date
- Format currency as $XX.XX (not raw decimals)
- Format dates as YYYY-MM-DD HH:MM:SS (sortable, unambiguous)
- Use UTF-8 with BOM for Excel compatibility (handles international characters)
- Order by created_at DESC (most recent first)
- Limit to 10,000 rows (add pagination parameter if needed)

## Summary

All technical unknowns resolved. Key decisions:
1. **dnd-kit** for drag-and-drop (accessibility, performance, React 18 support)
2. **Azure Blob Storage + Defender** for image uploads with virus scanning
3. **Polling (3-second intervals)** for real-time sales updates with Redis caching
4. **Optimistic locking** with SQLAlchemy version columns for concurrency control
5. **Separate audit_logs table** with PostgreSQL triggers for immutability
6. **Redis caching + database validation** for promo code performance
7. **Streaming CSV export** with pandas for memory efficiency

No additional research required. Ready to proceed to Phase 1 (data models and contracts).
