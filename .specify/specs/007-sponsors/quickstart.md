# Developer Quickstart: Event Sponsors

**Feature**: 007-sponsors
**Date**: 2025-11-12

## Overview

This quickstart guide provides practical examples for implementing and using the event sponsors feature. It covers backend API usage, frontend component integration, and common workflows.

## Quick Start

### 1. Run Database Migration

```bash
cd backend
poetry run alembic upgrade head
```

### 2. Start Development Servers

```bash
# Terminal 1: Backend
make dev-backend

# Terminal 2: Frontend
make dev-frontend
```

### 3. Navigate to Sponsors Tab

Open `http://localhost:5173` → Login → Events → Select Event → **Sponsors** tab

---

## Backend API Usage

### Example 1: Create Sponsor (Two-Step Process)

**Step 1: Create sponsor record and get upload URL**

```bash
curl -X POST http://localhost:8000/api/v1/events/EVENT_UUID/sponsors \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corporation",
    "logo_file_name": "acme-logo.png",
    "logo_file_type": "image/png",
    "logo_file_size": 204800,
    "website_url": "https://acme.com",
    "logo_size": "large",
    "sponsor_level": "Platinum",
    "contact_name": "John Doe",
    "contact_email": "john@acme.com",
    "contact_phone": "+1-555-0123",
    "donation_amount": 10000.00
  }'
```

**Response**:

```json
{
  "sponsor": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "event_id": "EVENT_UUID",
    "name": "Acme Corporation",
    "logo_url": "https://storage.blob.core.windows.net/sponsors/...",
    "thumbnail_url": "https://storage.blob.core.windows.net/sponsors/.../thumbnail-...",
    "website_url": "https://acme.com",
    "logo_size": "large",
    "sponsor_level": "Platinum",
    "contact_name": "John Doe",
    "contact_email": "john@acme.com",
    "contact_phone": "+1-555-0123",
    "donation_amount": 10000.00,
    "display_order": 0,
    "created_at": "2025-11-12T10:00:00Z",
    "updated_at": "2025-11-12T10:00:00Z",
    "created_by": "USER_UUID"
  },
  "upload_url": "https://storage.blob.core.windows.net/sponsors/...?sas_token...",
  "expires_at": "2025-11-12T11:00:00Z"
}
```

**Step 2: Upload logo to Azure Blob Storage**

```bash
curl -X PUT "UPLOAD_URL_FROM_STEP_1" \
  -H "x-ms-blob-type: BlockBlob" \
  -H "Content-Type: image/png" \
  --data-binary @acme-logo.png
```

**Step 3: Confirm upload (triggers thumbnail generation)**

```bash
curl -X POST http://localhost:8000/api/v1/events/EVENT_UUID/sponsors/SPONSOR_UUID/logo/confirm \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response** (with thumbnail URLs):

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "thumbnail_url": "https://storage.blob.core.windows.net/.../thumbnail-acme-logo.png?sas...",
  ...
}
```

---

### Example 2: List Sponsors for Event

```bash
curl http://localhost:8000/api/v1/events/EVENT_UUID/sponsors \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response**:

```json
[
  {
    "id": "sponsor-uuid-1",
    "name": "Platinum Sponsor",
    "logo_size": "xlarge",
    "display_order": 0,
    ...
  },
  {
    "id": "sponsor-uuid-2",
    "name": "Gold Sponsor",
    "logo_size": "large",
    "display_order": 1,
    ...
  }
]
```

---

### Example 3: Update Sponsor

```bash
curl -X PATCH http://localhost:8000/api/v1/events/EVENT_UUID/sponsors/SPONSOR_UUID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sponsor_level": "Gold",
    "logo_size": "medium",
    "donation_amount": 5000.00
  }'
```

---

### Example 4: Delete Sponsor

```bash
curl -X DELETE http://localhost:8000/api/v1/events/EVENT_UUID/sponsors/SPONSOR_UUID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response**: `204 No Content` (logo and thumbnail deleted from Azure Blob)

---

