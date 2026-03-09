/**
 * OtherGuestsSection – collapsible, searchable guest directory shown on the
 * "My Event" (seat) tab.
 *
 * Shows every confirmed guest at the event (not just the current user's
 * tablemates) as a compact card grid.  Tapping a card opens the
 * GuestProfileModal for a read-only view of that guest's profile.
 */
import type { GuestProfileData } from '@/components/event-home/GuestProfileModal'
import type { EventGuestItem } from '@/services/donor-activity-service'
import { ChevronDown, ChevronUp, Hash, MapPin, Search, Users } from 'lucide-react'
import { useMemo, useState } from 'react'

interface OtherGuestsSectionProps {
  guests: EventGuestItem[]
  onGuestClick?: (guest: GuestProfileData) => void
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]?.[0]?.toUpperCase() ?? '?'
  return `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase()
}

export function OtherGuestsSection({ guests, onGuestClick }: OtherGuestsSectionProps) {
  const [expanded, setExpanded] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return guests
    return guests.filter((g) => {
      const name = g.name?.toLowerCase() ?? ''
      const bidder = g.bidder_number?.toString() ?? ''
      const table =
        g.table_name?.toLowerCase() ??
        (g.table_number !== null ? `table ${g.table_number}` : '')
      return name.includes(q) || bidder.includes(q) || table.includes(q)
    })
  }, [guests, search])

  if (guests.length === 0) return null

  return (
    <div
      className='overflow-hidden rounded-2xl border'
      style={{
        borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.2)',
        backgroundColor: 'rgb(var(--event-background, 255, 255, 255))',
      }}
    >
      {/* Header / toggle */}
      <button
        type='button'
        className='flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors active:opacity-70'
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <div className='flex items-center gap-2.5'>
          <div
            className='flex h-8 w-8 items-center justify-center rounded-full'
            style={{ backgroundColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.1)' }}
          >
            <Users
              className='h-4 w-4'
              style={{ color: 'rgb(var(--event-primary, 59, 130, 246))' }}
            />
          </div>
          <span
            className='text-sm font-semibold'
            style={{ color: 'var(--event-text-on-background, #111827)' }}
          >
            Other Guests
          </span>
          <span
            className='rounded-full px-2 py-0.5 text-xs font-medium'
            style={{
              backgroundColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.1)',
              color: 'rgb(var(--event-primary, 59, 130, 246))',
            }}
          >
            {guests.length}
          </span>
        </div>
        {expanded ? (
          <ChevronUp
            className='h-4 w-4'
            style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}
          />
        ) : (
          <ChevronDown
            className='h-4 w-4'
            style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}
          />
        )}
      </button>

      {expanded && (
        <div className='border-t px-4 pb-4 pt-3' style={{ borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.1)' }}>
          {/* Search */}
          <div className='relative mb-3'>
            <Search
              className='absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2'
              style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}
            />
            <input
              type='text'
              placeholder='Search by name, bidder #, or table…'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className='w-full rounded-xl border bg-transparent py-2 pl-8 pr-3 text-sm outline-none focus:ring-1'
              style={{
                borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.25)',
                color: 'var(--event-text-on-background, #111827)',
              }}
            />
          </div>

          {filtered.length === 0 ? (
            <p
              className='py-4 text-center text-sm italic'
              style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}
            >
              No guests match your search.
            </p>
          ) : (
            <div className='grid gap-2'>
              {filtered.map((guest) => (
                <div
                  key={guest.guest_id}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${onGuestClick ? 'cursor-pointer active:opacity-70' : ''
                    }`}
                  style={{
                    borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.12)',
                    backgroundColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.03)',
                  }}
                  role={onGuestClick ? 'button' : undefined}
                  tabIndex={onGuestClick ? 0 : undefined}
                  aria-label={
                    onGuestClick
                      ? `View ${guest.name ?? 'guest'}'s profile`
                      : undefined
                  }
                  onClick={
                    onGuestClick
                      ? () =>
                        onGuestClick({
                          guestId: guest.guest_id,
                          name: guest.name,
                          bidderNumber: guest.bidder_number,
                          tableNumber: guest.table_number,
                          tableName: guest.table_name,
                          profileImageUrl: guest.profile_image_url,
                          isTableCaptain: guest.is_table_captain,
                        })
                      : undefined
                  }
                  onKeyDown={
                    onGuestClick
                      ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onGuestClick({
                            guestId: guest.guest_id,
                            name: guest.name,
                            bidderNumber: guest.bidder_number,
                            tableNumber: guest.table_number,
                            tableName: guest.table_name,
                            profileImageUrl: guest.profile_image_url,
                            isTableCaptain: guest.is_table_captain,
                          })
                        }
                      }
                      : undefined
                  }
                >
                  {/* Avatar */}
                  <div
                    className='flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border text-xs font-bold'
                    style={{
                      borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.3)',
                      backgroundColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.1)',
                      color: 'rgb(var(--event-primary, 59, 130, 246))',
                    }}
                  >
                    {guest.profile_image_url ? (
                      <img
                        src={guest.profile_image_url}
                        alt={guest.name ?? 'Guest'}
                        className='h-full w-full object-cover'
                        loading='lazy'
                        decoding='async'
                      />
                    ) : (
                      <span>{getInitials(guest.name)}</span>
                    )}
                  </div>

                  {/* Info */}
                  <div className='min-w-0 flex-1'>
                    <p
                      className='truncate text-sm font-semibold'
                      style={{ color: 'var(--event-text-on-background, #111827)' }}
                    >
                      {guest.name ?? 'Guest'}
                    </p>
                    <div className='mt-0.5 flex items-center gap-2.5 flex-wrap'>
                      {guest.bidder_number !== null && (
                        <span
                          className='inline-flex items-center gap-1 text-xs'
                          style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}
                        >
                          <Hash className='h-3 w-3' />
                          {guest.bidder_number}
                        </span>
                      )}
                      {guest.table_number !== null && (
                        <span
                          className='inline-flex items-center gap-1 text-xs'
                          style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}
                        >
                          <MapPin className='h-3 w-3' />
                          {guest.table_name ?? `Table ${guest.table_number}`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
