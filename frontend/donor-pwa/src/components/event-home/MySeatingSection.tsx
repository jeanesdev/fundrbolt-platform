/**
 * MySeatingSection — Premium redesign (native app style)
 *
 * Replaces collapsible card with a visually rich, always-visible section:
 * - Large bidder number pill
 * - Table name / number with captain badge
 * - Compact tablemates grid
 */
import type { GuestProfileData } from '@/components/event-home/GuestProfileModal'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { useSwipeDownToClose } from '@/hooks/use-swipe-down-to-close'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Crown, Hash, Loader2, Map, MapPin, Users, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface MySeatingInfo {
  guestId: string
  fullName: string | null
  bidderNumber: number | null
  tableNumber: number | null
  checkedIn: boolean
}

interface TablemateInfo {
  guestId: string
  name: string | null
  bidderNumber: number | null
  isTableCaptain?: boolean
  company?: string | null
  profileImageUrl?: string | null
  isCurrentUser?: boolean
}

interface TableAssignment {
  tableNumber: number
  tableName: string | null
  captainFullName: string | null
  youAreCaptain: boolean
}

interface SeatingInfoResponse {
  myInfo: MySeatingInfo
  tablemates: TablemateInfo[]
  tableCapacity: {
    current: number
    max: number
  }
  hasTableAssignment: boolean
  message?: string | null
  tableAssignment?: TableAssignment | null
}

interface MySeatingProps {
  seatingInfo: SeatingInfoResponse
  venueMapLink?: string | null
  onGuestClick?: (guest: GuestProfileData) => void
}

const loadedMapImageUrls = new Set<string>()

function getMapImageWarmCache(): Set<string> {
  if (typeof window === 'undefined') {
    return loadedMapImageUrls
  }

  const globalWindow = window as Window & {
    __mapImageWarmCache?: Set<string>
  }

  if (!globalWindow.__mapImageWarmCache) {
    globalWindow.__mapImageWarmCache = new Set<string>()
  }

  return globalWindow.__mapImageWarmCache
}

function getInitials(name: string | null): string {
  if (!name) return '?'
  const words = name.split(' ').filter(Boolean)
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase()
  return (words[0]?.[0] || '?').toUpperCase()
}

function parseBidderNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function normalizeName(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function normalizeNameForMatch(value: string | null | undefined): string {
  return normalizeName(value).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function namesLikelyMatch(left: string | null | undefined, right: string | null | undefined): boolean {
  const leftNormalized = normalizeNameForMatch(left)
  const rightNormalized = normalizeNameForMatch(right)

  if (!leftNormalized || !rightNormalized) return false
  if (leftNormalized === rightNormalized) return true

  const leftParts = leftNormalized.split(' ').filter(Boolean)
  const rightParts = rightNormalized.split(' ').filter(Boolean)
  if (leftParts.length === 0 || rightParts.length === 0) return false

  const leftFirst = leftParts[0]
  const rightFirst = rightParts[0]
  const leftLast = leftParts[leftParts.length - 1]
  const rightLast = rightParts[rightParts.length - 1]

  if (leftFirst === rightFirst && leftLast === rightLast) {
    return true
  }

  if (
    leftFirst === rightFirst &&
    (leftNormalized.includes(rightNormalized) || rightNormalized.includes(leftNormalized))
  ) {
    return true
  }

  return false
}

function isImageMapUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url)
}

function isGoogleMapsUrl(url: string): boolean {
  return /(^https?:\/\/)?(www\.)?(maps\.google\.|google\.com\/maps)/i.test(url)
}

function getEmbedMapUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const queryParam = parsed.searchParams.get('q')
    if (queryParam) {
      return `https://www.google.com/maps?q=${encodeURIComponent(queryParam)}&output=embed`
    }
    return `https://www.google.com/maps?q=${encodeURIComponent(url)}&output=embed`
  } catch {
    return `https://www.google.com/maps?q=${encodeURIComponent(url)}&output=embed`
  }
}

