# Quickstart Guide: Donor PWA Event Homepage

**Feature**: 011-donor-pwa-event
**Estimated Time**: 3-4 days
**Prerequisite Skills**: React, TypeScript, FastAPI, SQLAlchemy

## Overview

This feature transforms the donor PWA event page into an immersive, event-branded homepage. The implementation is divided into logical phases that can be completed incrementally.

## Phase 1: Backend API (Day 1)

### Step 1.1: Create Pydantic Schemas

Create new response schemas in `backend/app/schemas/event_with_branding.py`:

```python
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class RegisteredEventWithBranding(BaseModel):
    """Event with resolved branding for donor PWA."""

    id: UUID
    name: str
    slug: str
    event_datetime: datetime
    timezone: str
    is_past: bool
    is_upcoming: bool
    thumbnail_url: str | None = None
    primary_color: str = Field(default="#3B82F6")
    secondary_color: str = Field(default="#9333EA")
    background_color: str = Field(default="#FFFFFF")
    accent_color: str = Field(default="#3B82F6")
    npo_name: str
    npo_logo_url: str | None = None

    class Config:
        from_attributes = True


class RegisteredEventsResponse(BaseModel):
    """List of events user is registered for."""

    events: list[RegisteredEventWithBranding]
```

### Step 1.2: Add API Endpoint

Add new endpoint in `backend/app/api/v1/registrations.py`:

```python
@router.get("/events-with-branding", response_model=RegisteredEventsResponse)
async def get_registered_events_with_branding(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> RegisteredEventsResponse:
    """
    Get all registered events with resolved branding.

    Returns events sorted: upcoming first (by date ASC), then past (by date DESC).
    Branding colors resolve: event → NPO → system defaults.
    """
    events = await EventRegistrationService.get_registered_events_with_branding(
        db, current_user.id
    )
    return RegisteredEventsResponse(events=events)
```

### Step 1.3: Implement Service Method

Add to `backend/app/services/event_registration_service.py`:

```python
@staticmethod
async def get_registered_events_with_branding(
    db: AsyncSession, user_id: uuid.UUID
) -> list[RegisteredEventWithBranding]:
    """Get registered events with resolved branding."""
    from datetime import timedelta
    from app.models.npo_branding import NPOBranding
    from app.models.event import EventMedia

    # Query registrations with event, NPO, and branding
    stmt = (
        select(EventRegistration)
        .options(
            selectinload(EventRegistration.event)
            .selectinload(Event.npo)
            .selectinload(NPO.branding),
            selectinload(EventRegistration.event)
            .selectinload(Event.media)
        )
        .where(
            EventRegistration.user_id == user_id,
            EventRegistration.status.in_(['pending', 'confirmed'])
        )
    )

    result = await db.execute(stmt)
    registrations = result.scalars().all()

    now = datetime.utcnow()
    thirty_days = now + timedelta(days=30)

    events = []
    for reg in registrations:
        event = reg.event
        npo = event.npo
        npo_branding = npo.branding if npo else None

        # Resolve thumbnail: event media → NPO logo
        thumbnail_url = None
        if event.media:
            primary_media = sorted(event.media, key=lambda m: m.display_order)[0]
            thumbnail_url = primary_media.file_url
        elif npo_branding:
            thumbnail_url = npo_branding.logo_url

        # Resolve colors: event → NPO → defaults
        events.append(RegisteredEventWithBranding(
            id=event.id,
            name=event.name,
            slug=event.slug,
            event_datetime=event.event_datetime,
            timezone=event.timezone or "UTC",
            is_past=event.event_datetime < now,
            is_upcoming=now <= event.event_datetime <= thirty_days,
            thumbnail_url=thumbnail_url,
            primary_color=event.primary_color or (npo_branding.primary_color if npo_branding else None) or "#3B82F6",
            secondary_color=event.secondary_color or (npo_branding.secondary_color if npo_branding else None) or "#9333EA",
            background_color=event.background_color or (npo_branding.background_color if npo_branding else None) or "#FFFFFF",
            accent_color=event.accent_color or (npo_branding.accent_color if npo_branding else None) or "#3B82F6",
            npo_name=npo.name if npo else "Unknown Organization",
            npo_logo_url=npo_branding.logo_url if npo_branding else None,
        ))

    # Sort: upcoming first (date ASC), then past (date DESC)
    upcoming = sorted([e for e in events if not e.is_past], key=lambda e: e.event_datetime)
    past = sorted([e for e in events if e.is_past], key=lambda e: e.event_datetime, reverse=True)

    return upcoming + past
```

### Step 1.4: Write Tests

