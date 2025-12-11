/**
 * EventSelector Component
 * Dropdown selector for event context in the donor PWA sidebar
 *
 * Business Rules:
 * - Shows events the user is registered for
 * - Shows events the user has admin access to
 * - Selecting an event navigates to that event's page
 * - Shows event name, date, and NPO name
 */

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { useEventContext } from '@/hooks/use-event-context'
import { Calendar, ChevronsUpDown, Shield } from 'lucide-react'

export function EventSelector() {
  const { isMobile } = useSidebar()
  const {
    selectedEventId,
    selectedEventName,
    availableEvents,
    selectEvent,
    hasEvents,
  } = useEventContext()

  // Get selected event's logo if available
  const selectedEvent = availableEvents.find((e) => e.id === selectedEventId)
  const selectedEventLogo = selectedEvent?.logo_url

  // Format date for display
  const formatEventDate = (dateStr?: string | null) => {
    if (!dateStr) return null
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // No events state
  if (!hasEvents) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" className="cursor-default" disabled>
            <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
              <Calendar className="size-4" />
            </div>
            <div className="grid flex-1 text-start text-sm leading-tight">
              <span className="truncate font-semibold">No Events</span>
              <span className="text-muted-foreground truncate text-xs">
                Register for an event
              </span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  // Single event - show non-clickable display
  if (availableEvents.length === 1) {
    const event = availableEvents[0]
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" className="cursor-default" disabled>
            <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center overflow-hidden rounded-lg">
              {selectedEventLogo ? (
                <img
                  src={selectedEventLogo}
                  alt={selectedEventName}
                  className="size-full object-cover"
                />
              ) : (
                <Calendar className="size-4" />
              )}
            </div>
            <div className="grid flex-1 text-start text-sm leading-tight">
              <span className="truncate font-semibold">{event.name}</span>
              <span className="text-muted-foreground truncate text-xs">
                {event.npo_name || formatEventDate(event.event_date) || 'Event'}
              </span>
            </div>
            {event.has_admin_access && (
              <Shield className="text-primary size-4" />
            )}
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  // Multiple events - show dropdown
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center overflow-hidden rounded-lg">
                {selectedEventLogo ? (
                  <img
                    src={selectedEventLogo}
                    alt={selectedEventName}
                    className="size-full object-cover"
                  />
                ) : (
                  <Calendar className="size-4" />
                )}
              </div>
              <div className="grid flex-1 text-start text-sm leading-tight">
                <span className="truncate font-semibold">{selectedEventName}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {selectedEvent?.npo_name ||
                    formatEventDate(selectedEvent?.event_date) ||
                    'Select event'}
                </span>
              </div>
              {selectedEvent?.has_admin_access && (
                <Shield className="text-primary size-4" />
              )}
              <ChevronsUpDown className="ms-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              My Events
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {availableEvents.map((event) => (
              <DropdownMenuItem
                key={event.id}
                onClick={() => selectEvent(event)}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center overflow-hidden rounded-sm border">
                  {event.logo_url ? (
                    <img
                      src={event.logo_url}
                      alt={event.name}
                      className="size-full object-cover"
                    />
                  ) : (
                    <Calendar className="size-4 shrink-0" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 font-medium">
                    {event.name}
                    {event.has_admin_access && (
                      <Shield className="text-primary size-3" />
                    )}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {event.npo_name && <span>{event.npo_name}</span>}
                    {event.npo_name && event.event_date && <span> · </span>}
                    {event.event_date && <span>{formatEventDate(event.event_date)}</span>}
                  </div>
                </div>
                {selectedEventId === event.id && (
                  <span className="text-primary text-xs">✓</span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
