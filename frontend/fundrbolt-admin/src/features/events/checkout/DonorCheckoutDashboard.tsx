/**
 * DonorCheckoutDashboard — T044
 *
 * Data table showing all registered donors and their checkout status.
 * Supports search, column header menus for sort/filter, card/table view toggle.
 */
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Filter,
  Loader2,
  Search,
  Settings2,
  UserCheck,
} from 'lucide-react'
import {
  type DonorCheckoutStatus,
  type DonorCheckoutSummary,
  listDonorCheckoutStatus,
} from '@/lib/api/checkout'
import { useViewPreference } from '@/hooks/use-view-preference'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataTableViewToggle } from '@/components/data-table/view-toggle'
import { DonorCheckoutItemEditor } from './DonorCheckoutItemEditor'
import { SendCheckoutNotification } from './SendCheckoutNotification'

interface DonorCheckoutDashboardProps {
  eventId: string
}

type SortKey = 'name' | 'status' | 'items' | 'total'
type StatusFilter = 'all' | DonorCheckoutStatus

function StatusBadge({ status }: { status: DonorCheckoutStatus }) {
  if (status === 'complete')
    return (
      <Badge className='bg-green-100 text-green-700 hover:bg-green-100'>
        Complete
      </Badge>
    )
  if (status === 'in_progress')
    return (
      <Badge className='bg-yellow-100 text-yellow-700 hover:bg-yellow-100'>
        In Progress
      </Badge>
    )
  return <Badge variant='secondary'>Not Started</Badge>
}

function fmtCurrency(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  })
}

function SortIcon({
  colKey,
  sortKey,
  sortDir,
}: {
  colKey: SortKey
  sortKey: SortKey
  sortDir: 'asc' | 'desc'
}) {
  if (sortKey !== colKey)
    return <ChevronsUpDown className='h-3.5 w-3.5 opacity-40' />
  return sortDir === 'asc' ? (
    <ArrowUp className='h-3.5 w-3.5 text-blue-500' />
  ) : (
    <ArrowDown className='h-3.5 w-3.5 text-blue-500' />
  )
}