Create `backend/app/tests/api/test_registrations_branding.py`:

```python
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def test_get_registered_events_with_branding_empty(
    authenticated_client: AsyncClient,
):
    """Test user with no registrations returns empty list."""
    response = await authenticated_client.get("/api/v1/registrations/events-with-branding")
    assert response.status_code == 200
    data = response.json()
    assert data["events"] == []


async def test_get_registered_events_with_branding_returns_event_colors(
    authenticated_client: AsyncClient,
    test_event_with_registration,
):
    """Test event colors are returned when set."""
    response = await authenticated_client.get("/api/v1/registrations/events-with-branding")
    assert response.status_code == 200
    data = response.json()
    assert len(data["events"]) == 1
    assert data["events"][0]["primary_color"] == test_event_with_registration.primary_color


async def test_get_registered_events_sorted_correctly(
    authenticated_client: AsyncClient,
    test_upcoming_event_registration,
    test_past_event_registration,
):
    """Test upcoming events come before past events."""
    response = await authenticated_client.get("/api/v1/registrations/events-with-branding")
    assert response.status_code == 200
    data = response.json()
    assert len(data["events"]) == 2
    assert data["events"][0]["is_past"] is False
    assert data["events"][1]["is_past"] is True
```

---

## Phase 2: Frontend Components (Day 2)

### Step 2.1: Create Countdown Hook

Create `frontend/donor-pwa/src/hooks/use-countdown.ts`:

```typescript
import { useState, useEffect } from 'react'

interface CountdownResult {
  days: number
  hours: number
  minutes: number
  seconds: number
  isExpired: boolean
  isWithin24Hours: boolean
}

export function useCountdown(targetDate: Date | string | null): CountdownResult {
  const [countdown, setCountdown] = useState<CountdownResult>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: true,
    isWithin24Hours: false,
  })

  useEffect(() => {
    if (!targetDate) return

    const target = typeof targetDate === 'string' ? new Date(targetDate) : targetDate

    const calculateCountdown = () => {
      const now = new Date()
      const diff = target.getTime() - now.getTime()

      if (diff <= 0) {
        setCountdown({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isExpired: true,
          isWithin24Hours: false,
        })
        return
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      setCountdown({
        days,
        hours,
        minutes,
        seconds,
        isExpired: false,
        isWithin24Hours: diff < 24 * 60 * 60 * 1000,
      })
    }

    calculateCountdown()
    const interval = setInterval(calculateCountdown, 1000)

    return () => clearInterval(interval)
  }, [targetDate])

  return countdown
}
```

### Step 2.2: Create Event Switcher Component

Create `frontend/donor-pwa/src/components/event-home/EventSwitcher.tsx`:

```typescript
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDown } from 'lucide-react'
import type { RegisteredEventWithBranding } from '@/types/event-branding'

interface EventSwitcherProps {
  currentEvent: RegisteredEventWithBranding
  events: RegisteredEventWithBranding[]
  onEventSelect: (event: RegisteredEventWithBranding) => void
}

export function EventSwitcher({ currentEvent, events, onEventSelect }: EventSwitcherProps) {
  const showDropdown = events.length > 1

  return (
    <div className="flex items-center gap-3">
      {/* Event thumbnail */}
      <div className="h-10 w-10 overflow-hidden rounded-lg bg-muted">
        {currentEvent.thumbnail_url ? (
          <img
            src={currentEvent.thumbnail_url}
            alt={currentEvent.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm font-bold text-muted-foreground">
            {currentEvent.name.charAt(0)}
          </div>
        )}
      </div>

      {/* Event name with optional dropdown */}
      {showDropdown ? (
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1 font-semibold hover:opacity-80">
            {currentEvent.name}
            <ChevronDown className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {events.map((event) => (
              <DropdownMenuItem
                key={event.id}
                onClick={() => onEventSelect(event)}
                className={event.id === currentEvent.id ? 'bg-accent' : ''}
              >
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 overflow-hidden rounded bg-muted">
                    {event.thumbnail_url ? (
                      <img
                        src={event.thumbnail_url}
                        alt={event.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs">
                        {event.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <span>{event.name}</span>
                  {event.is_past && (
                    <span className="text-xs text-muted-foreground">(Past)</span>
                  )}
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <span className="font-semibold">{currentEvent.name}</span>
      )}
    </div>
  )
}
```

### Step 2.3: Create Countdown Timer Component

Create `frontend/donor-pwa/src/components/event-home/CountdownTimer.tsx`:

