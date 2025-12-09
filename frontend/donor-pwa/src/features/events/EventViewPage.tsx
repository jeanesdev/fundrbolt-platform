/**
 * EventViewPage
 * Read-only event page for donors in the PWA
 * Shows event details, sponsors, auction items - no editing
 */

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuctionItemStore } from '@/stores/auctionItemStore'
import { useEventStore } from '@/stores/event-store'
import { useSponsorStore } from '@/stores/sponsorStore'
import { useNavigate, useParams } from '@tanstack/react-router'
import {
  Calendar,
  Gavel,
  Heart,
  MapPin,
  Shirt,
  User,
} from 'lucide-react'
import { useCallback, useEffect } from 'react'
import { toast } from 'sonner'

export function EventViewPage() {
  const navigate = useNavigate()
  const { eventId } = useParams({ strict: false }) as { eventId: string }
  const { currentEvent, eventsLoading, loadEventById } = useEventStore()
  const { sponsors, fetchSponsors } = useSponsorStore()
  const { items: auctionItems, fetchAuctionItems } = useAuctionItemStore()

  const loadEvent = useCallback(() => {
    if (eventId) {
      loadEventById(eventId).catch(() => {
        toast.error('Failed to load event')
        navigate({ to: '/home' })
      })
    }
  }, [eventId, loadEventById, navigate])

  useEffect(() => {
    loadEvent()
  }, [loadEvent])

  // Load sponsors
  useEffect(() => {
    if (eventId) {
      fetchSponsors(eventId).catch(() => { })
    }
  }, [eventId, fetchSponsors])

  // Load auction items
  useEffect(() => {
    if (eventId) {
      fetchAuctionItems(eventId).catch(() => { })
    }
  }, [eventId, fetchAuctionItems])

  // Format datetime for display
  const formatDateTime = (dateTimeStr?: string | null) => {
    if (!dateTimeStr) return { date: 'TBD', time: '' }
    const dt = new Date(dateTimeStr)
    return {
      date: dt.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      time: dt.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      }),
    }
  }

  const formatCurrency = (amount?: number | null) => {
    if (amount == null) return 'TBD'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  // Get banner image from media
  const getBannerUrl = () => {
    if (!currentEvent?.media) return null
    const banner = currentEvent.media.find(
      (m) => m.media_type === 'image' && m.display_order === 0
    )
    return banner?.file_url || currentEvent.media[0]?.file_url
  }

  if (eventsLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <div className="border-primary mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2"></div>
          <p className="text-muted-foreground">Loading event...</p>
        </div>
      </div>
    )
  }

  if (!currentEvent) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Event not found</h2>
          <p className="text-muted-foreground mt-2">
            This event may have been removed or you don't have access.
          </p>
        </div>
      </div>
    )
  }

  const { date, time } = formatDateTime(currentEvent.event_datetime)
  const bannerUrl = getBannerUrl()

  return (
    <div className="container mx-auto space-y-6 px-4 py-6">
      {/* Event Header */}
      <div className="space-y-4">
        {/* Banner Image */}
        {bannerUrl && (
          <div className="relative h-48 w-full overflow-hidden rounded-lg md:h-64">
            <img
              src={bannerUrl}
              alt={currentEvent.name}
              className="h-full w-full object-cover"
            />
          </div>
        )}

        {/* Event Title and Status */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold md:text-3xl">{currentEvent.name}</h1>
            {currentEvent.tagline && (
              <p className="text-muted-foreground mt-1">{currentEvent.tagline}</p>
            )}
            {currentEvent.npo_name && (
              <p className="text-muted-foreground text-sm">
                by {currentEvent.npo_name}
              </p>
            )}
          </div>
          <Badge
            variant={
              currentEvent.status === 'active'
                ? 'default'
                : currentEvent.status === 'draft'
                  ? 'secondary'
                  : 'outline'
            }
          >
            {currentEvent.status}
          </Badge>
        </div>
      </div>

      {/* Quick Info Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Calendar className="text-primary h-5 w-5" />
            <div>
              <p className="text-sm font-medium">Date & Time</p>
              <p className="text-muted-foreground text-sm">{date}</p>
              {time && <p className="text-muted-foreground text-sm">{time}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <MapPin className="text-primary h-5 w-5" />
            <div>
              <p className="text-sm font-medium">Location</p>
              <p className="text-muted-foreground text-sm">
                {currentEvent.venue_name || 'TBD'}
              </p>
              {currentEvent.venue_city && currentEvent.venue_state && (
                <p className="text-muted-foreground text-sm">
                  {currentEvent.venue_city}, {currentEvent.venue_state}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {currentEvent.attire && (
          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <Shirt className="text-primary h-5 w-5" />
              <div>
                <p className="text-sm font-medium">Attire</p>
                <p className="text-muted-foreground text-sm">
                  {currentEvent.attire}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {currentEvent.primary_contact_name && (
          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <User className="text-primary h-5 w-5" />
              <div>
                <p className="text-sm font-medium">Contact</p>
                <p className="text-muted-foreground text-sm">
                  {currentEvent.primary_contact_name}
                </p>
                {currentEvent.primary_contact_email && (
                  <p className="text-muted-foreground text-xs">
                    {currentEvent.primary_contact_email}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tabs for Details */}
      <Tabs defaultValue="details" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:grid-cols-none">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="sponsors">
            Sponsors {sponsors.length > 0 && `(${sponsors.length})`}
          </TabsTrigger>
          <TabsTrigger value="auction">
            Auction {auctionItems.length > 0 && `(${auctionItems.length})`}
          </TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-6">
          {/* Description */}
          {currentEvent.description && (
            <Card>
              <CardHeader>
                <CardTitle>About This Event</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {currentEvent.description}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Venue Details */}
          {(currentEvent.venue_name || currentEvent.venue_address) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Venue
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {currentEvent.venue_name && (
                  <p className="font-medium">{currentEvent.venue_name}</p>
                )}
                {currentEvent.venue_address && (
                  <p className="text-muted-foreground">{currentEvent.venue_address}</p>
                )}
                {(currentEvent.venue_city ||
                  currentEvent.venue_state ||
                  currentEvent.venue_zip) && (
                    <p className="text-muted-foreground">
                      {[
                        currentEvent.venue_city,
                        currentEvent.venue_state,
                        currentEvent.venue_zip,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  )}
              </CardContent>
            </Card>
          )}

          {/* Food Options */}
          {currentEvent.food_options && currentEvent.food_options.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Menu Options</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {currentEvent.food_options.map((option) => (
                    <Badge key={option.id} variant="secondary">
                      {option.icon && <span className="mr-1">{option.icon}</span>}
                      {option.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Event Links */}
          {currentEvent.links && currentEvent.links.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Links</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {currentEvent.links.map((link) => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary block hover:underline"
                    >
                      {link.label || link.url}
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Sponsors Tab */}
        <TabsContent value="sponsors" className="space-y-4">
          {sponsors.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Heart className="text-muted-foreground mb-4 h-12 w-12" />
                <p className="text-muted-foreground">No sponsors yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sponsors.map((sponsor) => (
                <Card key={sponsor.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      {sponsor.logo_url ? (
                        <img
                          src={sponsor.logo_url}
                          alt={sponsor.name}
                          className="h-12 w-12 rounded object-contain"
                        />
                      ) : (
                        <div className="bg-muted flex h-12 w-12 items-center justify-center rounded">
                          <Heart className="text-muted-foreground h-6 w-6" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{sponsor.name}</p>
                        <Badge variant="outline" className="mt-1">
                          {sponsor.sponsor_level || 'Sponsor'}
                        </Badge>
                      </div>
                    </div>
                    {sponsor.website_url && (
                      <a
                        href={sponsor.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary mt-3 block text-sm hover:underline"
                      >
                        Visit website
                      </a>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Auction Tab */}
        <TabsContent value="auction" className="space-y-4">
          {auctionItems.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Gavel className="text-muted-foreground mb-4 h-12 w-12" />
                <p className="text-muted-foreground">No auction items yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {auctionItems.map((item) => (
                <Card key={item.id} className="overflow-hidden">
                  {item.primary_image_url && (
                    <div className="aspect-video overflow-hidden">
                      <img
                        src={item.primary_image_url}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="text-lg">{item.title}</CardTitle>
                    <CardDescription>
                      <Badge variant="secondary">{item.auction_type}</Badge>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {item.description && (
                      <p className="text-muted-foreground mb-4 line-clamp-2 text-sm">
                        {item.description}
                      </p>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Starting Bid</span>
                      <span className="font-medium">
                        {formatCurrency(item.starting_bid)}
                      </span>
                    </div>
                    {item.donor_value && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Est. Value</span>
                        <span className="font-medium">
                          {formatCurrency(item.donor_value)}
                        </span>
                      </div>
                    )}
                    {item.donated_by && (
                      <p className="text-muted-foreground mt-2 text-xs">
                        Donated by {item.donated_by}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