### Example 5: Reorder Sponsors

```bash
curl -X PATCH http://localhost:8000/api/v1/events/EVENT_UUID/sponsors/reorder \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sponsor_ids": [
      "sponsor-uuid-3",
      "sponsor-uuid-1",
      "sponsor-uuid-2"
    ]
  }'
```

**Effect**: sponsor-uuid-3 → display_order=0, sponsor-uuid-1 → display_order=1, sponsor-uuid-2 → display_order=2

---

## Frontend Component Usage

### Example 1: SponsorsTab Component

```tsx
// Import in EventDetail.tsx
import { SponsorsTab } from '@/features/events/components/SponsorsTab';

// Add to tabs array
const tabs = [
  { id: 'overview', label: 'Overview', component: <OverviewTab /> },
  { id: 'media', label: 'Media', component: <MediaTab /> },
  { id: 'sponsors', label: 'Sponsors', component: <SponsorsTab eventId={event.id} /> },
];
```

### Example 2: Creating a Sponsor (Frontend)

```tsx
import { useSponsors } from '@/features/events/hooks/useSponsors';
import { SponsorForm } from '@/features/events/components/SponsorForm';

function AddSponsorButton({ eventId }: { eventId: string }) {
  const { createSponsor } = useSponsors(eventId);
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = async (data: SponsorCreateRequest) => {
    await createSponsor(data);
    setIsOpen(false);
    toast.success('Sponsor added successfully');
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        <Plus className="mr-2" /> Add Sponsor
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Sponsor</DialogTitle>
          </DialogHeader>
          <SponsorForm onSubmit={handleSubmit} onCancel={() => setIsOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
```

### Example 3: Displaying Sponsor List

```tsx
import { SponsorList } from '@/features/events/components/SponsorList';

function SponsorsTab({ eventId }: { eventId: string }) {
  const { sponsors, isLoading, deleteSponsor } = useSponsors(eventId);

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Event Sponsors</h2>
        <AddSponsorButton eventId={eventId} />
      </div>

      <SponsorList
        sponsors={sponsors}
        onDelete={deleteSponsor}
        onEdit={(sponsor) => setEditingSponsor(sponsor)}
      />
    </div>
  );
}
```

### Example 4: SponsorCard Component

```tsx
import { Sponsor, LogoSize } from '@/types/sponsor';
import { ExternalLink, Pencil, Trash2 } from 'lucide-react';

interface SponsorCardProps {
  sponsor: Sponsor;
  onEdit: () => void;
  onDelete: () => void;
}

const logoSizeClasses = {
  xsmall: 'w-16 h-16',
  small: 'w-24 h-24',
  medium: 'w-32 h-32',
  large: 'w-48 h-48',
  xlarge: 'w-64 h-64',
};

export function SponsorCard({ sponsor, onEdit, onDelete }: SponsorCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          {/* Logo with optional website link */}
          {sponsor.website_url ? (
            <a
              href={sponsor.website_url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Visit ${sponsor.name} website`}
            >
              <img
                src={sponsor.thumbnail_url}
                alt={`${sponsor.name} logo`}
                className={`object-contain ${logoSizeClasses[sponsor.logo_size]}`}
                loading="lazy"
              />
            </a>
          ) : (
            <img
              src={sponsor.thumbnail_url}
              alt={`${sponsor.name} logo`}
              className={`object-contain ${logoSizeClasses[sponsor.logo_size]}`}
              loading="lazy"
            />
          )}

          <div>
            <h3 className="text-lg font-semibold">{sponsor.name}</h3>
            {sponsor.sponsor_level && (
              <Badge variant="secondary">{sponsor.sponsor_level}</Badge>
            )}
            {sponsor.website_url && (
              <a
                href={sponsor.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              >
                Visit Website <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-600">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {sponsor.donation_amount && (
        <div className="mt-4 text-sm text-gray-600">
          Donation: ${sponsor.donation_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </div>
      )}
    </Card>
  );
}
```

### Example 5: Drag-and-Drop Reordering

```tsx
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