```typescript
import { useCountdown } from '@/hooks/use-countdown'
import { cn } from '@/lib/utils'

interface CountdownTimerProps {
  targetDate: string
  className?: string
}

export function CountdownTimer({ targetDate, className }: CountdownTimerProps) {
  const { days, hours, minutes, seconds, isExpired, isWithin24Hours } = useCountdown(targetDate)

  if (isExpired) return null

  return (
    <div className={cn('text-center', className)}>
      <p className="text-sm text-muted-foreground mb-2">Event starts in</p>
      <div className={cn(
        'flex justify-center gap-2',
        isWithin24Hours && 'scale-110'
      )}>
        {days > 0 && (
          <TimeUnit value={days} label="days" />
        )}
        <TimeUnit value={hours} label="hrs" />
        <TimeUnit value={minutes} label="min" />
        <TimeUnit value={seconds} label="sec" />
      </div>
    </div>
  )
}

function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-2xl font-bold tabular-nums bg-primary/10 rounded px-2 py-1">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-xs text-muted-foreground mt-1">{label}</span>
    </div>
  )
}
```

---

## Phase 3: Auction Gallery (Day 3)

### Step 3.1: Create Auction Gallery Component

Create `frontend/donor-pwa/src/components/event-home/AuctionGallery.tsx`:

```typescript
import { useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useInView } from 'react-intersection-observer'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Gavel } from 'lucide-react'
import { auctionItemService } from '@/services/auctionItemService'
import { AuctionItemCard } from './AuctionItemCard'

interface AuctionGalleryProps {
  eventId: string
}

type AuctionFilter = 'all' | 'silent' | 'live'

export function AuctionGallery({ eventId }: AuctionGalleryProps) {
  const [filter, setFilter] = useState<AuctionFilter>('all')
  const { ref, inView } = useInView()

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['auction-items', eventId, filter],
    queryFn: ({ pageParam = 1 }) =>
      auctionItemService.listAuctionItems(eventId, {
        auctionType: filter === 'all' ? undefined : filter,
        page: pageParam,
        limit: 20,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.has_more ? lastPage.pagination.page + 1 : undefined,
    initialPageParam: 1,
  })

  // Trigger fetch when scroll reaches bottom
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])

  const items = data?.pages.flatMap((page) => page.items) ?? []

  return (
    <div className="space-y-4">
      {/* Filter Toggle */}
      <div className="flex justify-center">
        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={(value) => value && setFilter(value as AuctionFilter)}
        >
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          <ToggleGroupItem value="silent">Silent</ToggleGroupItem>
          <ToggleGroupItem value="live">Live</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Items Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <Gavel className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No auction items available yet</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <AuctionItemCard key={item.id} item={item} />
            ))}
          </div>

          {/* Infinite scroll trigger */}
          <div ref={ref} className="h-10">
            {isFetchingNextPage && (
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
```

### Step 3.2: Create Auction Item Card

Create `frontend/donor-pwa/src/components/event-home/AuctionItemCard.tsx`:

```typescript
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Link } from '@tanstack/react-router'
import type { AuctionItemGalleryItem } from '@/types/auction-item'

interface AuctionItemCardProps {
  item: AuctionItemGalleryItem
}

export function AuctionItemCard({ item }: AuctionItemCardProps) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

  const displayBid = item.current_bid ?? item.starting_bid
  const bidLabel = item.current_bid ? 'Current Bid' : 'Starting Bid'

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      {/* Image */}
      <div className="aspect-square bg-muted relative">
        {item.thumbnail_url ? (
          <img
            src={item.thumbnail_url}
            alt={item.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground">
            No Image
          </div>
        )}
        <Badge className="absolute top-2 right-2" variant="secondary">
          {item.auction_type}
        </Badge>
      </div>

      {/* Content */}
      <CardContent className="p-3 space-y-2">
        <h3 className="font-semibold text-sm line-clamp-2">{item.title}</h3>

        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{bidLabel}</p>
            <p className="font-bold text-lg text-primary">{formatCurrency(displayBid)}</p>
          </div>
          {item.bid_count > 0 && (
            <p className="text-xs text-muted-foreground">{item.bid_count} bids</p>
          )}
        </div>

        <Button asChild className="w-full" size="sm">
          <Link to="/events/$eventId/auction-items/$itemId" params={{
            eventId: item.event_id,
            itemId: item.id
          }}>
            Bid Now
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
```

---

## Phase 4: Main Event Homepage (Day 4)

### Step 4.1: Create Event Homepage Component

Create `frontend/donor-pwa/src/features/events/EventHomePage.tsx`:

