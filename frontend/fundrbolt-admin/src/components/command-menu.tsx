import React, { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { searchService, type SearchResponse } from '@/services/search'
import {
  ArrowRight,
  Building2,
  Calendar,
  Gavel,
  Loader2,
  User,
  UserCheck,
} from 'lucide-react'
import { useSearch } from '@/context/search-provider'
import { useNpoContext } from '@/hooks/use-npo-context'
import { useRoleBasedNav } from '@/hooks/use-role-based-nav'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { iconMap } from './layout/icon-map'
import { ScrollArea } from './ui/scroll-area'

export function CommandMenu() {
  const navigate = useNavigate()
  const { open, setOpen } = useSearch()
  const { navItems, eventNavGroups } = useRoleBasedNav()
  const { selectedNpoId } = useNpoContext()

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  const handleOpenChange = React.useCallback(
    (newOpen: boolean) => {
      setOpen(newOpen)
      if (!newOpen) {
        setQuery('')
        setDebouncedQuery('')
      }
    },
    [setOpen]
  )

  // API search when ≥ 2 characters typed
  const shouldSearch = debouncedQuery.length >= 2
  const { data: apiResults, isLoading: isSearching } = useQuery({
    queryKey: ['command-search', debouncedQuery, selectedNpoId],
    queryFn: () =>
      searchService.search({
        query: debouncedQuery,
        npo_id: selectedNpoId,
        limit: 5,
      }),
    enabled: shouldSearch && open,
    staleTime: 30000,
  })

  const runCommand = React.useCallback(
    (command: () => unknown) => {
      setOpen(false)
      command()
    },
    [setOpen]
  )

  // Build nav groups for page navigation
  const commandGroups: Array<{
    title: string
    items: Array<{ title: string; url: string; icon?: string }>
  }> = []

  for (const group of eventNavGroups) {
    commandGroups.push({
      title: group.title,
      items: group.items.map((item) => ({
        title: item.title,
        url: item.href,
        icon: item.icon,
      })),
    })
  }

  commandGroups.push({
    title: 'Admin',
    items: navItems.map((item) => ({
      title: item.title,
      url: item.href,
      icon: item.icon,
    })),
  })

  const hasApiResults =
    apiResults &&
    (apiResults.users.length > 0 ||
      apiResults.npos.length > 0 ||
      apiResults.events.length > 0 ||
      apiResults.auction_items.length > 0 ||
      apiResults.registrants.length > 0)

  return (
    <CommandDialog modal open={open} onOpenChange={handleOpenChange}>
      <CommandInput
        placeholder='Search pages, users, events…'
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <ScrollArea type='hover' className='h-80 pe-1'>
          <CommandEmpty>
            {isSearching ? (
              <div className='flex items-center justify-center gap-2 py-4'>
                <Loader2 className='size-4 animate-spin' />
                <span className='text-muted-foreground text-sm'>
                  Searching…
                </span>
              </div>
            ) : query.length > 0 && query.length < 2 ? (
              'Type at least 2 characters to search'
            ) : (
              'No results found.'
            )}
          </CommandEmpty>

          {/* Page navigation groups (filtered by cmdk) */}
          {commandGroups.map((group) => (
            <CommandGroup key={group.title} heading={group.title}>
              {group.items.map((item, i) => {
                const IconComponent = item.icon
                  ? iconMap[item.icon as keyof typeof iconMap]
                  : undefined
                return (
                  <CommandItem
                    key={`${item.url}-${i}`}
                    value={`${group.title} ${item.title}`}
                    onSelect={() => {
                      runCommand(() => navigate({ to: item.url }))
                    }}
                  >
                    <div className='flex size-4 items-center justify-center'>
                      {IconComponent ? (
                        <IconComponent className='text-muted-foreground/80 size-3' />
                      ) : (
                        <ArrowRight className='text-muted-foreground/80 size-2' />
                      )}
                    </div>
                    {item.title}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          ))}

          {/* API search results (shown when searching) */}
          {shouldSearch && (isSearching || hasApiResults) && (
            <>
              <CommandSeparator />
              <ApiSearchResults
                results={apiResults ?? null}
                isLoading={isSearching}
                onSelect={runCommand}
                navigate={navigate}
              />
            </>
          )}
        </ScrollArea>
      </CommandList>
    </CommandDialog>
  )
}

/* ─── API Search Results ─── */
function ApiSearchResults({
  results,
  isLoading,
  onSelect,
  navigate,
}: {
  results: SearchResponse | null
  isLoading: boolean
  onSelect: (command: () => unknown) => void
  navigate: ReturnType<typeof useNavigate>
}) {
  if (isLoading && !results) {
    return (
      <CommandGroup heading='Search Results' forceMount>
        <CommandItem forceMount disabled>
          <Loader2 className='mr-2 size-4 animate-spin' />
          Searching…
        </CommandItem>
      </CommandGroup>
    )
  }

  if (!results) return null

  const { users, npos, events, auction_items, registrants } = results

  const hasResults =
    users.length > 0 ||
    npos.length > 0 ||
    events.length > 0 ||
    auction_items.length > 0 ||
    registrants.length > 0

  if (!hasResults) return null

  return (
    <>
      {users.length > 0 && (
        <CommandGroup heading={`Users (${users.length})`} forceMount>
          {users.map((user) => (
            <CommandItem
              key={user.id}
              value={`user ${user.first_name} ${user.last_name} ${user.email}`}
              forceMount
              onSelect={() => {
                onSelect(() => navigate({ to: '/users' }))
              }}
            >
              <User className='text-muted-foreground mr-2 size-4' />
              <div className='flex min-w-0 flex-1 items-center justify-between'>
                <span className='truncate'>
                  {user.first_name} {user.last_name}
                </span>
                <span className='text-muted-foreground ml-2 truncate text-xs'>
                  {user.email}
                </span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      )}

      {npos.length > 0 && (
        <CommandGroup heading={`Organizations (${npos.length})`} forceMount>
          {npos.map((npo) => (
            <CommandItem
              key={npo.id}
              value={`npo ${npo.name}`}
              forceMount
              onSelect={() => {
                onSelect(() =>
                  navigate({ to: '/npos/$npoId', params: { npoId: npo.id } })
                )
              }}
            >
              <Building2 className='text-muted-foreground mr-2 size-4' />
              <span className='truncate'>{npo.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      )}

      {events.length > 0 && (
        <CommandGroup heading={`Events (${events.length})`} forceMount>
          {events.map((event) => (
            <CommandItem
              key={event.id}
              value={`event ${event.name}`}
              forceMount
              onSelect={() => {
                onSelect(() =>
                  navigate({
                    to: '/events/$eventId',
                    params: { eventId: event.id },
                  })
                )
              }}
            >
              <Calendar className='text-muted-foreground mr-2 size-4' />
              <div className='flex min-w-0 flex-1 items-center justify-between'>
                <span className='truncate'>{event.name}</span>
                <span className='text-muted-foreground ml-2 truncate text-xs'>
                  {event.npo_name}
                </span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      )}

      {auction_items.length > 0 && (
        <CommandGroup
          heading={`Auction Items (${auction_items.length})`}
          forceMount
        >
          {auction_items.map((item) => (
            <CommandItem
              key={item.id}
              value={`auction ${item.name}`}
              forceMount
              onSelect={() => {
                onSelect(() =>
                  navigate({
                    to: '/events/$eventId/auction-items/$itemId',
                    params: { eventId: item.event_id, itemId: item.id },
                  })
                )
              }}
            >
              <Gavel className='text-muted-foreground mr-2 size-4' />
              <div className='flex min-w-0 flex-1 items-center justify-between'>
                <span className='truncate'>{item.name}</span>
                <span className='text-muted-foreground ml-2 truncate text-xs'>
                  {item.event_name}
                </span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      )}

      {registrants.length > 0 && (
        <CommandGroup
          heading={`Registrants (${registrants.length})`}
          forceMount
        >
          {registrants.map((reg) => (
            <CommandItem
              key={reg.id}
              value={`registrant ${reg.name ?? ''} ${reg.email ?? ''} ${reg.bidder_number ?? ''}`}
              forceMount
              onSelect={() => {
                onSelect(() =>
                  navigate({
                    to: '/events/$eventId/registrations',
                    params: {
                      eventId: reg.event_slug ?? reg.event_id,
                    },
                  })
                )
              }}
            >
              <UserCheck className='text-muted-foreground mr-2 size-4' />
              <div className='flex min-w-0 flex-1 items-center justify-between'>
                <span className='truncate'>
                  {reg.name ?? reg.email ?? 'Unknown'}
                  {reg.bidder_number != null && (
                    <span className='text-muted-foreground ml-1 text-xs'>
                      #{reg.bidder_number}
                    </span>
                  )}
                </span>
                <span className='text-muted-foreground ml-2 truncate text-xs'>
                  {reg.event_name}
                </span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      )}
    </>
  )
}