function ReorderableSponsorslist({ sponsors, onReorder }) {
  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const reorderedSponsors = Array.from(sponsors);
    const [removed] = reorderedSponsors.splice(result.source.index, 1);
    reorderedSponsors.splice(result.destination.index, 0, removed);

    const sponsorIds = reorderedSponsors.map(s => s.id);
    onReorder(sponsorIds);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="sponsors">
        {(provided) => (
          <div {...provided.droppableProps} ref={provided.innerRef}>
            {sponsors.map((sponsor, index) => (
              <Draggable key={sponsor.id} draggableId={sponsor.id} index={index}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                  >
                    <SponsorCard sponsor={sponsor} />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
```

---

## Backend Service Usage

### Example: SponsorService

```python
from app.services.sponsor_service import SponsorService
from app.schemas.sponsor import SponsorCreateRequest

async def create_sponsor_example(db: AsyncSession, event_id: uuid.UUID, current_user: User):
    """Example of creating a sponsor with logo upload."""

    # Step 1: Create sponsor record and get upload URL
    create_data = SponsorCreateRequest(
        name="Acme Corporation",
        logo_file_name="acme-logo.png",
        logo_file_type="image/png",
        logo_file_size=204800,
        website_url="https://acme.com",
        logo_size="large",
        sponsor_level="Platinum",
        donation_amount=Decimal("10000.00")
    )

    sponsor, upload_url, expires_at = await SponsorService.create_sponsor(
        db=db,
        event_id=event_id,
        data=create_data,
        current_user=current_user
    )

    # Step 2: Return upload URL to frontend for client-side upload
    # (Frontend uploads logo to Azure Blob using upload_url)

    # Step 3: Confirm upload (called by frontend after successful upload)
    updated_sponsor = await SponsorService.confirm_logo_upload(
        db=db,
        sponsor_id=sponsor.id
    )

    # Thumbnail is now generated at updated_sponsor.thumbnail_url
    return updated_sponsor
```

---

## Testing Examples

### Backend Test: Create Sponsor

```python
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_create_sponsor(async_client: AsyncClient, auth_headers: dict, test_event: Event):
    """Test creating a sponsor with valid data."""
    response = await async_client.post(
        f"/api/v1/events/{test_event.id}/sponsors",
        headers=auth_headers,
        json={
            "name": "Test Sponsor",
            "logo_file_name": "logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 100000,
            "logo_size": "large",
            "sponsor_level": "Gold",
        }
    )

    assert response.status_code == 201
    data = response.json()
    assert data["sponsor"]["name"] == "Test Sponsor"
    assert "upload_url" in data
    assert "expires_at" in data
```

### Backend Test: Validation

```python
@pytest.mark.asyncio
async def test_create_sponsor_oversized_logo(async_client: AsyncClient, auth_headers: dict, test_event: Event):
    """Test that oversized logos are rejected."""
    response = await async_client.post(
        f"/api/v1/events/{test_event.id}/sponsors",
        headers=auth_headers,
        json={
            "name": "Test Sponsor",
            "logo_file_name": "huge-logo.png",
            "logo_file_type": "image/png",
            "logo_file_size": 10_000_000,  # 10MB, exceeds 5MB limit
        }
    )

    assert response.status_code == 413
    assert "exceeds limit" in response.json()["detail"]
```

### Frontend Test: SponsorCard

```tsx
import { render, screen } from '@testing-library/react';
import { SponsorCard } from '@/features/events/components/SponsorCard';

test('renders sponsor with website link', () => {
  const sponsor = {
    id: '123',
    name: 'Acme Corp',
    thumbnail_url: '/logo.png',
    website_url: 'https://acme.com',
    logo_size: 'large',
    sponsor_level: 'Platinum',
  };

  render(<SponsorCard sponsor={sponsor} onEdit={jest.fn()} onDelete={jest.fn()} />);

  expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  expect(screen.getByText('Platinum')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /visit website/i })).toHaveAttribute('href', 'https://acme.com');
});
```

---

## Common Workflows

### Workflow 1: Add Sponsor with Logo

1. User clicks "Add Sponsor" button
2. Form opens with name, logo upload, and optional fields
3. User fills name, selects logo file (validated: <5MB, PNG/JPG/SVG)
4. On submit:
   - Frontend calls POST /sponsors with file metadata
   - Backend returns upload URL and sponsor record
   - Frontend uploads logo to Azure Blob using upload URL
   - Frontend calls POST /sponsors/{id}/logo/confirm
   - Backend generates thumbnail, updates URLs
5. Sponsor appears in list with thumbnail

### Workflow 2: Edit Sponsor

1. User clicks edit icon on sponsor card
2. Form opens pre-filled with sponsor data
3. User updates fields (e.g., change tier from Gold → Platinum)
4. Optional: User uploads new logo (replaces old one)
5. On submit:
   - Frontend calls PATCH /sponsors/{id}
   - If logo changed: Repeat logo upload workflow
   - Backend updates sponsor record
6. Updated sponsor displayed in list

### Workflow 3: Reorder Sponsors

1. User drags sponsor card in list
2. Frontend updates local state optimistically
3. On drop:
   - Frontend calls PATCH /sponsors/reorder with new order
   - Backend updates display_order fields
4. List remains in new order

### Workflow 4: Delete Sponsor

1. User clicks delete icon
2. Confirmation dialog appears
3. On confirm:
   - Frontend calls DELETE /sponsors/{id}
   - Backend deletes sponsor record
   - Backend deletes logo and thumbnail from Azure Blob
4. Sponsor removed from list

---

## Environment Setup

### Required Environment Variables

```bash
# Azure Blob Storage (already configured for EventMedia)
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;...
AZURE_STORAGE_ACCOUNT_NAME=your-storage-account
AZURE_STORAGE_CONTAINER_NAME=event-media  # Reuse existing container

# Database (already configured)
DATABASE_URL=postgresql+asyncpg://user:pass@localhost/fundrbolt
```

### Development Setup

1. **Backend**:

   ```bash
   cd backend
   poetry install
   poetry run alembic upgrade head
   poetry run uvicorn app.main:app --reload
   ```

2. **Frontend**:

   ```bash
   cd frontend/fundrbolt-admin
   pnpm install
   pnpm dev
   ```

3. **Database**:

   ```bash
   docker-compose up -d postgres redis
   ```

---

## Troubleshooting

### Issue: Logo upload fails with 403 Forbidden

**Cause**: SAS token expired or invalid

**Solution**: Regenerate upload URL (tokens expire after 1 hour)

### Issue: Thumbnail not generated

**Cause**: Logo upload not confirmed or Pillow missing

**Solution**:

- Ensure POST /logo/confirm is called after upload
- Verify Pillow installed: `poetry show pillow`

### Issue: Sponsor list not updating after create

**Cause**: Zustand store cache not invalidated

**Solution**: Call `refetchSponsors()` after create/update/delete

### Issue: Drag-and-drop not working

**Cause**: react-beautiful-dnd not installed

**Solution**: `pnpm add react-beautiful-dnd @types/react-beautiful-dnd`

---

## Performance Tips

1. **Lazy load sponsor logos**: Use `loading="lazy"` on `<img>` tags
2. **Cache sponsor list**: Store in Zustand with 5-minute TTL
3. **Thumbnail usage**: Always use thumbnail_url for list views, logo_url only for detail views
4. **Optimistic UI**: Update local state immediately on reorder, rollback on error
5. **Pagination**: If >50 sponsors, implement cursor pagination

---

## Next Steps

1. Implement `/speckit.tasks` to generate implementation tasks
2. Create backend models, services, and API endpoints
3. Create frontend components and hooks
4. Write unit and integration tests
5. Run migration and deploy to dev environment

---

## References

- API Contract: `contracts/sponsors.openapi.yaml`
- Data Model: `data-model.md`
- Research: `research.md`
- Feature Spec: `spec.md`