export function DonorCheckoutDashboard({
  eventId,
}: DonorCheckoutDashboardProps) {
  const [editingDonor, setEditingDonor] = useState<DonorCheckoutSummary | null>(
    null
  )
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [viewMode, setViewMode] = useViewPreference('donor-checkout')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['checkout-donors', eventId],
    queryFn: () => listDonorCheckoutStatus(eventId, { page: 1, per_page: 500 }),
  })

  function setSort(key: SortKey, dir: 'asc' | 'desc') {
    setSortKey(key)
    setSortDir(dir)
  }

  const displayed = useMemo(() => {
    if (!data) return []
    let donors = [...data.donors]

    const q = search.trim().toLowerCase()
    if (q) {
      donors = donors.filter(
        (d) =>
          `${d.first_name} ${d.last_name}`.toLowerCase().includes(q) ||
          d.email.toLowerCase().includes(q)
      )
    }

    if (statusFilter !== 'all')
      donors = donors.filter((d) => d.status === statusFilter)

    const statusOrder: Record<DonorCheckoutStatus, number> = {
      not_started: 0,
      in_progress: 1,
      complete: 2,
    }

    donors.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') {
        cmp = `${a.first_name} ${a.last_name}`.localeCompare(
          `${b.first_name} ${b.last_name}`
        )
      } else if (sortKey === 'status') {
        cmp = statusOrder[a.status] - statusOrder[b.status]
      } else if (sortKey === 'items') {
        cmp = a.item_count - b.item_count
      } else {
        cmp = a.total_cents - b.total_cents
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return donors
  }, [data, search, statusFilter, sortKey, sortDir])

  const counts = data?.counts
  const hasData = !isLoading && !isError && data && data.donors.length > 0

  return (
    <div className='space-y-4'>
      {/* Summary counts */}
      {counts && (
        <div className='flex flex-wrap gap-3 text-sm'>
          <span className='text-muted-foreground'>
            Not Started:{' '}
            <span className='text-foreground font-medium'>
              {counts.not_started}
            </span>
          </span>
          <span className='text-muted-foreground'>
            In Progress:{' '}
            <span className='font-medium text-yellow-700'>
              {counts.in_progress}
            </span>
          </span>
          <span className='text-muted-foreground'>
            Complete:{' '}
            <span className='font-medium text-green-700'>
              {counts.complete}
            </span>
          </span>
        </div>
      )}

      {/* Notification actions */}
      <SendCheckoutNotification eventId={eventId} />

      {/* Search + filter + view toggle toolbar */}
      {hasData && (
        <div className='flex flex-wrap items-center gap-2'>
          <div className='relative min-w-0 flex-1'>
            <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
            <Input
              placeholder='Search donor name or email…'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className='h-8 pl-9 text-sm'
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant='outline'
                size='sm'
                className={`h-8 gap-1.5 ${statusFilter !== 'all' ? 'border-blue-300 text-blue-600' : ''}`}
              >
                <Filter className='h-3.5 w-3.5' />
                {statusFilter === 'all'
                  ? 'Status'
                  : statusFilter === 'not_started'
                    ? 'Not Started'
                    : statusFilter === 'in_progress'
                      ? 'In Progress'
                      : 'Complete'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-44'>
              <DropdownMenuLabel className='text-muted-foreground text-xs'>
                Filter by status
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as StatusFilter)}
              >
                <DropdownMenuRadioItem value='all'>All</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value='not_started'>
                  Not Started
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value='in_progress'>
                  In Progress
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value='complete'>
                  Complete
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <DataTableViewToggle value={viewMode} onChange={setViewMode} />
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className='flex justify-center py-8'>
          <Loader2 className='text-muted-foreground h-6 w-6 animate-spin' />
        </div>
      ) : isError ? (
        <div className='text-muted-foreground py-8 text-center text-sm'>
          Failed to load donors.
        </div>
      ) : !data || data.donors.length === 0 ? (
        <div className='text-muted-foreground flex flex-col items-center py-8 text-sm'>
          <UserCheck className='mb-2 h-8 w-8' />
          No donors found.
        </div>
      ) : displayed.length === 0 ? (
        <div className='text-muted-foreground py-8 text-center text-sm'>
          No donors match the current filters.
        </div>
      ) : viewMode === 'card' ? (
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
          {displayed.map((donor) => (
            <div
              key={donor.user_id}
              className='bg-card flex flex-col gap-3 rounded-lg border p-4 shadow-sm'
            >
              <div className='flex items-start justify-between gap-2'>
                <div className='min-w-0'>
                  <p className='truncate font-medium'>
                    {donor.first_name} {donor.last_name}
                  </p>
                  <p className='text-muted-foreground truncate text-xs'>
                    {donor.email}
                  </p>
                </div>
                <StatusBadge status={donor.status} />
              </div>
              <div className='flex items-center justify-between'>
                <span className='text-muted-foreground text-sm'>
                  {donor.item_count} item{donor.item_count !== 1 ? 's' : ''}
                </span>
                <span className='font-semibold'>
                  {fmtCurrency(donor.total_cents)}
                </span>
              </div>
              <Button
                size='sm'
                variant='outline'
                className='w-full bg-white text-gray-900 hover:bg-gray-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100'
                onClick={() => setEditingDonor(donor)}
              >
                <Settings2 className='mr-1.5 h-3.5 w-3.5' />
                Manage
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {/* Name column */}
              <TableHead className='p-0'>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className='hover:bg-muted/50 flex h-10 w-full items-center gap-1.5 px-4 text-left text-sm font-medium'>
                      Name
                      <SortIcon
                        colKey='name'
                        sortKey={sortKey}
                        sortDir={sortDir}
                      />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='start' className='w-40'>
                    <DropdownMenuLabel className='text-muted-foreground text-xs'>
                      Sort
                    </DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => setSort('name', 'asc')}>
                      <ArrowUp className='mr-2 h-3.5 w-3.5' /> A → Z
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSort('name', 'desc')}>
                      <ArrowDown className='mr-2 h-3.5 w-3.5' /> Z → A
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableHead>

              {/* Email — no header menu, hidden on mobile */}
              <TableHead className='hidden sm:table-cell'>Email</TableHead>

              {/* Status column — sort + filter */}
              <TableHead className='p-0'>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className='hover:bg-muted/50 flex h-10 w-full items-center gap-1.5 px-4 text-left text-sm font-medium'>
                      Status
                      {statusFilter !== 'all' ? (
                        <Filter className='h-3.5 w-3.5 text-blue-500' />
                      ) : (
                        <SortIcon
                          colKey='status'
                          sortKey={sortKey}
                          sortDir={sortDir}
                        />
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='start' className='w-48'>
                    <DropdownMenuLabel className='text-muted-foreground text-xs'>
                      Sort
                    </DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => setSort('status', 'asc')}>
                      <ArrowUp className='mr-2 h-3.5 w-3.5' /> Not Started first
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSort('status', 'desc')}>
                      <ArrowDown className='mr-2 h-3.5 w-3.5' /> Complete first
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className='text-muted-foreground text-xs'>
                      Filter
                    </DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={statusFilter}
                      onValueChange={(v) => setStatusFilter(v as StatusFilter)}
                    >
                      <DropdownMenuRadioItem value='all'>
                        All
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value='not_started'>
                        Not Started
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value='in_progress'>
                        In Progress
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value='complete'>
                        Complete
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableHead>

              {/* Items column */}
              <TableHead className='p-0 text-right'>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className='hover:bg-muted/50 flex h-10 w-full items-center justify-end gap-1.5 px-4 text-right text-sm font-medium'>
                      Items
                      <SortIcon
                        colKey='items'
                        sortKey={sortKey}
                        sortDir={sortDir}
                      />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='end' className='w-44'>
                    <DropdownMenuLabel className='text-muted-foreground text-xs'>
                      Sort
                    </DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => setSort('items', 'desc')}>
                      <ArrowDown className='mr-2 h-3.5 w-3.5' /> Most first
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSort('items', 'asc')}>
                      <ArrowUp className='mr-2 h-3.5 w-3.5' /> Fewest first
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableHead>

              {/* Total column */}
              <TableHead className='p-0 text-right'>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className='hover:bg-muted/50 flex h-10 w-full items-center justify-end gap-1.5 px-4 text-right text-sm font-medium'>
                      Total
                      <SortIcon
                        colKey='total'
                        sortKey={sortKey}
                        sortDir={sortDir}
                      />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='end' className='w-44'>
                    <DropdownMenuLabel className='text-muted-foreground text-xs'>
                      Sort
                    </DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => setSort('total', 'desc')}>
                      <ArrowDown className='mr-2 h-3.5 w-3.5' /> Highest first
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSort('total', 'asc')}>
                      <ArrowUp className='mr-2 h-3.5 w-3.5' /> Lowest first
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableHead>

              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayed.map((donor) => (
              <TableRow
                key={donor.user_id}
                className='cursor-pointer'
                onClick={() => setEditingDonor(donor)}
              >
                <TableCell className='font-medium'>
                  {donor.first_name} {donor.last_name}
                </TableCell>
                <TableCell className='text-muted-foreground hidden text-sm sm:table-cell'>
                  {donor.email}
                </TableCell>
                <TableCell>
                  <StatusBadge status={donor.status} />
                </TableCell>
                <TableCell className='text-right'>{donor.item_count}</TableCell>
                <TableCell className='text-right'>
                  {fmtCurrency(donor.total_cents)}
                </TableCell>
                <TableCell>
                  <Button
                    variant='outline'
                    size='sm'
                    className='bg-white text-gray-900 hover:bg-gray-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100'
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingDonor(donor)
                    }}
                  >
                    <Settings2 className='mr-1.5 h-3.5 w-3.5' />
                    Manage
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Item editor side panel */}
      {editingDonor && (
        <DonorCheckoutItemEditor
          eventId={eventId}
          userId={editingDonor.user_id}
          donorInfo={editingDonor}
          onClose={() => setEditingDonor(null)}
        />
      )}
    </div>
  )
}
