/**
 * SearchResults Component
 * Displays grouped search results with navigation
 *
 * T076: Display grouped results (Users, NPOs, Events)
 * T079: "No results found" message
 * T080: Clickable result items with navigation
 */
import { Link } from '@tanstack/react-router'
import type { SearchResponse } from '@/services/search'
import { Building2, Calendar, Gavel, User } from 'lucide-react'

interface SearchResultsProps {
  results: SearchResponse | null
  isLoading: boolean
  onClose: () => void
}

export function SearchResults({
  results,
  isLoading,
  onClose,
}: SearchResultsProps) {
  // T081: Loading skeleton
  if (isLoading) {
    return (
      <div className='space-y-2 p-4'>
        {[1, 2, 3].map((i) => (
          <div key={i} className='flex animate-pulse items-center gap-3 p-2'>
            <div className='bg-muted h-8 w-8 rounded' />
            <div className='flex-1'>
              <div className='bg-muted mb-2 h-4 w-3/4 rounded' />
              <div className='bg-muted h-3 w-1/2 rounded' />
            </div>
          </div>
        ))}
      </div>
    )
  }

  // T079: No results found
  if (!results || results.total_results === 0) {
    return (
      <div className='text-muted-foreground p-8 text-center'>
        <p>No results found</p>
        {results?.query && (
          <p className='mt-1 text-sm'>Try a different search term</p>
        )}
      </div>
    )
  }

  return (
    <div className='max-h-96 overflow-y-auto p-2'>
      {/* Users Section */}
      {results.users.length > 0 && (
        <div className='mb-4'>
          <h3 className='text-muted-foreground mb-2 px-2 text-xs font-semibold uppercase'>
            Users ({results.users.length})
          </h3>
          {results.users.map((user) => (
            <Link
              key={user.id}
              to='/home'
              onClick={onClose}
              className='hover:bg-accent flex items-center gap-3 rounded p-2 transition-colors'
            >
              <div className='bg-muted flex h-8 w-8 items-center justify-center rounded'>
                <User className='h-4 w-4' />
              </div>
              <div className='min-w-0 flex-1'>
                <p className='truncate font-medium'>
                  {user.first_name} {user.last_name}
                </p>
                <p className='text-muted-foreground truncate text-xs'>
                  {user.email} • {user.role}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* NPOs Section */}
      {results.npos.length > 0 && (
        <div className='mb-4'>
          <h3 className='text-muted-foreground mb-2 px-2 text-xs font-semibold uppercase'>
            Organizations ({results.npos.length})
          </h3>
          {results.npos.map((npo) => (
            <Link
              key={npo.id}
              to='/npos/$npoId'
              params={{ npoId: npo.id }}
              onClick={onClose}
              className='hover:bg-accent flex items-center gap-3 rounded p-2 transition-colors'
            >
              <div className='bg-muted flex h-8 w-8 items-center justify-center rounded'>
                <Building2 className='h-4 w-4' />
              </div>
              <div className='min-w-0 flex-1'>
                <p className='truncate font-medium'>{npo.name}</p>
                <p className='text-muted-foreground truncate text-xs'>
                  {npo.tagline || npo.status}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Events Section */}
      {results.events.length > 0 && (
        <div className='mb-4'>
          <h3 className='text-muted-foreground mb-2 px-2 text-xs font-semibold uppercase'>
            Events ({results.events.length})
          </h3>
          {results.events.map((event) => (
            <Link
              key={event.id}
              to='/events/$slug'
              params={{ slug: event.slug }}
              onClick={onClose}
              className='hover:bg-accent flex items-center gap-3 rounded p-2 transition-colors'
            >
              <div className='bg-muted flex h-8 w-8 items-center justify-center rounded'>
                <Calendar className='h-4 w-4' />
              </div>
              <div className='min-w-0 flex-1'>
                <p className='truncate font-medium'>{event.name}</p>
                <p className='text-muted-foreground truncate text-xs'>
                  {event.npo_name} • {event.event_type}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Auction Items Section */}
      {results.auction_items.length > 0 && (
        <div className='mb-4'>
          <h3 className='text-muted-foreground mb-2 px-2 text-xs font-semibold uppercase'>
            Auction Items ({results.auction_items.length})
          </h3>
          {results.auction_items.map((item) => (
            <Link
              key={item.id}
              to='/events/$eventSlug/auction-items/$itemId'
              params={{
                eventSlug: item.event_slug ?? item.event_id,
                itemId: item.id,
              }}
              onClick={onClose}
              className='hover:bg-accent flex items-center gap-3 rounded p-2 transition-colors'
            >
              <div className='bg-muted flex h-8 w-8 items-center justify-center rounded'>
                <Gavel className='h-4 w-4' />
              </div>
              <div className='min-w-0 flex-1'>
                <p className='truncate font-medium'>
                  {item.bid_number != null && (
                    <span className='text-muted-foreground font-normal'>
                      #{item.bid_number}{' '}
                    </span>
                  )}
                  {item.name}
                </p>
                <p className='text-muted-foreground truncate text-xs'>
                  {item.event_name} • {item.category}
                  {item.starting_bid &&
                    ` • $${item.starting_bid.toLocaleString()}`}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
