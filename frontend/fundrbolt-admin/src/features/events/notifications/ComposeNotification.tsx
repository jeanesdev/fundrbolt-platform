import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  auctionDashboardService,
  type AuctionItemRow,
} from '@/services/auction-dashboard'
import auctionItemService from '@/services/auctionItemService'
import {
  donorDashboardService,
  type DonorLeaderboardEntry,
} from '@/services/donor-dashboard'
import {
  eventNotificationService,
  type RecipientCriteria,
} from '@/services/eventNotificationService'
import revenueGeneratorService from '@/services/revenueGeneratorService'
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Filter,
  Link as LinkIcon,
  Loader2,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'
import { useEventContextStore } from '@/stores/event-context-store'
import { useNPOContextStore } from '@/stores/npo-context-store'
import { type Attendee, getEventAttendees } from '@/lib/api/admin-attendees'
import { getDonorPwaUrl } from '@/lib/donor-portal'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useEventWorkspace } from '@/features/events/useEventWorkspace'

const MAX_MESSAGE_LENGTH = 500

const RECIPIENT_TYPES = [
  { value: 'all_attendees', label: 'All Attendees' },
  { value: 'all_bidders', label: 'All Bidders' },
  { value: 'specific_table', label: 'Specific Table' },
  { value: 'item', label: 'By Auction Item' },
  { value: 'rg_non_purchasers', label: 'Non-Purchasers of Revenue Generator' },
  { value: 'individual', label: 'Select Recipients' },
] as const

type RecipientSortKey =
  | 'name'
  | 'email'
  | 'checked_in'
  | 'table_number'
  | 'bidder_number'
  | 'total_given_at_event'

type RecipientRow = Attendee & { total_given_at_event: number }

type ItemAudience = 'watchers' | 'bidders'

const DEFAULT_COLUMN_FILTERS: Record<RecipientSortKey, string> = {
  name: '',
  email: '',
  checked_in: '',
  table_number: '',
  bidder_number: '',
  total_given_at_event: '',
}

const RECIPIENT_LEADERBOARD_PAGE_SIZE = 100
const RECIPIENT_ITEM_PAGE_SIZE = 100
const USE_SELECTED_ITEM_LINK_VALUE = '__use_selected_item__'

function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  })
}

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <ChevronsUpDown className='h-3.5 w-3.5 opacity-40' />
  return dir === 'asc' ? (
    <ArrowUp className='h-3.5 w-3.5 text-blue-500' />
  ) : (
    <ArrowDown className='h-3.5 w-3.5 text-blue-500' />
  )
}

function RecipientColumnHeader({
  label,
  column,
  sortKey,
  sortDir,
  filterValue,
  onSort,
  onFilterChange,
  alignRight = false,
  filterPlaceholder,
}: {
  label: string
  column: RecipientSortKey
  sortKey: RecipientSortKey
  sortDir: 'asc' | 'desc'
  filterValue: string
  onSort: (key: RecipientSortKey, dir: 'asc' | 'desc') => void
  onFilterChange: (key: RecipientSortKey, value: string) => void
  alignRight?: boolean
  filterPlaceholder: string
}) {
  const isSorted = sortKey === column
  const hasFilter = filterValue.trim().length > 0

  return (
    <TableHead className='p-0'>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type='button'
            className={`hover:bg-muted/50 flex h-10 w-full items-center gap-1.5 px-4 text-left text-sm font-medium ${alignRight ? 'justify-end text-right' : ''} ${hasFilter ? 'text-primary' : ''}`}
          >
            {hasFilter && <Filter className='h-3.5 w-3.5 shrink-0' />}
            {label}
            <SortIcon active={isSorted} dir={sortDir} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={alignRight ? 'end' : 'start'}
          className='w-56'
        >
          <DropdownMenuLabel className='text-muted-foreground text-xs'>
            Sort
          </DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => onSort(column, 'asc')}>
            <ArrowUp className='mr-2 h-4 w-4' />
            Lowest first
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onSort(column, 'desc')}>
            <ArrowDown className='mr-2 h-4 w-4' />
            Highest first
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className='text-muted-foreground text-xs'>
            Filter
          </DropdownMenuLabel>
          <div className='px-2 py-1.5' onClick={(e) => e.stopPropagation()}>
            <Input
              value={filterValue}
              onChange={(e) => onFilterChange(column, e.target.value)}
              placeholder={filterPlaceholder}
              className='h-8 text-sm'
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
          {hasFilter && (
            <DropdownMenuItem onSelect={() => onFilterChange(column, '')}>
              Clear filter
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </TableHead>
  )
}