```typescript
import { useEffect } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useEventBranding } from '@/hooks/use-event-branding'
import { EventSwitcher } from '@/components/event-home/EventSwitcher'
import { CountdownTimer } from '@/components/event-home/CountdownTimer'
import { EventDetails } from '@/components/event-home/EventDetails'
import { AuctionGallery } from '@/components/event-home/AuctionGallery'
import { getRegisteredEventsWithBranding, getEventBySlug } from '@/lib/api/events'

export function EventHomePage() {
  const { eventId } = useParams({ strict: false })
  const navigate = useNavigate()
  const { applyBranding } = useEventBranding()

  // Fetch registered events
  const { data: registeredEvents } = useQuery({
    queryKey: ['registered-events-branding'],
    queryFn: getRegisteredEventsWithBranding,
  })

  // Fetch current event details
  const { data: event, isLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => getEventBySlug(eventId!),
    enabled: !!eventId,
  })

  // Find current event in registered events for branding
  const currentEventBranding = registeredEvents?.events.find(e => e.id === eventId)

  // Apply branding when event changes
  useEffect(() => {
    if (currentEventBranding) {
      applyBranding({
        primary_color: currentEventBranding.primary_color,
        secondary_color: currentEventBranding.secondary_color,
        background_color: currentEventBranding.background_color,
        accent_color: currentEventBranding.accent_color,
      })
    }
  }, [currentEventBranding, applyBranding])

  const handleEventSelect = (selectedEvent: RegisteredEventWithBranding) => {
    navigate({ to: '/events/$eventId', params: { eventId: selectedEvent.id } })
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    )
  }

  if (!event) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Event not found</p>
      </div>
    )
  }

  const isPast = new Date(event.event_datetime) < new Date()

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: `var(--event-background, #ffffff)` }}
    >
      {/* Top Bar */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur px-4 py-3">
        {registeredEvents && currentEventBranding && (
          <EventSwitcher
            currentEvent={currentEventBranding}
            events={registeredEvents.events}
            onEventSelect={handleEventSelect}
          />
        )}
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Countdown Timer (future events only) */}
        {!isPast && (
          <CountdownTimer targetDate={event.event_datetime} />
        )}

        {/* Event Details (collapsible) */}
        <EventDetails event={event} defaultOpen={!isPast && currentEventBranding?.is_upcoming} />

        {/* Auction Gallery */}
        <section>
          <h2 className="text-xl font-bold mb-4">Auction Items</h2>
          <AuctionGallery eventId={event.id} />
        </section>
      </main>
    </div>
  )
}
```

### Step 4.2: Update Route

Update `frontend/donor-pwa/src/routes/_authenticated/events/$eventId/index.tsx`:

```typescript
import { EventHomePage } from '@/features/events/EventHomePage'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/events/$eventId/')({
  component: EventHomePage,
})
```

---

## Testing Checklist

### Backend Tests

- [ ] `test_get_registered_events_with_branding_empty` - No registrations returns empty
- [ ] `test_get_registered_events_with_branding_event_colors` - Event colors used when set
- [ ] `test_get_registered_events_with_branding_npo_fallback` - NPO colors used as fallback
- [ ] `test_get_registered_events_with_branding_sorted` - Upcoming before past

### Frontend Tests

- [ ] `CountdownTimer.test.tsx` - Renders countdown, hides when expired
- [ ] `EventSwitcher.test.tsx` - Dropdown shows for multiple events, hidden for single
- [ ] `AuctionGallery.test.tsx` - Infinite scroll loads more items
- [ ] `AuctionItemCard.test.tsx` - Displays bid amount, handles missing image

### E2E Tests (Playwright)

- [ ] Login → redirected to event homepage
- [ ] Event switcher changes event and branding
- [ ] Countdown timer updates in real-time
- [ ] Auction filter toggles work
- [ ] Infinite scroll loads more items

---

## Common Issues & Solutions

### Issue: Branding colors not applying

**Solution**: Ensure CSS variables are being set on `:root`. Check that `useEventBranding` hook is called and `applyBranding` is invoked after event data loads.

### Issue: Countdown shows wrong time

**Solution**: Ensure `event_datetime` is stored in UTC and the frontend converts to local timezone. Use `new Date(isoString)` which automatically handles timezone.

### Issue: Infinite scroll not triggering

**Solution**: Ensure `react-intersection-observer` is installed. Verify the trigger element (`ref`) is visible in the viewport. Check that `hasNextPage` is true.

### Issue: Auction items not showing images

**Solution**: Verify Azure Blob Storage SAS tokens are being generated. Check that `thumbnail_path` is populated in `auction_item_media` table.
