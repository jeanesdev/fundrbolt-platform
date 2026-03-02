/**
 * EventSelector Component
 * Dropdown selector for event context with smart defaults and search functionality
 *
 * Business Rules:
 * - Auto-selects event using smart defaults: Active → Upcoming → Past
 * - Manual selection persists across navigation until NPO changes
 * - Shows search input when 10+ events (FR-006a)
 * - Displays event logo or initial avatar fallback
 * - Filtered by currently selected NPO
 */

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { InitialAvatar } from '@/components/ui/initial-avatar'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { useEventContext } from '@/hooks/use-event-context'
import { Calendar, ChevronsUpDown } from 'lucide-react'
import { useState } from 'react'

export function EventSelector() {
  const { isMobile } = useSidebar()
  const {
    selectedEventId,
    selectedEventName,
    availableEvents,
    isLoading,
    selectEvent,
    isEventSelected,
    shouldShowSearch,
  } = useEventContext()

  // Get selected event details
  const selectedEvent = availableEvents.find((e) => e.id === selectedEventId)

  const [searchQuery, setSearchQuery] = useState('')

  // Filter events by search query (case-insensitive)
  const filteredEvents = shouldShowSearch && searchQuery
    ? availableEvents.filter((event) =>
      event.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : availableEvents

  // If no events available, show empty state
  if (!isLoading && availableEvents.length === 0) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size='lg'
            className='cursor-default opacity-50'
            disabled
          >
            <div className='bg-sidebar-accent text-sidebar-accent-foreground flex aspect-square size-8 items-center justify-center rounded-lg'>
              <Calendar className='size-4' />
            </div>
            <div className='grid flex-1 text-start text-sm leading-tight'>
              <span className='truncate font-medium text-muted-foreground'>
                No Events
              </span>
              <span className='truncate text-xs text-muted-foreground'>
                Create an event to get started
              </span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  // Show loading state
  if (isLoading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size='lg'
            className='cursor-default'
            disabled
          >
            <div className='bg-sidebar-accent text-sidebar-accent-foreground flex aspect-square size-8 items-center justify-center rounded-lg'>
              <Calendar className='size-4' />
            </div>
            <div className='grid flex-1 text-start text-sm leading-tight'>
              <span className='truncate font-medium'>Loading events...</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size='lg'
              className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
            >
              <div className='bg-sidebar-accent text-sidebar-accent-foreground flex aspect-square size-8 items-center justify-center rounded-lg overflow-hidden'>
                {selectedEvent ? (
                  <InitialAvatar
                    name={selectedEventName || 'Event'}
                    brandingPrimaryColor={null}
                    size='sm'
                    className='h-full w-full rounded-lg'
                  />
                ) : (
                  <Calendar className='size-4' />
                )}
              </div>
              <div className='grid flex-1 text-start text-sm leading-tight'>
                <span className='truncate font-semibold'>
                  {selectedEventName || 'Select Event'}
                </span>
                <span className='truncate text-xs text-muted-foreground'>
                  {isEventSelected ? 'Event Context' : 'No event selected'}
                </span>
              </div>
              <ChevronsUpDown className='ms-auto' />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className='w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg p-0'
            align='start'
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            {shouldShowSearch ? (
              // Use Command component with search for 10+ events
              <Command>
                <CommandInput
                  placeholder='Search events...'
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                />
                <CommandList>
                  <CommandEmpty>No events found.</CommandEmpty>
                  <CommandGroup>
                    {filteredEvents.map((event) => (
                      <CommandItem
                        key={event.id}
                        onSelect={() => {
                          selectEvent(event.id, event.name, event.slug)
                          setSearchQuery('') // Clear search after selection
                        }}
                        className='gap-2 p-2'
                      >
                        <div className='flex size-6 items-center justify-center rounded-sm border overflow-hidden'>
                          <InitialAvatar
                            name={event.name}
                            brandingPrimaryColor={null}
                            size='sm'
                            className='h-full w-full rounded-sm'
                          />
                        </div>
                        <div className='flex-1 min-w-0'>
                          <div className='font-medium truncate'>{event.name}</div>
                          <div className='text-muted-foreground text-xs'>
                            {event.status === 'active' && '🟢 Active'}
                            {event.status === 'draft' && '📝 Draft'}
                            {event.status === 'closed' && '🔒 Closed'}
                          </div>
                        </div>
                        {selectedEventId === event.id && (
                          <span className='text-primary text-xs'>✓</span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            ) : (
              // Simple dropdown for fewer than 10 events
              <>
                <DropdownMenuLabel className='text-muted-foreground text-xs px-2 py-1.5'>
                  Select Event
                </DropdownMenuLabel>
                {availableEvents.map((event) => (
                  <DropdownMenuItem
                    key={event.id}
                    onClick={() => selectEvent(event.id, event.name, event.slug)}
                    className='gap-2 p-2'
                  >
                    <div className='flex size-6 items-center justify-center rounded-sm border overflow-hidden'>
                      <InitialAvatar
                        name={event.name}
                        brandingPrimaryColor={null}
                        size='sm'
                        className='h-full w-full rounded-sm'
                      />
                    </div>
                    <div className='flex-1 min-w-0'>
                      <div className='font-medium truncate'>{event.name}</div>
                      <div className='text-muted-foreground text-xs'>
                        {event.status === 'active' && '🟢 Active'}
                        {event.status === 'draft' && '📝 Draft'}
                        {event.status === 'closed' && '🔒 Closed'}
                      </div>
                    </div>
                    {selectedEventId === event.id && (
                      <span className='text-primary text-xs'>✓</span>
                    )}
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