function formatItemLabel(item: AuctionItemRow): string {
  const suffix = [
    item.bid_count
      ? `${item.bid_count} bid${item.bid_count === 1 ? '' : 's'}`
      : null,
    item.watcher_count
      ? `${item.watcher_count} watcher${item.watcher_count === 1 ? '' : 's'}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ')
  return suffix ? `${item.title} (${suffix})` : item.title
}

function formatCheckedIn(checkedIn: boolean): string {
  return checkedIn ? 'Yes' : 'No'
}

interface ComposeNotificationProps {
  eventId: string
  initialAudience?: string
  initialItemId?: string
  initialRgItemId?: string
  onSent: () => void
}

export function ComposeNotification({
  eventId,
  initialAudience,
  initialItemId,
  initialRgItemId,
  onSent,
}: ComposeNotificationProps) {
  const [message, setMessage] = useState('')
  const [recipientType, setRecipientType] = useState<RecipientCriteria['type']>(
    initialRgItemId
      ? 'rg_non_purchasers'
      : initialItemId
        ? 'item'
        : 'all_attendees'
  )
  const [tableNumber, setTableNumber] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [channels, setChannels] = useState<Set<string>>(new Set(['in_app']))
  const [isSending, setIsSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [itemId, setItemId] = useState(initialItemId ?? '')
  const [rgItemId, setRgItemId] = useState(initialRgItemId ?? '')
  const [linkItemId, setLinkItemId] = useState(USE_SELECTED_ITEM_LINK_VALUE)
  const [itemAudiences, setItemAudiences] = useState<Set<ItemAudience>>(
    initialAudience === 'outbid_watchers'
      ? new Set<ItemAudience>(['bidders'])
      : new Set<ItemAudience>(['bidders', 'watchers'])
  )
  const [sortKey, setSortKey] = useState<RecipientSortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [columnFilters, setColumnFilters] = useState(DEFAULT_COLUMN_FILTERS)
  const availableEvents = useEventContextStore((state) => state.availableEvents)
  const selectedEventSlug = useEventContextStore(
    (state) => state.selectedEventSlug
  )
  const availableNpos = useNPOContextStore((state) => state.availableNpos)
  const selectedNpoId = useNPOContextStore((state) => state.selectedNpoId)
  const { currentEvent } = useEventWorkspace()

  // Fetch attendees for the individual selection table
  const { data: attendeesData, isLoading: attendeesLoading } = useQuery({
    queryKey: ['event-attendees', eventId, false],
    queryFn: async () => {
      const result = await getEventAttendees(eventId, false)
      if (result instanceof Blob) throw new Error('Expected JSON')
      return result
    },
    enabled: recipientType === 'individual',
  })

  const { data: recipientTotalsData, isLoading: recipientTotalsLoading } =
    useQuery<DonorLeaderboardEntry[]>({
      queryKey: ['event-recipient-totals', eventId],
      queryFn: async () => {
        const firstPage = await donorDashboardService.getLeaderboard({
          event_id: eventId,
          sort_by: 'total_given',
          sort_order: 'desc',
          page: 1,
          per_page: RECIPIENT_LEADERBOARD_PAGE_SIZE,
        })

        const items = [...firstPage.items]
        if (firstPage.pages > 1) {
          const additionalPages = await Promise.all(
            Array.from({ length: firstPage.pages - 1 }, (_, index) =>
              donorDashboardService.getLeaderboard({
                event_id: eventId,
                sort_by: 'total_given',
                sort_order: 'desc',
                page: index + 2,
                per_page: RECIPIENT_LEADERBOARD_PAGE_SIZE,
              })
            )
          )
          for (const pageResult of additionalPages) {
            items.push(...pageResult.items)
          }
        }

        return items
      },
      enabled: recipientType === 'individual',
    })

  const { data: itemOptions, isLoading: itemOptionsLoading } = useQuery({
    queryKey: ['event-notification-items', eventId],
    queryFn: async () => {
      const firstPage = await auctionDashboardService.getItems({
        event_id: eventId,
        page: 1,
        per_page: RECIPIENT_ITEM_PAGE_SIZE,
      })

      const items = [...firstPage.items]
      if (firstPage.total_pages > 1) {
        const additionalPages = await Promise.all(
          Array.from({ length: firstPage.total_pages - 1 }, (_, index) =>
            auctionDashboardService.getItems({
              event_id: eventId,
              page: index + 2,
              per_page: RECIPIENT_ITEM_PAGE_SIZE,
            })
          )
        )
        for (const pageResult of additionalPages) {
          items.push(...pageResult.items)
        }
      }

      return items
    },
    enabled: true,
  })

  const { data: itemImagesById } = useQuery({
    queryKey: ['event-notification-item-images', eventId],
    queryFn: async () => {
      const firstPage = await auctionItemService.listAuctionItems(eventId, {
        page: 1,
        limit: RECIPIENT_ITEM_PAGE_SIZE,
      })

      const items = [...firstPage.items]
      if (firstPage.pagination.pages > 1) {
        const additionalPages = await Promise.all(
          Array.from({ length: firstPage.pagination.pages - 1 }, (_, index) =>
            auctionItemService.listAuctionItems(eventId, {
              page: index + 2,
              limit: RECIPIENT_ITEM_PAGE_SIZE,
            })
          )
        )
        for (const pageResult of additionalPages) {
          items.push(...pageResult.items)
        }
      }

      const imageMap = new Map<string, string | null>()
      for (const item of items) {
        imageMap.set(item.id, item.primary_image_url ?? null)
      }
      return imageMap
    },
    enabled: true,
  })

  const { data: rgItems, isLoading: rgItemsLoading } = useQuery({
    queryKey: ['event-rg-items', eventId],
    queryFn: () => revenueGeneratorService.listItems(eventId),
    enabled: recipientType === 'rg_non_purchasers',
  })

  const resolvedEventSlug = useMemo(() => {
    const matchingEvent = availableEvents.find((event) => event.id === eventId)
    return matchingEvent?.slug ?? selectedEventSlug ?? eventId
  }, [availableEvents, eventId, selectedEventSlug])

  // Resolve NPO slug: prefer global NPO context, fall back to event's own npo_id
  const effectiveNpoId = selectedNpoId || currentEvent.npo_id
  const resolvedNpoSlug = useMemo(() => {
    if (!effectiveNpoId) return ''
    const matchedNpo = availableNpos.find((npo) => npo.id === effectiveNpoId)
    return matchedNpo?.slug ?? effectiveNpoId
  }, [availableNpos, effectiveNpoId])

  const activeLinkItemId =
    linkItemId === USE_SELECTED_ITEM_LINK_VALUE ? itemId : linkItemId
  const activeLinkItem = useMemo(
    () => itemOptions?.find((item) => item.id === activeLinkItemId),
    [activeLinkItemId, itemOptions]
  )

  // Deduplicate attendees by user_id (a user may appear as registrant + guest)
  const uniqueAttendees = useMemo(() => {
    if (!attendeesData?.attendees) return []
    const seen = new Map<string, Attendee>()
    for (const a of attendeesData.attendees) {
      if (
        a.user_id &&
        (a.status === 'confirmed' || a.status === 'active') &&
        !seen.has(a.user_id)
      ) {
        seen.set(a.user_id, a)
      }
    }
    return Array.from(seen.values())
  }, [attendeesData])

  const recipientTotalsByUserId = useMemo(() => {
    const map = new Map<string, number>()
    for (const donor of recipientTotalsData ?? []) {
      map.set(donor.user_id, donor.total_given)
    }
    return map
  }, [recipientTotalsData])

  const recipientRows = useMemo<RecipientRow[]>(
    () =>
      uniqueAttendees.map((attendee) => ({
        ...attendee,
        total_given_at_event: attendee.user_id
          ? (recipientTotalsByUserId.get(attendee.user_id) ?? 0)
          : 0,
      })),
    [recipientTotalsByUserId, uniqueAttendees]
  )

  // Filter and sort
  const filteredAttendees = useMemo(() => {
    const q = searchQuery.toLowerCase()
    const filtered = recipientRows.filter((attendee) => {
      const matchesGlobalSearch = q
        ? attendee.name?.toLowerCase().includes(q) ||
          attendee.email?.toLowerCase().includes(q) ||
          formatCheckedIn(attendee.checked_in ?? false)
            .toLowerCase()
            .includes(q) ||
          String(attendee.table_number ?? '').includes(q) ||
          String(attendee.bidder_number ?? '').includes(q) ||
          formatCurrency(attendee.total_given_at_event)
            .toLowerCase()
            .includes(q)
        : true

      const matchesColumnFilters =
        (!columnFilters.name ||
          attendee.name
            .toLowerCase()
            .includes(columnFilters.name.toLowerCase())) &&
        (!columnFilters.email ||
          attendee.email
            .toLowerCase()
            .includes(columnFilters.email.toLowerCase())) &&
        (!columnFilters.checked_in ||
          formatCheckedIn(attendee.checked_in ?? false)
            .toLowerCase()
            .includes(columnFilters.checked_in.toLowerCase())) &&
        (!columnFilters.table_number ||
          String(attendee.table_number ?? '')
            .toLowerCase()
            .includes(columnFilters.table_number.toLowerCase())) &&
        (!columnFilters.bidder_number ||
          String(attendee.bidder_number ?? '')
            .toLowerCase()
            .includes(columnFilters.bidder_number.toLowerCase())) &&
        (!columnFilters.total_given_at_event ||
          `${formatCurrency(attendee.total_given_at_event)} ${attendee.total_given_at_event.toFixed(2)}`
            .toLowerCase()
            .includes(columnFilters.total_given_at_event.toLowerCase()))

      return matchesGlobalSearch && matchesColumnFilters
    })

    return [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') cmp = (a.name ?? '').localeCompare(b.name ?? '')
      else if (sortKey === 'email')
        cmp = (a.email ?? '').localeCompare(b.email ?? '')
      else if (sortKey === 'checked_in')
        cmp = Number(!!a.checked_in) - Number(!!b.checked_in)
      else if (sortKey === 'table_number')
        cmp = (a.table_number ?? 0) - (b.table_number ?? 0)
      else if (sortKey === 'bidder_number')
        cmp = (a.bidder_number ?? 0) - (b.bidder_number ?? 0)
      else if (sortKey === 'total_given_at_event')
        cmp = a.total_given_at_event - b.total_given_at_event
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [columnFilters, recipientRows, searchQuery, sortKey, sortDir])

  const allFilteredSelected =
    filteredAttendees.length > 0 &&
    filteredAttendees.every((a) => a.user_id && selectedUserIds.has(a.user_id))

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const toggleAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedUserIds((prev) => {
        const next = new Set(prev)
        for (const a of filteredAttendees) {
          if (a.user_id) next.delete(a.user_id)
        }
        return next
      })
    } else {
      setSelectedUserIds((prev) => {
        const next = new Set(prev)
        for (const a of filteredAttendees) {
          if (a.user_id) next.add(a.user_id)
        }
        return next
      })
    }
  }

  const handleColumnSort = (key: RecipientSortKey, dir: 'asc' | 'desc') => {
    setSortKey(key)
    setSortDir(dir)
  }

  const handleColumnFilterChange = (key: RecipientSortKey, value: string) => {
    setColumnFilters((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const toggleChannel = (channel: string) => {
    setChannels((prev) => {
      const next = new Set(prev)
      if (next.has(channel)) {
        next.delete(channel)
      } else {
        next.add(channel)
      }
      return next
    })
  }

  const toggleItemAudience = (audience: ItemAudience) => {
    setItemAudiences((prev) => {
      const next = new Set(prev)
      if (next.has(audience)) next.delete(audience)
      else next.add(audience)
      return next
    })
  }

  const appendMessageLine = (line: string) => {
    setMessage((prev) => {
      const base = prev.trimEnd()
      const next = base ? `${base}\n${line}` : line
      if (next.length > MAX_MESSAGE_LENGTH) {
        toast.error(
          `Can't insert link. Message would exceed ${MAX_MESSAGE_LENGTH} characters.`
        )
        return prev
      }
      return next
    })
  }

  const buildDonorUrl = (path: string, search?: Record<string, string>) => {
    const url = new URL(path, getDonorPwaUrl())
    if (search) {
      for (const [key, value] of Object.entries(search)) {
        url.searchParams.set(key, value)
      }
    }
    return url.toString()
  }

  const insertLinkLine = (
    kind: 'event' | 'checkout' | 'donate_now' | 'item'
  ) => {
    if (!resolvedEventSlug && kind !== 'donate_now') {
      toast.error('Event link is unavailable until event context is loaded.')
      return
    }

    if (kind === 'event') {
      const url = buildDonorUrl(
        `/events/${encodeURIComponent(resolvedEventSlug)}`
      )
      appendMessageLine(`View event details: ${url}`)
      return
    }

    if (kind === 'checkout') {
      const url = buildDonorUrl(
        `/events/${encodeURIComponent(resolvedEventSlug)}/checkout`
      )
      appendMessageLine(`Complete checkout: ${url}`)
      return
    }

    if (kind === 'donate_now') {
      if (!resolvedNpoSlug) {
        toast.error(
          'Donate Now link is unavailable until an organization is selected.'
        )
        return
      }
      const url = buildDonorUrl(
        `/npo/${encodeURIComponent(resolvedNpoSlug)}/donate-now`
      )
      appendMessageLine(`Donate now: ${url}`)
      return
    }

    if (!activeLinkItemId) {
      toast.error('Choose an item first to insert an item link.')
      return
    }

    const url = buildDonorUrl(
      `/events/${encodeURIComponent(resolvedEventSlug)}`,
      {
        item: activeLinkItemId,
      }
    )
    const itemLabel = activeLinkItem?.title ?? 'auction item'
    appendMessageLine(`View ${itemLabel}: ${url}`)
  }

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error('Please enter a message')
      return
    }

    const criteria: RecipientCriteria = { type: recipientType }
    if (recipientType === 'specific_table') {
      const num = parseInt(tableNumber, 10)
      if (isNaN(num) || num < 1) {
        toast.error('Please enter a valid table number')
        return
      }
      criteria.table_number = num
    }
    if (recipientType === 'individual') {
      if (selectedUserIds.size === 0) {
        toast.error('Please select at least one recipient')
        return
      }
      criteria.user_ids = Array.from(selectedUserIds)
    }
    if (recipientType === 'item') {
      if (!itemId) {
        toast.error('Please select an item')
        return
      }
      if (itemAudiences.size === 0) {
        toast.error('Select at least one item audience')
        return
      }
      criteria.item_id = itemId
      criteria.item_audiences = Array.from(itemAudiences)
    }
    if (recipientType === 'rg_non_purchasers') {
      if (!rgItemId) {
        toast.error('Please select a revenue generator')
        return
      }
      criteria.rg_item_id = rgItemId
    }

    setIsSending(true)
    try {
      await eventNotificationService.sendNotification(eventId, {
        message: message.trim(),
        recipient_criteria: criteria,
        channels: Array.from(channels),
      })
      toast.success('Notification sent successfully')
      setMessage('')
      setTableNumber('')
      setSelectedUserIds(new Set())
      setRecipientType('all_attendees')
      setChannels(new Set(['in_app']))
      setItemId('')
      setRgItemId('')
      setLinkItemId(USE_SELECTED_ITEM_LINK_VALUE)
      setItemAudiences(new Set(['bidders', 'watchers']))
      setColumnFilters(DEFAULT_COLUMN_FILTERS)
      onSent()
    } catch {
      toast.error('Failed to send notification')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send Notification</CardTitle>
        <CardDescription>
          Compose and send a custom notification to event donors.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-6'>
        {/* Message */}
        <div className='space-y-2'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <Label htmlFor='notification-message'>Message</Label>
            <div className='flex flex-wrap items-center gap-2'>
              <Select value={linkItemId} onValueChange={setLinkItemId}>
                <SelectTrigger className='h-8 w-[220px]'>
                  <SelectValue placeholder='Item link target (optional)' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={USE_SELECTED_ITEM_LINK_VALUE}>
                    Use selected item above
                  </SelectItem>
                  {itemOptions?.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      <div className='flex items-center gap-2'>
                        {itemImagesById?.get(item.id) ? (
                          <img
                            src={itemImagesById.get(item.id) ?? undefined}
                            alt={item.title}
                            className='h-6 w-6 rounded object-cover'
                          />
                        ) : (
                          <div className='bg-muted text-muted-foreground flex h-6 w-6 items-center justify-center rounded text-[9px]'>
                            No Img
                          </div>
                        )}
                        <span className='max-w-[260px] truncate'>
                          {item.title}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type='button' variant='outline' size='sm'>
                    <LinkIcon className='mr-2 h-4 w-4' />
                    Insert Link
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end' className='w-56'>
                  <DropdownMenuLabel>Page Links</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={() => insertLinkLine('event')}>
                    Event page
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => insertLinkLine('checkout')}>
                    Checkout page
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => insertLinkLine('donate_now')}
                  >
                    Donate Now page
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => insertLinkLine('item')}>
                    Auction item page
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <Textarea
            id='notification-message'
            placeholder='Enter your notification message...'
            value={message}
            onChange={(e) =>
              setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))
            }
            rows={4}
          />
          <p className='text-muted-foreground text-sm'>
            {message.length}/{MAX_MESSAGE_LENGTH} characters
          </p>
        </div>

        {/* Recipient type */}
        <div className='space-y-3'>
          <Label>Recipients</Label>
          <RadioGroup
            value={recipientType}
            onValueChange={(v) => {
              setRecipientType(v as RecipientCriteria['type'])
              if (v !== 'individual') setSelectedUserIds(new Set())
              if (v !== 'item') {
                setItemId('')
                setItemAudiences(new Set(['bidders', 'watchers']))
              }
              if (v !== 'rg_non_purchasers') setRgItemId('')
            }}
          >
            {RECIPIENT_TYPES.map((type) => (
              <div key={type.value} className='flex items-center gap-2'>
                <RadioGroupItem
                  value={type.value}
                  id={`recipient-${type.value}`}
                />
                <Label htmlFor={`recipient-${type.value}`}>{type.label}</Label>
              </div>
            ))}
          </RadioGroup>

          {recipientType === 'specific_table' && (
            <Input
              type='number'
              min={1}
              placeholder='Table number'
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              className='mt-2 max-w-[200px]'
            />
          )}

          {recipientType === 'item' && (
            <div className='mt-3 space-y-3'>
              <div className='space-y-2'>
                <Label htmlFor='recipient-item'>Item</Label>
                <Select value={itemId} onValueChange={setItemId}>
                  <SelectTrigger
                    id='recipient-item'
                    className='w-full max-w-2xl'
                  >
                    <SelectValue placeholder='Choose an item' />
                  </SelectTrigger>
                  <SelectContent>
                    {itemOptionsLoading ? (
                      <SelectItem value='__loading__' disabled>
                        Loading items…
                      </SelectItem>
                    ) : itemOptions && itemOptions.length > 0 ? (
                      itemOptions.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          <div className='flex items-center gap-2'>
                            {itemImagesById?.get(item.id) ? (
                              <img
                                src={itemImagesById.get(item.id) ?? undefined}
                                alt={item.title}
                                className='h-7 w-7 rounded object-cover'
                              />
                            ) : (
                              <div className='bg-muted text-muted-foreground flex h-7 w-7 items-center justify-center rounded text-[10px]'>
                                No Img
                              </div>
                            )}
                            <span className='truncate'>
                              {formatItemLabel(item)}
                            </span>
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value='__empty__' disabled>
                        No auction items found
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <Label>Send to</Label>
                <div className='space-y-2'>
                  <div className='flex items-center gap-2'>
                    <Checkbox
                      id='recipient-item-bidders'
                      checked={itemAudiences.has('bidders')}
                      onCheckedChange={() => toggleItemAudience('bidders')}
                    />
                    <Label htmlFor='recipient-item-bidders'>
                      Everyone who bid on this item
                    </Label>
                  </div>
                  <div className='flex items-center gap-2'>
                    <Checkbox
                      id='recipient-item-watchers'
                      checked={itemAudiences.has('watchers')}
                      onCheckedChange={() => toggleItemAudience('watchers')}
                    />
                    <Label htmlFor='recipient-item-watchers'>
                      Everyone who added it to their watch list
                    </Label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {recipientType === 'rg_non_purchasers' && (
            <div className='mt-3 space-y-2'>
              <Label htmlFor='recipient-rg-item'>Revenue Generator</Label>
              <Select value={rgItemId} onValueChange={setRgItemId}>
                <SelectTrigger
                  id='recipient-rg-item'
                  className='w-full max-w-2xl'
                >
                  <SelectValue placeholder='Choose a revenue generator' />
                </SelectTrigger>
                <SelectContent>
                  {rgItemsLoading ? (
                    <SelectItem value='__loading__' disabled>
                      Loading…
                    </SelectItem>
                  ) : rgItems && rgItems.length > 0 ? (
                    rgItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value='__empty__' disabled>
                      No revenue generators found
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className='text-muted-foreground text-xs'>
                Sends to all registered attendees who have not yet purchased
                this item.
              </p>
            </div>
          )}

          {recipientType === 'individual' && (
            <div className='mt-3 space-y-3'>
              <div className='flex items-center gap-2'>
                <div className='relative flex-1'>
                  <Search className='text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4' />
                  <Input
                    placeholder='Search by name, email, table, or bidder #...'
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className='pl-9'
                  />
                </div>
                <span className='text-muted-foreground text-sm whitespace-nowrap'>
                  {selectedUserIds.size} selected
                </span>
              </div>

              {attendeesLoading || recipientTotalsLoading ? (
                <div className='flex items-center justify-center py-6'>
                  <Loader2 className='text-muted-foreground h-6 w-6 animate-spin' />
                </div>
              ) : (
                <div className='max-h-72 overflow-auto rounded-md border'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className='w-10'>
                          <Checkbox
                            checked={allFilteredSelected}
                            onCheckedChange={toggleAllFiltered}
                            aria-label='Select all visible'
                          />
                        </TableHead>
                        <RecipientColumnHeader
                          label='Name'
                          column='name'
                          sortKey={sortKey}
                          sortDir={sortDir}
                          filterValue={columnFilters.name}
                          onSort={handleColumnSort}
                          onFilterChange={handleColumnFilterChange}
                          filterPlaceholder='Filter names…'
                        />
                        <RecipientColumnHeader
                          label='Email'
                          column='email'
                          sortKey={sortKey}
                          sortDir={sortDir}
                          filterValue={columnFilters.email}
                          onSort={handleColumnSort}
                          onFilterChange={handleColumnFilterChange}
                          filterPlaceholder='Filter emails…'
                        />
                        <RecipientColumnHeader
                          label='Checked In'
                          column='checked_in'
                          sortKey={sortKey}
                          sortDir={sortDir}
                          filterValue={columnFilters.checked_in}
                          onSort={handleColumnSort}
                          onFilterChange={handleColumnFilterChange}
                          filterPlaceholder='Filter yes or no…'
                        />
                        <RecipientColumnHeader
                          label='Total Given'
                          column='total_given_at_event'
                          sortKey={sortKey}
                          sortDir={sortDir}
                          filterValue={columnFilters.total_given_at_event}
                          onSort={handleColumnSort}
                          onFilterChange={handleColumnFilterChange}
                          alignRight
                          filterPlaceholder='Filter totals…'
                        />
                        <RecipientColumnHeader
                          label='Table'
                          column='table_number'
                          sortKey={sortKey}
                          sortDir={sortDir}
                          filterValue={columnFilters.table_number}
                          onSort={handleColumnSort}
                          onFilterChange={handleColumnFilterChange}
                          alignRight
                          filterPlaceholder='Filter tables…'
                        />
                        <RecipientColumnHeader
                          label='Bidder #'
                          column='bidder_number'
                          sortKey={sortKey}
                          sortDir={sortDir}
                          filterValue={columnFilters.bidder_number}
                          onSort={handleColumnSort}
                          onFilterChange={handleColumnFilterChange}
                          alignRight
                          filterPlaceholder='Filter bidder #s…'
                        />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAttendees.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className='text-muted-foreground py-6 text-center'
                          >
                            {searchQuery
                              ? 'No attendees match your search'
                              : 'No attendees found'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAttendees.map((attendee) => (
                          <TableRow
                            key={attendee.user_id}
                            className='cursor-pointer'
                            onClick={() =>
                              attendee.user_id && toggleUser(attendee.user_id)
                            }
                          >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={
                                  !!attendee.user_id &&
                                  selectedUserIds.has(attendee.user_id)
                                }
                                onCheckedChange={() =>
                                  attendee.user_id &&
                                  toggleUser(attendee.user_id)
                                }
                                aria-label={`Select ${attendee.name}`}
                              />
                            </TableCell>
                            <TableCell className='font-medium'>
                              {attendee.name}
                            </TableCell>
                            <TableCell className='text-muted-foreground'>
                              {attendee.email}
                            </TableCell>
                            <TableCell>
                              {formatCheckedIn(attendee.checked_in ?? false)}
                            </TableCell>
                            <TableCell className='text-right font-medium'>
                              {formatCurrency(attendee.total_given_at_event)}
                            </TableCell>
                            <TableCell>
                              {attendee.table_number ?? '—'}
                            </TableCell>
                            <TableCell className='text-right'>
                              {attendee.bidder_number ?? '—'}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Channels */}
        <div className='space-y-3'>
          <Label>Channels</Label>
          <div className='flex flex-wrap gap-4'>
            <div className='flex items-center gap-2'>
              <Checkbox id='ch-in_app' checked disabled />
              <Label htmlFor='ch-in_app' className='text-muted-foreground'>
                In-app
              </Label>
            </div>
            {['push', 'email', 'sms'].map((ch) => (
              <div key={ch} className='flex items-center gap-2'>
                <Checkbox
                  id={`ch-${ch}`}
                  checked={channels.has(ch)}
                  onCheckedChange={() => toggleChannel(ch)}
                />
                <Label htmlFor={`ch-${ch}`} className='capitalize'>
                  {ch === 'sms' ? 'SMS' : ch}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Send */}
        <Button onClick={handleSend} disabled={isSending || !message.trim()}>
          {isSending ? 'Sending...' : 'Send Notification'}
        </Button>
      </CardContent>
    </Card>
  )
}
