import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { listPublicEvents, type EventResponse } from '@/lib/api/events'
import { listPublicNPOs, type PublicNPOResponse } from '@/lib/api/npos'
import { eventApi } from '@/services/event-service'
import { npoApi } from '@/services/npo-service'
import { useAuthStore } from '@/stores/auth-store'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Building2, Calendar, ExternalLink, MapPin, Search } from 'lucide-react'
import { useDeferredValue, useState } from 'react'

type DirectoryOrganization = PublicNPOResponse
type DirectoryEvent = EventResponse

function formatEventDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatOrganizationLocation(npo: PublicNPOResponse) {
  const city = npo.address?.city?.trim()
  const state = npo.address?.state?.trim()
  const country = npo.address?.country?.trim()
  return [city, state, country].filter(Boolean).join(', ')
}

function formatEventLocation(event: EventResponse) {
  return [
    event.venue_name,
    [event.venue_city, event.venue_state].filter(Boolean).join(', '),
  ]
    .filter(Boolean)
    .join(' • ')
}

function OrganizationCards({ items }: { items: DirectoryOrganization[] }) {
  return (
    <div className='grid gap-4 lg:hidden'>
      {items.map((npo) => (
        <Card key={npo.id} className='overflow-hidden'>
          <CardHeader className='space-y-3'>
            <div className='flex items-start gap-3'>
              {npo.logo_url ? (
                <img
                  src={npo.logo_url}
                  alt=''
                  className='h-12 w-12 rounded-xl border object-cover'
                />
              ) : (
                <div className='bg-muted flex h-12 w-12 items-center justify-center rounded-xl'>
                  <Building2 className='text-muted-foreground h-5 w-5' />
                </div>
              )}
              <div className='min-w-0 flex-1'>
                <CardTitle className='truncate text-base'>{npo.name}</CardTitle>
                {npo.tagline && (
                  <CardDescription className='mt-1 line-clamp-2'>
                    {npo.tagline}
                  </CardDescription>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className='space-y-3'>
            {formatOrganizationLocation(npo) && (
              <p className='text-muted-foreground flex items-center gap-2 text-sm'>
                <MapPin className='h-4 w-4' />
                <span>{formatOrganizationLocation(npo)}</span>
              </p>
            )}
            {npo.description && (
              <p className='text-muted-foreground line-clamp-3 text-sm'>
                {npo.description}
              </p>
            )}
            <div className='flex flex-wrap gap-2'>
              {npo.website_url && (
                <Button asChild size='sm' variant='outline'>
                  <a href={npo.website_url} target='_blank' rel='noreferrer'>
                    Visit Site
                    <ExternalLink className='ml-2 h-4 w-4' />
                  </a>
                </Button>
              )}
              <Badge variant='secondary'>{npo.email}</Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function EventCards({
  items,
}: {
  items: DirectoryEvent[]
}) {
  return (
    <div className='grid gap-4 lg:hidden'>
      {items.map((event) => (
        <Card key={event.id} className='overflow-hidden'>
          <CardHeader className='space-y-3'>
            <div className='flex items-start gap-3'>
              {event.logo_url ? (
                <img
                  src={event.logo_url}
                  alt=''
                  className='h-12 w-12 rounded-xl border object-cover'
                />
              ) : (
                <div className='bg-muted flex h-12 w-12 items-center justify-center rounded-xl'>
                  <Calendar className='text-muted-foreground h-5 w-5' />
                </div>
              )}
              <div className='min-w-0 flex-1'>
                <CardTitle className='truncate text-base'>
                  {event.name}
                </CardTitle>
                <CardDescription className='mt-1'>
                  {event.npo_name || 'Organization'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className='space-y-3'>
            <p className='text-muted-foreground flex items-center gap-2 text-sm'>
              <Calendar className='h-4 w-4' />
              <span>{formatEventDate(event.event_datetime)}</span>
            </p>
            {formatEventLocation(event) && (
              <p className='text-muted-foreground flex items-center gap-2 text-sm'>
                <MapPin className='h-4 w-4' />
                <span>{formatEventLocation(event)}</span>
              </p>
            )}
            {event.tagline && (
              <p className='text-muted-foreground line-clamp-2 text-sm'>
                {event.tagline}
              </p>
            )}
            <Button asChild size='sm' variant='outline'>
              <Link to='/events/$slug' params={{ slug: event.slug }}>
                View Event
              </Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function OrganizationTable({ items }: { items: DirectoryOrganization[] }) {
  return (
    <div className='hidden overflow-hidden rounded-xl border lg:block'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Organization</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead className='text-right'>Website</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((npo) => (
            <TableRow key={npo.id}>
              <TableCell>
                <div className='flex items-center gap-3'>
                  {npo.logo_url ? (
                    <img
                      src={npo.logo_url}
                      alt=''
                      className='h-10 w-10 rounded-lg border object-cover'
                    />
                  ) : (
                    <div className='bg-muted flex h-10 w-10 items-center justify-center rounded-lg'>
                      <Building2 className='text-muted-foreground h-4 w-4' />
                    </div>
                  )}
                  <div className='min-w-0'>
                    <p className='truncate font-medium'>{npo.name}</p>
                    {npo.tagline && (
                      <p className='text-muted-foreground line-clamp-1 text-sm'>
                        {npo.tagline}
                      </p>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell className='text-muted-foreground'>
                {formatOrganizationLocation(npo) || 'No location listed'}
              </TableCell>
              <TableCell className='text-muted-foreground'>
                {npo.email}
              </TableCell>
              <TableCell className='text-right'>
                {npo.website_url ? (
                  <Button asChild size='sm' variant='ghost'>
                    <a href={npo.website_url} target='_blank' rel='noreferrer'>
                      Visit
                      <ExternalLink className='ml-2 h-4 w-4' />
                    </a>
                  </Button>
                ) : (
                  <span className='text-muted-foreground text-sm'>
                    No website
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function EventTable({
  items,
}: {
  items: DirectoryEvent[]
}) {
  return (
    <div className='hidden overflow-hidden rounded-xl border lg:block'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Event</TableHead>
            <TableHead>Organization</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Location</TableHead>
            <TableHead className='text-right'>Open</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((event) => (
            <TableRow key={event.id}>
              <TableCell>
                <div className='flex items-center gap-3'>
                  {event.logo_url ? (
                    <img
                      src={event.logo_url}
                      alt=''
                      className='h-10 w-10 rounded-lg border object-cover'
                    />
                  ) : (
                    <div className='bg-muted flex h-10 w-10 items-center justify-center rounded-lg'>
                      <Calendar className='text-muted-foreground h-4 w-4' />
                    </div>
                  )}
                  <div className='min-w-0'>
                    <p className='truncate font-medium'>{event.name}</p>
                    {event.tagline && (
                      <p className='text-muted-foreground line-clamp-1 text-sm'>
                        {event.tagline}
                      </p>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell className='text-muted-foreground'>
                {event.npo_name || 'Organization'}
              </TableCell>
              <TableCell className='text-muted-foreground'>
                {formatEventDate(event.event_datetime)}
              </TableCell>
              <TableCell className='text-muted-foreground'>
                {formatEventLocation(event) || 'No location listed'}
              </TableCell>
              <TableCell className='text-right'>
                <Button asChild size='sm' variant='ghost'>
                  <Link to='/events/$slug' params={{ slug: event.slug }}>
                    View
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function PublicDirectoryExplorer({
  title,
  description,
}: {
  title: string
  description: string
}) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const userRole = useAuthStore((state) => state.user?.role)
  const isDonor = userRole === 'donor'
  const isSuperAdmin = userRole === 'super_admin'
  const [tab, setTab] = useState<'events' | 'organizations'>('events')
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const normalizedSearch = deferredSearch.trim().toLowerCase()

  const { data: npoData, isLoading: nposLoading } = useQuery({
    queryKey: [
      'directory-npos-home',
      isAuthenticated,
      userRole,
      isDonor,
      isSuperAdmin,
    ],
    queryFn: async () => {
      if (!isAuthenticated || isDonor) {
        return listPublicNPOs({ page: 1, page_size: 100 })
      }

      const response = await npoApi.listNPOs({
        page: 1,
        page_size: 100,
        ...(isSuperAdmin ? {} : { status: 'approved' }),
      })

      return {
        ...response,
        items: response.items.map((npo) => ({
          id: npo.id,
          name: npo.name,
          tagline: npo.tagline,
          description: npo.description,
          mission_statement: npo.mission_statement,
          website_url: npo.website_url,
          phone: npo.phone,
          email: npo.email,
          address: npo.address,
          logo_url: npo.logo_url ?? null,
        })),
      }
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data: eventData, isLoading: eventsLoading } = useQuery({
    queryKey: [
      'directory-events-home',
      isAuthenticated,
      userRole,
      isDonor,
      isSuperAdmin,
    ],
    queryFn: async () => {
      if (!isAuthenticated || isDonor) {
        return listPublicEvents({ page: 1, per_page: 100 })
      }

      const response = await eventApi.listEvents({
        page: 1,
        per_page: 100,
        ...(isSuperAdmin ? {} : { status: 'active' }),
      })

      return {
        ...response,
        items: response.items.map((event) => ({
          id: event.id,
          npo_id: event.npo_id,
          npo_name: event.npo_name ?? null,
          slug: event.slug,
          name: event.name,
          tagline: event.tagline,
          event_datetime: event.event_datetime,
          timezone: event.timezone,
          venue_name: event.venue_name,
          venue_city: event.venue_city,
          venue_state: event.venue_state,
          status: event.status,
          logo_url: event.logo_url,
          hero_transition_style: event.hero_transition_style,
          created_at: event.created_at,
          updated_at: event.updated_at,
        })),
      }
    },
    staleTime: 5 * 60 * 1000,
  })

  const organizations = (npoData?.items ?? []).filter((npo) => {
    if (!normalizedSearch) return true
    return [
      npo.name,
      npo.tagline,
      npo.description,
      npo.mission_statement,
      npo.address?.city,
      npo.address?.state,
    ]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(normalizedSearch))
  })

  const events = (eventData?.items ?? []).filter((event) => {
    if (!normalizedSearch) return true
    return [
      event.name,
      event.tagline,
      event.npo_name,
      event.venue_name,
      event.venue_city,
      event.venue_state,
    ]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(normalizedSearch))
  })

  const isLoading = nposLoading || eventsLoading

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='relative'>
          <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder='Search organizations or events'
            className='pl-9'
          />
        </div>

        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as 'events' | 'organizations')}
        >
          <TabsList className='grid w-full grid-cols-2'>
            <TabsTrigger value='events'>Events ({events.length})</TabsTrigger>
            <TabsTrigger value='organizations'>
              Organizations ({organizations.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value='events' className='space-y-4'>
            {isLoading ? (
              <div className='grid gap-4 lg:grid-cols-2'>
                <div className='bg-muted h-28 animate-pulse rounded-xl' />
                <div className='bg-muted h-28 animate-pulse rounded-xl' />
              </div>
            ) : events.length === 0 ? (
              <div className='rounded-xl border border-dashed px-6 py-10 text-center'>
                <p className='font-medium'>No events match your search.</p>
              </div>
            ) : (
              <>
                <EventCards items={events} />
                <EventTable items={events} />
              </>
            )}
          </TabsContent>

          <TabsContent value='organizations' className='space-y-4'>
            {isLoading ? (
              <div className='grid gap-4 lg:grid-cols-2'>
                <div className='bg-muted h-28 animate-pulse rounded-xl' />
                <div className='bg-muted h-28 animate-pulse rounded-xl' />
              </div>
            ) : organizations.length === 0 ? (
              <div className='rounded-xl border border-dashed px-6 py-10 text-center'>
                <p className='font-medium'>
                  No organizations match your search.
                </p>
              </div>
            ) : (
              <>
                <OrganizationCards items={organizations} />
                <OrganizationTable items={organizations} />
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