export function MySeatingSection({ seatingInfo, venueMapLink, onGuestClick }: MySeatingProps) {
  const [isMapFullscreenOpen, setIsMapFullscreenOpen] = useState(false)
  const [mapImageFailed, setMapImageFailed] = useState(false)
  const [mapImageLoaded, setMapImageLoaded] = useState(false)
  const mapWarmCache = useMemo(() => getMapImageWarmCache(), [])

  // Double-tap to close fullscreen map
  const closeFullscreenMap = useCallback(() => setIsMapFullscreenOpen(false), [])
  const lastMapTapRef = useRef(0)
  const handleMapDoubleTap = useCallback(() => {
    const now = Date.now()
    if (now - lastMapTapRef.current < 400) {
      closeFullscreenMap()
    }
    lastMapTapRef.current = now
  }, [closeFullscreenMap])

  // Swipe-down to close fullscreen map
  const {
    onTouchStart: mapSwipeTouchStart,
    onTouchEnd: mapSwipeTouchEnd,
  } = useSwipeDownToClose(closeFullscreenMap)

  const isPreloadedMapImage = useMemo(() => {
    if (!venueMapLink || isGoogleMapsUrl(venueMapLink)) {
      return false
    }

    return loadedMapImageUrls.has(venueMapLink)
  }, [venueMapLink])

  const isMapImageReady = mapImageLoaded || isPreloadedMapImage

  useEffect(() => {
    if (!venueMapLink || isGoogleMapsUrl(venueMapLink)) {
      return
    }

    if (loadedMapImageUrls.has(venueMapLink)) {
      return
    }

    const image = new Image()
    image.decoding = 'async'
    image.onload = () => {
      loadedMapImageUrls.add(venueMapLink)
      mapWarmCache.add(venueMapLink)
      setMapImageLoaded(true)
    }
    image.onerror = () => {
      setMapImageFailed(true)
    }
    image.src = venueMapLink
  }, [mapWarmCache, venueMapLink])

  useEffect(() => {
    if (!isMapFullscreenOpen) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMapFullscreenOpen(false)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isMapFullscreenOpen])

  const seatingInfoRecord = seatingInfo as SeatingInfoResponse & {
    guest_name?: string | null
    full_name?: string | null
    bidder_number?: number | string | null
    table_number?: number | null
    checked_in?: boolean
    my_info?: {
      guest_id?: string
      full_name?: string | null
      bidder_number?: number | null
      table_number?: number | null
      checked_in?: boolean
    }
    table_capacity?: { current?: number; max?: number }
    has_table_assignment?: boolean
    table_assignment?: {
      table_number?: number
      table_name?: string | null
      table_captain_name?: string | null
      captain_full_name?: string | null
      you_are_captain?: boolean
      current_occupancy?: number
      effective_capacity?: number
    } | null
    tablemates?: Array<{
      guest_id?: string
      name?: string | null
      bidder_number?: number | null
      is_table_captain?: boolean
      isTableCaptain?: boolean
      company?: string | null
      profile_image_url?: string | null
      profileImageUrl?: string | null
    }>
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const myInfoSource: any = seatingInfo.myInfo ?? seatingInfoRecord.my_info ?? seatingInfoRecord
  const myInfo: MySeatingInfo = {
    guestId: myInfoSource?.guestId ?? myInfoSource?.guest_id ?? '',
    fullName:
      myInfoSource?.fullName ??
      myInfoSource?.full_name ??
      myInfoSource?.guest_name ??
      myInfoSource?.name ??
      null,
    bidderNumber: parseBidderNumber(myInfoSource?.bidderNumber ?? myInfoSource?.bidder_number),
    tableNumber: myInfoSource?.tableNumber ?? myInfoSource?.table_number ?? null,
    checkedIn: myInfoSource?.checkedIn ?? myInfoSource?.checked_in ?? false,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tablematesSource: any[] = seatingInfo.tablemates ?? seatingInfoRecord.tablemates ?? []
  const tablemates: TablemateInfo[] = tablematesSource.map((t) => ({
    guestId: t.guestId ?? t.guest_id ?? '',
    name: t.name ?? null,
    bidderNumber: parseBidderNumber(t.bidderNumber ?? t.bidder_number),
    isTableCaptain: Boolean(t.isTableCaptain ?? t.is_table_captain),
    company: t.company ?? null,
    profileImageUrl: t.profileImageUrl ?? t.profile_image_url ?? null,
  }))

  const tableCapacitySource = seatingInfo.tableCapacity ?? seatingInfoRecord.table_capacity
  const tableCapacity = {
    current: tableCapacitySource?.current ?? seatingInfoRecord.table_assignment?.current_occupancy ?? 0,
    max: tableCapacitySource?.max ?? seatingInfoRecord.table_assignment?.effective_capacity ?? 0,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tableAssignmentSource: any = seatingInfo.tableAssignment ?? seatingInfoRecord.table_assignment
  const tableAssignment: TableAssignment | null = tableAssignmentSource
    ? {
      tableNumber: tableAssignmentSource.tableNumber ?? tableAssignmentSource.table_number ?? 0,
      tableName: tableAssignmentSource.tableName ?? tableAssignmentSource.table_name ?? null,
      captainFullName:
        tableAssignmentSource.captainFullName ??
        tableAssignmentSource.table_captain_name ??
        tableAssignmentSource.captain_full_name ??
        null,
      youAreCaptain: tableAssignmentSource.youAreCaptain ?? tableAssignmentSource.you_are_captain ?? false,
    }
    : null

  const isCurrentUserCaptain = Boolean(tableAssignment?.youAreCaptain)

  const hasCurrentUserInTablemates = tablemates.some(
    (mate) =>
      (mate.guestId && myInfo.guestId && mate.guestId === myInfo.guestId) ||
      (normalizeName(mate.name) && normalizeName(mate.name) === normalizeName(myInfo.fullName))
  )

  const displayTablemates: TablemateInfo[] = hasCurrentUserInTablemates
    ? tablemates
    : [
      {
        guestId: myInfo.guestId || '__current-user__',
        name: myInfo.fullName ?? 'Guest',
        bidderNumber: myInfo.bidderNumber,
        isTableCaptain: isCurrentUserCaptain,
        company: null,
        profileImageUrl: null,
        isCurrentUser: true,
      },
      ...tablemates,
    ]

  const detectedCaptainFromTablemates = displayTablemates.find((mate) => mate.isTableCaptain)
  const captainDisplayName = tableAssignment?.captainFullName ?? detectedCaptainFromTablemates?.name ?? null
  const matchedCurrentUserMate = displayTablemates.find(
    (mate) =>
      (mate.guestId && myInfo.guestId && mate.guestId === myInfo.guestId) ||
      namesLikelyMatch(mate.name, myInfo.fullName)
  )
  const captainByNameMatch = displayTablemates.find((mate) => namesLikelyMatch(mate.name, captainDisplayName))
  const captainGuestId =
    detectedCaptainFromTablemates?.guestId ||
    (isCurrentUserCaptain ? (matchedCurrentUserMate?.guestId || myInfo.guestId || '__current-user__') : null) ||
    captainByNameMatch?.guestId ||
    null

  const captainLabelName = isCurrentUserCaptain
    ? (myInfo.fullName ?? captainDisplayName ?? 'Assigned')
    : (captainDisplayName ?? 'Assigned')
  const captainPillLabel = `Table Captain: ${captainLabelName}`

  const resolvedTableNumber = tableAssignment?.tableNumber ?? myInfo.tableNumber
  const hasTable = !!resolvedTableNumber
  const message = seatingInfo.message ?? seatingInfoRecord.message

  const mapContent = useMemo(() => {
    if (!venueMapLink) {
      return (
        <div className='flex h-full w-full items-center justify-center'>
          <p className='text-sm' style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}>
            Event map is not available for this event yet.
          </p>
        </div>
      )
    }

    const mapUrl = venueMapLink

    if (isGoogleMapsUrl(mapUrl)) {
      return (
        <div className='h-full w-full overflow-hidden'>
          <iframe
            title='Event Map'
            src={getEmbedMapUrl(mapUrl)}
            className='h-full w-full'
            loading='lazy'
            referrerPolicy='no-referrer-when-downgrade'
            allowFullScreen
          />
        </div>
      )
    }

    if (!mapImageFailed || isImageMapUrl(mapUrl)) {
      return (
        <div className='relative flex h-full w-full items-center justify-center'>
          {!isMapImageReady && (
            <div className='absolute inset-0 flex items-center justify-center bg-black/20'>
              <Loader2 className='h-8 w-8 animate-spin text-white/90' />
            </div>
          )}
          <img
            src={mapUrl}
            alt='Event Map'
            className='h-auto w-auto max-h-full max-w-full object-contain'
            loading='eager'
            fetchPriority='high'
            decoding='async'
            onLoad={() => setMapImageLoaded(true)}
            onError={() => setMapImageFailed(true)}
          />
        </div>
      )
    }

    return (
      <div className='flex h-full w-full flex-col'>
        <div className='min-h-0 flex-1 overflow-hidden'>
          <iframe
            title='Event Map'
            src={mapUrl}
            className='h-full w-full'
            loading='lazy'
            referrerPolicy='no-referrer-when-downgrade'
            allowFullScreen
          />
        </div>
        <a
          href={mapUrl}
          target='_blank'
          rel='noopener noreferrer'
          className='mt-3 inline-flex w-fit items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium hover:opacity-90'
          style={{
            borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.45)',
            color: 'rgb(var(--event-primary, 59, 130, 246))',
          }}
        >
          Open map directly
        </a>
      </div>
    )
  }, [isMapImageReady, mapImageFailed, venueMapLink])

  return (
    <div className='space-y-4'>
      <div
        className='relative overflow-hidden rounded-2xl p-5'
        style={{
          backgroundColor: 'rgb(var(--event-primary, 59, 130, 246))',
        }}
      >
        <div className='pointer-events-none absolute inset-0 bg-black/0' />
        <div className='pointer-events-none absolute -top-6 -right-6 h-24 w-24 rounded-full bg-white/15 blur-xl' />
        <div className='relative z-10 flex items-center justify-between'>
          <div>
            <p className='mb-1 text-xs font-semibold uppercase tracking-widest text-white/70'>
              Your Bidder Number
            </p>
            {myInfo.bidderNumber ? (
              <div className='flex items-center gap-2'>
                <Hash className='h-5 w-5 text-white/70' />
                <span className='text-4xl font-black tabular-nums text-white'>{myInfo.bidderNumber}</span>
              </div>
            ) : (
              <p className='text-sm text-white/60 italic'>
                Check in at the event to receive your bidder number
              </p>
            )}
          </div>
          {hasTable && (
            <div className='text-right'>
              <p className='mb-1 text-xs font-semibold uppercase tracking-widest text-white/70'>
                Table
              </p>
              <div className='flex items-center gap-1.5 justify-end'>
                <MapPin className='h-4 w-4 text-white/70' />
                <span className='text-2xl font-black text-white'>
                  {tableAssignment?.tableName ?? resolvedTableNumber}
                </span>
              </div>
              {tableAssignment?.tableName && <p className='text-xs text-white/60'>Table {tableAssignment?.tableNumber}</p>}
            </div>
          )}
        </div>
      </div>

      {!hasTable && message && (
        <div
          className='rounded-xl border px-4 py-3'
          style={{
            backgroundColor: 'rgb(var(--event-background, 255, 255, 255))',
            borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.25)',
          }}
        >
          <p className='text-sm' style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}>
            {message}
          </p>
        </div>
      )}

      {hasTable && (
        <div
          className='relative overflow-hidden rounded-2xl border-2 p-4 shadow-md'
          style={{
            backgroundColor: 'rgb(var(--event-primary, 59, 130, 246))',
            borderColor: 'rgb(var(--event-primary, 59, 130, 246))',
            boxShadow: '0 14px 36px rgb(var(--event-primary, 59, 130, 246) / 0.18)',
          }}
        >
          <div className='relative mb-3 flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <Users className='h-4 w-4' style={{ color: 'rgb(var(--event-text-on-primary-rgb, 255 255 255) / 0.85)' }} />
              <h3 className='text-sm font-semibold' style={{ color: 'var(--event-text-on-primary, #FFFFFF)' }}>
                Tablemates
              </h3>
              {(isCurrentUserCaptain || captainDisplayName || detectedCaptainFromTablemates) && (
                <span
                  className='inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold'
                  style={{
                    backgroundColor: 'rgb(var(--event-primary, 59, 130, 246))',
                    color: 'var(--event-text-on-primary, #FFFFFF)',
                  }}
                >
                  <Crown className='h-2.5 w-2.5' />
                  {captainPillLabel}
                </span>
              )}
            </div>
            <span
              className='rounded-full px-2 py-0.5 text-xs font-medium'
              style={{
                backgroundColor: 'rgb(var(--event-text-on-primary-rgb, 255 255 255) / 0.2)',
                color: 'var(--event-text-on-primary, #FFFFFF)',
              }}
            >
              {tableCapacity.current}/{tableCapacity.max}
            </span>
          </div>

          <div className='relative mb-3'>
            <Button
              type='button'
              onClick={() => {
                setMapImageFailed(false)
                setMapImageLoaded(isPreloadedMapImage)
                setIsMapFullscreenOpen(true)
              }}
              className='inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition-opacity hover:opacity-95'
              style={{
                borderColor: 'rgb(var(--event-text-on-primary-rgb, 255 255 255) / 0.85)',
                color: 'rgb(var(--event-primary, 59, 130, 246))',
                backgroundColor: 'rgb(var(--event-text-on-primary-rgb, 255 255 255) / 0.96)',
              }}
            >
              <Map className='h-3.5 w-3.5' />
              Event Layout
            </Button>
          </div>

          {displayTablemates.length > 0 ? (
            <div className='relative grid grid-cols-3 gap-2 sm:grid-cols-4'>
              {displayTablemates.map((mate) => (
                <div
                  key={mate.guestId}
                  className={`flex flex-col items-center gap-1.5 ${onGuestClick && !mate.isCurrentUser ? 'cursor-pointer active:opacity-70' : ''}`}
                  role={onGuestClick && !mate.isCurrentUser ? 'button' : undefined}
                  tabIndex={onGuestClick && !mate.isCurrentUser ? 0 : undefined}
                  aria-label={onGuestClick && !mate.isCurrentUser ? `View ${mate.name ?? 'guest'}'s profile` : undefined}
                  onClick={onGuestClick && !mate.isCurrentUser ? () => onGuestClick({
                    guestId: mate.guestId,
                    name: mate.name,
                    bidderNumber: mate.bidderNumber,
                    tableNumber: resolvedTableNumber,
                    tableName: tableAssignment?.tableName ?? null,
                    company: mate.company,
                    profileImageUrl: mate.profileImageUrl,
                    isTableCaptain: mate.isTableCaptain,
                  }) : undefined}
                >
                  <div className='relative'>
                    <div
                      className='flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 text-xs font-bold'
                      style={{
                        borderColor: 'rgb(var(--event-text-on-primary-rgb, 255 255 255) / 0.85)',
                        backgroundColor: 'rgb(var(--event-text-on-primary-rgb, 255 255 255) / 0.92)',
                        color: 'rgb(var(--event-primary, 59, 130, 246))',
                      }}
                      aria-label={mate.name ?? 'Guest'}
                    >
                      {mate.profileImageUrl ? (
                        <img
                          src={mate.profileImageUrl}
                          alt={mate.name ?? 'Guest'}
                          className='h-full w-full object-cover'
                          loading='lazy'
                          decoding='async'
                        />
                      ) : (
                        <span>{getInitials(mate.name)}</span>
                      )}
                    </div>
                    {(mate.isTableCaptain ||
                      (captainGuestId && mate.guestId === captainGuestId) ||
                      (captainDisplayName && namesLikelyMatch(mate.name, captainDisplayName))) && (
                        <span
                          className='absolute -right-1.5 -top-1.5 z-20 inline-flex h-5 w-5 items-center justify-center rounded-full border shadow-sm'
                          style={{
                            backgroundColor: 'rgb(var(--event-text-on-primary-rgb, 255 255 255))',
                            borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.45)',
                            color: 'rgb(var(--event-primary, 59, 130, 246))',
                          }}
                          title='Table Captain'
                          aria-label='Table Captain'
                        >
                          <Crown className='h-3 w-3' />
                        </span>
                      )}
                  </div>
                  <p
                    className='text-center text-[10px] font-medium leading-tight line-clamp-2'
                    style={{ color: 'var(--event-text-on-primary, #FFFFFF)' }}
                  >
                    {mate.name ?? 'Guest'}
                  </p>
                  {mate.bidderNumber !== null && (
                    <p
                      className='text-[10px] font-medium'
                      style={{ color: 'rgb(var(--event-text-on-primary-rgb, 255 255 255) / 0.82)' }}
                    >
                      #{mate.bidderNumber}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className='text-center text-sm italic' style={{ color: 'rgb(var(--event-text-on-primary-rgb, 255 255 255) / 0.82)' }}>
              You're the first at your table.
            </p>
          )}
        </div>
      )}

      {isMapFullscreenOpen && (
        <Dialog open={isMapFullscreenOpen} onOpenChange={setIsMapFullscreenOpen}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className='fixed inset-0 z-[10000] bg-black/95' />
            <DialogPrimitive.Content
              className='fixed inset-0 z-[10001] m-0 h-[100dvh] w-screen border-0 bg-transparent p-0 outline-none'
              onTouchStart={mapSwipeTouchStart}
              onTouchEnd={mapSwipeTouchEnd}
            >
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='absolute right-2 top-[max(env(safe-area-inset-top),0.5rem)] z-30 text-white hover:bg-white/15 hover:text-white sm:right-3 sm:top-[max(env(safe-area-inset-top),0.75rem)]'
                onClick={() => setIsMapFullscreenOpen(false)}
                aria-label='Close map'
              >
                <X className='h-5 w-5' />
              </Button>

              <div
                className='absolute inset-0 flex items-center justify-center overflow-hidden p-2 pt-14 sm:p-4 sm:pt-16'
                onClick={handleMapDoubleTap}
                onDoubleClick={closeFullscreenMap}
                role='button'
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') closeFullscreenMap()
                }}
                aria-label='Double-tap or swipe down to close'
              >
                {mapContent}
              </div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </Dialog>
      )}
    </div>
  )
}
