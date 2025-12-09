/**
 * EventSwitcher Component
 *
 * Dropdown component for switching between events the user is registered for.
 * Only displays as a dropdown if the user has multiple events.
 * For single event users, just displays the event name.
 *
 * Features:
 * - Event thumbnail display (event image → NPO logo fallback → initials)
 * - "Past" badge for past events
 * - Events sorted: upcoming first (date ASC), then past (date DESC)
 * - Conditional dropdown (only shows chevron if multiple events)
 */

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { RegisteredEventWithBranding } from '@/types/event-branding'
import { Calendar, Check, ChevronDown } from 'lucide-react'

export interface EventSwitcherProps {
  /** Currently selected event */
  currentEvent: RegisteredEventWithBranding
  /** All available events */
  events: RegisteredEventWithBranding[]
  /** Callback when event is selected */
  onEventSelect: (event: RegisteredEventWithBranding) => void
}

/**
 * Get initials from event name (first letter of first two words)
 */
function getInitials(name: string): string {
  const words = name.split(' ').filter(Boolean)
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase()
  }
  return (words[0]?.[0] || 'E').toUpperCase()
}

/**
 * Format event date for display
 */
function formatEventDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * EventThumbnail - Shows event image, NPO logo, or initials
 */
function EventThumbnail({
  event,
  size = 'default',
}: {
  event: RegisteredEventWithBranding
  size?: 'default' | 'small'
}) {
  const sizeClasses = size === 'small' ? 'h-8 w-8' : 'h-10 w-10'
  const textSize = size === 'small' ? 'text-xs' : 'text-sm'

  return (
    <Avatar className={sizeClasses}>
      <AvatarImage
        src={event.thumbnail_url || event.npo_logo_url || undefined}
        alt={event.name}
      />
      <AvatarFallback
        className={textSize}
        style={{
          backgroundColor: event.primary_color,
          color: 'white',
        }}
      >
        {getInitials(event.name)}
      </AvatarFallback>
    </Avatar>
  )
}

/**
 * EventSwitcher Component
 */
export function EventSwitcher({
  currentEvent,
  events,
  onEventSelect,
}: EventSwitcherProps) {
  const hasMultipleEvents = events.length > 1

  // If only one event, just show the event name without dropdown
  if (!hasMultipleEvents) {
    return (
      <div className="flex items-center gap-3 p-2 max-w-[280px]">
        <EventThumbnail event={currentEvent} />
        <div className="flex flex-col min-w-0 flex-1">
          <span
            className="font-semibold text-sm leading-tight truncate"
            style={{ color: 'var(--event-text-on-background, #000000)' }}
            title={currentEvent.name}
          >
            {currentEvent.name}
          </span>
          <span
            className="text-xs truncate"
            style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}
            title={currentEvent.npo_name}
          >
            {currentEvent.npo_name}
          </span>
        </div>
      </div>
    )
  }

  // Multiple events - show dropdown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="Switch event"
        >
          <EventThumbnail event={currentEvent} />
          <div className="flex flex-col text-left">
            <span
              className="font-semibold text-sm leading-tight"
              style={{ color: 'var(--event-text-on-background, #000000)' }}
            >
              {currentEvent.name}
            </span>
            <span
              className="text-xs"
              style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}
            >
              {currentEvent.npo_name}
            </span>
          </div>
          <ChevronDown
            className="h-4 w-4"
            style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Your Events
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {events.map((event) => {
          const isSelected = event.id === currentEvent.id

          return (
            <DropdownMenuItem
              key={event.id}
              onClick={() => onEventSelect(event)}
              className="flex items-center gap-3 cursor-pointer"
            >
              <EventThumbnail event={event} size="small" />

              <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">
                    {event.name}
                  </span>
                  {event.is_past && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">
                      Past
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>{formatEventDate(event.event_datetime)}</span>
                </div>
              </div>

              {isSelected && (
                <Check className="h-4 w-4 text-primary flex-shrink-0" />
              )}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
