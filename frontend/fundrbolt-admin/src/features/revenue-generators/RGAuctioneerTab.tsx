import { useEffect, useMemo, useState } from 'react'
import revenueGeneratorService, {
  type RGEntryRow,
  type RGItem,
  type RGWinnerSelection,
} from '@/services/revenueGeneratorService'
import { ArrowLeft, Shuffle, Ticket, Trophy, Users } from 'lucide-react'
import { useViewPreference } from '@/hooks/use-view-preference'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { BidderAvatar } from '@/components/bidder-avatar'
import { DataTableViewToggle } from '@/components/data-table/view-toggle'
import {
  FilterableColumnHeader,
  type SortDir,
} from '@/features/quick-entry/components/FilterableColumnHeader'

interface Props {
  eventId: string
}

const fmtCurrency = (value: number | null | undefined) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value ?? 0)

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className='shadow-none'>
      <CardContent className='px-3 py-2'>
        <p className='text-muted-foreground text-xs leading-none'>{label}</p>
        <p className='mt-0.5 text-sm leading-tight font-semibold'>{value}</p>
      </CardContent>
    </Card>
  )
}

// ─── Detail view for a single RG item ───────────────────────────────────────

type EntriesSortField =
  | 'bidder'
  | 'donor'
  | 'table'
  | 'entries'
  | 'total_paid'
  | 'last_entry'

type WinnerSortField = 'winner' | 'bidder' | 'method' | 'drawn_at'

function RGItemDetail({
  eventId,
  item,
  onBack,
  onWinnerDrawn,
}: {
  eventId: string
  item: RGItem
  onBack: () => void
  onWinnerDrawn: (updatedItem: RGItem) => void
}) {
  const [entries, setEntries] = useState<RGEntryRow[]>([])
  const [totalEntries, setTotalEntries] = useState(0)
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [winnerHistory, setWinnerHistory] = useState<RGWinnerSelection[]>([])
  const [loading, setLoading] = useState(true)
  const [drawing, setDrawing] = useState(false)
  const [drawError, setDrawError] = useState<string | null>(null)
  const [justDrawn, setJustDrawn] = useState<RGWinnerSelection | null>(null)

  // Entries table sort/filter/view
  const [entriesViewMode, setEntriesViewMode] =
    useViewPreference('rg-entries-detail')
  const [entriesFilters, setEntriesFilters] = useState({
    bidder: '',
    donor: '',
    table: '',
    entries: '',
    total_paid: '',
    last_entry: '',
  })
  const [entriesSort, setEntriesSort] = useState<{
    field: EntriesSortField
    dir: SortDir
  } | null>(null)

  const toggleEntriesSort = (field: EntriesSortField) => {
    setEntriesSort((prev) => {
      if (prev?.field === field)
        return prev.dir === 'asc'
          ? { field, dir: 'desc' }
          : prev.dir === 'desc'
            ? null
            : { field, dir: 'asc' }
      return { field, dir: 'asc' }
    })
  }

  // Winner history table sort/filter/view
  const [winnerViewMode, setWinnerViewMode] =
    useViewPreference('rg-winner-history')
  const [winnerFilters, setWinnerFilters] = useState({
    winner: '',
    bidder: '',
    method: '',
    drawn_at: '',
  })
  const [winnerSort, setWinnerSort] = useState<{
    field: WinnerSortField
    dir: SortDir
  } | null>(null)

  const toggleWinnerSort = (field: WinnerSortField) => {
    setWinnerSort((prev) => {
      if (prev?.field === field)
        return prev.dir === 'asc'
          ? { field, dir: 'desc' }
          : prev.dir === 'desc'
            ? null
            : { field, dir: 'asc' }
      return { field, dir: 'asc' }
    })
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([
      revenueGeneratorService.listEntries(eventId, item.id),
      revenueGeneratorService.getWinnerHistory(eventId, item.id),
    ])
      .then(([entriesData, historyData]) => {
        setEntries(entriesData.entries)
        setTotalEntries(entriesData.total_entries)
        setTotalRevenue(entriesData.total_revenue)
        setWinnerHistory(historyData)
      })
      .finally(() => setLoading(false))
  }, [eventId, item.id])

  const filteredAndSortedEntries = useMemo(() => {
    const norm = (s: string | null | undefined) => (s ?? '').toLowerCase()
    let rows = entries.filter((row) => {
      if (
        entriesFilters.bidder &&
        !String(row.bidder_number).includes(entriesFilters.bidder)
      )
        return false
      if (
        entriesFilters.donor &&
        !norm(row.donor_name).includes(entriesFilters.donor.toLowerCase())
      )
        return false
      if (entriesFilters.table) {
        const tableStr =
          row.table_number != null ? String(row.table_number) : ''
        if (!tableStr.includes(entriesFilters.table)) return false
      }
      if (
        entriesFilters.entries &&
        !String(row.entry_count).includes(entriesFilters.entries)
      )
        return false
      if (
        entriesFilters.total_paid &&
        !String(row.total_paid).includes(entriesFilters.total_paid)
      )
        return false
      if (entriesFilters.last_entry) {
        const timeText = new Date(row.last_purchased_at).toLocaleString()
        if (
          !timeText
            .toLowerCase()
            .includes(entriesFilters.last_entry.toLowerCase())
        )
          return false
      }
      return true
    })

    if (entriesSort) {
      rows = [...rows].sort((a, b) => {
        let cmp = 0
        if (entriesSort.field === 'bidder')
          cmp = a.bidder_number - b.bidder_number
        else if (entriesSort.field === 'donor')
          cmp = (a.donor_name ?? '').localeCompare(b.donor_name ?? '')
        else if (entriesSort.field === 'table')
          cmp = (a.table_number ?? -1) - (b.table_number ?? -1)
        else if (entriesSort.field === 'entries')
          cmp = a.entry_count - b.entry_count
        else if (entriesSort.field === 'total_paid')
          cmp = Number(a.total_paid) - Number(b.total_paid)
        else if (entriesSort.field === 'last_entry')
          cmp =
            new Date(a.last_purchased_at).getTime() -
            new Date(b.last_purchased_at).getTime()
        return entriesSort.dir === 'asc' ? cmp : -cmp
      })
    }
    return rows
  }, [entries, entriesFilters, entriesSort])

  const filteredAndSortedWinners = useMemo(() => {
    const norm = (s: string | null | undefined) => (s ?? '').toLowerCase()
    let rows = winnerHistory.filter((row) => {
      if (
        winnerFilters.winner &&
        !norm(row.winner_name).includes(winnerFilters.winner.toLowerCase())
      )
        return false
      if (
        winnerFilters.bidder &&
        !String(row.bidder_number).includes(winnerFilters.bidder)
      )
        return false
      if (
        winnerFilters.method &&
        !row.selection_method
          .toLowerCase()
          .includes(winnerFilters.method.toLowerCase())
      )
        return false
      if (winnerFilters.drawn_at) {
        const timeText = new Date(row.selected_at).toLocaleString()
        if (
          !timeText.toLowerCase().includes(winnerFilters.drawn_at.toLowerCase())
        )
          return false
      }
      return true
    })

    if (winnerSort) {
      rows = [...rows].sort((a, b) => {
        let cmp = 0
        if (winnerSort.field === 'winner')
          cmp = a.winner_name.localeCompare(b.winner_name)
        else if (winnerSort.field === 'bidder')
          cmp = a.bidder_number - b.bidder_number
        else if (winnerSort.field === 'method')
          cmp = a.selection_method.localeCompare(b.selection_method)
        else if (winnerSort.field === 'drawn_at')
          cmp =
            new Date(a.selected_at).getTime() -
            new Date(b.selected_at).getTime()
        return winnerSort.dir === 'asc' ? cmp : -cmp
      })
    }
    return rows
  }, [winnerHistory, winnerFilters, winnerSort])

  const handleDraw = async () => {
    setDrawing(true)
    setDrawError(null)
    try {
      const result = await revenueGeneratorService.drawRandomWinner(
        eventId,
        item.id
      )
      setJustDrawn(result)
      setWinnerHistory((prev) => [result, ...prev])
      // Refresh entries to pick up any changes
      const entriesData = await revenueGeneratorService.listEntries(
        eventId,
        item.id
      )
      setEntries(entriesData.entries)
      setTotalEntries(entriesData.total_entries)
      setTotalRevenue(entriesData.total_revenue)
      onWinnerDrawn({
        ...item,
        current_winner_name: result.winner_name,
        current_winner_bidder_number: result.bidder_number,
      })
    } catch {
      setDrawError('Failed to draw a winner. Please try again.')
    } finally {
      setDrawing(false)
    }
  }

  const uniqueBidderCount = entries.length

  return (
    <div className='space-y-4'>
      {/* Back + header */}
      <div className='flex items-start gap-3'>
        <Button variant='ghost' size='sm' onClick={onBack} className='shrink-0'>
          <ArrowLeft className='mr-1.5 h-4 w-4' />
          Back
        </Button>
        <div className='min-w-0'>
          <h3 className='text-xl font-semibold'>{item.name}</h3>
          {item.description && (
            <p className='text-muted-foreground text-sm'>{item.description}</p>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className='grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4'>
        <SummaryCard
          label='Price per Entry'
          value={fmtCurrency(item.price_per_entry)}
        />
        <SummaryCard label='Total Entries' value={`${totalEntries}`} />
        <SummaryCard label='Unique Bidders' value={`${uniqueBidderCount}`} />
        <SummaryCard label='Total Raised' value={fmtCurrency(totalRevenue)} />
      </div>

      {/* Current winner banner */}
      {(justDrawn ?? item.current_winner_name) ? (
        <Card
          className={
            justDrawn
              ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20'
              : ''
          }
        >
          <CardContent className='flex items-center gap-3 py-3'>
            <Trophy className='h-5 w-5 shrink-0 text-yellow-500' />
            <div>
              <p className='text-sm font-semibold'>
                Current Winner:{' '}
                {item.current_winner_name ?? justDrawn?.winner_name}
                {(item.current_winner_bidder_number ??
                  justDrawn?.bidder_number) != null && (
                  <Badge variant='outline' className='ml-2'>
                    #
                    {item.current_winner_bidder_number ??
                      justDrawn?.bidder_number}
                  </Badge>
                )}
              </p>
              {justDrawn && (
                <p className='text-muted-foreground text-xs'>
                  Just drawn —{' '}
                  {new Date(justDrawn.selected_at).toLocaleString()}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Draw winner action */}
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Select Winner</CardTitle>
          <CardDescription>
            Randomly draw a winner weighted by number of entries purchased.
          </CardDescription>
        </CardHeader>
        <CardContent className='flex flex-col gap-3 sm:flex-row sm:items-center'>
          <Button
            onClick={() => void handleDraw()}
            disabled={drawing || totalEntries === 0}
            size='lg'
            className='w-full sm:w-auto'
          >
            <Shuffle className='mr-2 h-4 w-4' />
            {drawing ? 'Drawing…' : 'Draw Random Winner'}
          </Button>
          {totalEntries === 0 && (
            <p className='text-muted-foreground text-sm'>
              No entries yet — add some first.
            </p>
          )}
          {drawError && <p className='text-destructive text-sm'>{drawError}</p>}
        </CardContent>
      </Card>

      {/* Entries table */}
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between gap-2'>
            <div>
              <CardTitle className='text-base'>
                <div className='flex items-center gap-2'>
                  <Users className='h-4 w-4' />
                  Entries by Bidder
                </div>
              </CardTitle>
              <CardDescription>
                {totalEntries} total entries across {uniqueBidderCount} bidder
                {uniqueBidderCount !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            <DataTableViewToggle
              value={entriesViewMode}
              onChange={setEntriesViewMode}
            />
          </div>
        </CardHeader>
        <CardContent className='p-0'>
          {loading ? (
            <div className='space-y-2 p-4'>
              <Skeleton className='h-8 w-full' />
              <Skeleton className='h-8 w-full' />
              <Skeleton className='h-8 w-full' />
            </div>
          ) : entries.length === 0 ? (
            <p className='text-muted-foreground px-4 py-6 text-sm'>
              No entries yet.
            </p>
          ) : entriesViewMode === 'card' ? (
            <div className='grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3'>
              {filteredAndSortedEntries.length === 0 ? (
                <p className='text-muted-foreground col-span-full text-sm'>
                  No entries match the current filters.
                </p>
              ) : (
                filteredAndSortedEntries.map((row) => (
                  <div
                    key={row.bidder_number}
                    className='space-y-1.5 rounded-md border p-3'
                  >
                    <div className='flex items-center justify-between gap-2'>
                      <Badge variant='outline'>#{row.bidder_number}</Badge>
                      {(item.current_winner_bidder_number ===
                        row.bidder_number ||
                        justDrawn?.bidder_number === row.bidder_number) && (
                        <Trophy className='h-3.5 w-3.5 text-yellow-500' />
                      )}
                    </div>
                    <div className='flex items-center gap-2'>
                      <BidderAvatar
                        name={row.donor_name}
                        imageUrl={row.profile_picture_url}
                      />
                      <span className='text-sm font-medium'>
                        {row.donor_name}
                      </span>
                    </div>
                    <div className='flex items-center justify-between text-sm'>
                      <span className='font-semibold'>
                        {fmtCurrency(row.total_paid)}
                      </span>
                      <span className='text-muted-foreground'>
                        {row.entry_count} entr
                        {row.entry_count !== 1 ? 'ies' : 'y'}
                        {row.table_number != null
                          ? ` · T#${row.table_number}`
                          : ''}
                      </span>
                    </div>
                    <p className='text-muted-foreground text-xs'>
                      Last: {new Date(row.last_purchased_at).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <FilterableColumnHeader
                        label='Bidder #'
                        sortField='bidder'
                        currentSort={entriesSort}
                        onSort={(f) => toggleEntriesSort(f as EntriesSortField)}
                        filterValue={entriesFilters.bidder}
                        onFilterChange={(v) =>
                          setEntriesFilters((p) => ({ ...p, bidder: v }))
                        }
                      />
                    </TableHead>
                    <TableHead>
                      <FilterableColumnHeader
                        label='Donor'
                        sortField='donor'
                        currentSort={entriesSort}
                        onSort={(f) => toggleEntriesSort(f as EntriesSortField)}
                        filterValue={entriesFilters.donor}
                        onFilterChange={(v) =>
                          setEntriesFilters((p) => ({ ...p, donor: v }))
                        }
                      />
                    </TableHead>
                    <TableHead>
                      <FilterableColumnHeader
                        label='Table'
                        sortField='table'
                        currentSort={entriesSort}
                        onSort={(f) => toggleEntriesSort(f as EntriesSortField)}
                        filterValue={entriesFilters.table}
                        onFilterChange={(v) =>
                          setEntriesFilters((p) => ({ ...p, table: v }))
                        }
                      />
                    </TableHead>
                    <TableHead className='text-right'>
                      <FilterableColumnHeader
                        label='Entries'
                        sortField='entries'
                        currentSort={entriesSort}
                        onSort={(f) => toggleEntriesSort(f as EntriesSortField)}
                        filterValue={entriesFilters.entries}
                        onFilterChange={(v) =>
                          setEntriesFilters((p) => ({ ...p, entries: v }))
                        }
                      />
                    </TableHead>
                    <TableHead className='text-right'>
                      <FilterableColumnHeader
                        label='Total Paid'
                        sortField='total_paid'
                        currentSort={entriesSort}
                        onSort={(f) => toggleEntriesSort(f as EntriesSortField)}
                        filterValue={entriesFilters.total_paid}
                        onFilterChange={(v) =>
                          setEntriesFilters((p) => ({ ...p, total_paid: v }))
                        }
                      />
                    </TableHead>
                    <TableHead>
                      <FilterableColumnHeader
                        label='Last Entry'
                        sortField='last_entry'
                        currentSort={entriesSort}
                        onSort={(f) => toggleEntriesSort(f as EntriesSortField)}
                        filterValue={entriesFilters.last_entry}
                        onFilterChange={(v) =>
                          setEntriesFilters((p) => ({ ...p, last_entry: v }))
                        }
                      />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedEntries.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className='text-muted-foreground text-center'
                      >
                        No entries match the current filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAndSortedEntries.map((row) => (
                      <TableRow key={row.bidder_number}>
                        <TableCell>
                          <Badge variant='outline'>#{row.bidder_number}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className='flex items-center gap-2'>
                            <BidderAvatar
                              name={row.donor_name}
                              imageUrl={row.profile_picture_url}
                            />
                            <span className='font-medium'>
                              {row.donor_name}
                              {(item.current_winner_bidder_number ===
                                row.bidder_number ||
                                justDrawn?.bidder_number ===
                                  row.bidder_number) && (
                                <Trophy className='ml-1.5 inline h-3.5 w-3.5 text-yellow-500' />
                              )}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className='text-muted-foreground text-sm'>
                          {row.table_number != null
                            ? `#${row.table_number}`
                            : '—'}
                        </TableCell>
                        <TableCell className='text-right'>
                          {row.entry_count}
                        </TableCell>
                        <TableCell className='text-right font-semibold'>
                          {fmtCurrency(row.total_paid)}
                        </TableCell>
                        <TableCell className='text-muted-foreground text-sm'>
                          {new Date(row.last_purchased_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Winner history */}
      {winnerHistory.length > 0 && (
        <Card>
          <CardHeader>
            <div className='flex items-center justify-between gap-2'>
              <CardTitle className='text-base'>
                <div className='flex items-center gap-2'>
                  <Trophy className='h-4 w-4' />
                  Winner History
                </div>
              </CardTitle>
              <DataTableViewToggle
                value={winnerViewMode}
                onChange={setWinnerViewMode}
              />
            </div>
          </CardHeader>
          <CardContent className='p-0'>
            {winnerViewMode === 'card' ? (
              <div className='grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3'>
                {filteredAndSortedWinners.length === 0 ? (
                  <p className='text-muted-foreground col-span-full text-sm'>
                    No winners match the current filters.
                  </p>
                ) : (
                  filteredAndSortedWinners.map((selection) => (
                    <div
                      key={selection.id}
                      className='space-y-1.5 rounded-md border p-3'
                    >
                      <div className='flex items-center justify-between gap-2'>
                        <span className='font-medium'>
                          {selection.winner_name}
                        </span>
                        <Badge variant='outline'>
                          #{selection.bidder_number}
                        </Badge>
                      </div>
                      <div className='flex items-center justify-between text-sm'>
                        <Badge
                          variant={
                            selection.selection_method === 'random_draw'
                              ? 'secondary'
                              : 'outline'
                          }
                        >
                          {selection.selection_method === 'random_draw'
                            ? 'Random Draw'
                            : 'Manual'}
                        </Badge>
                        <span className='text-muted-foreground text-xs'>
                          {new Date(selection.selected_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className='overflow-x-auto'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <FilterableColumnHeader
                          label='Winner'
                          sortField='winner'
                          currentSort={winnerSort}
                          onSort={(f) => toggleWinnerSort(f as WinnerSortField)}
                          filterValue={winnerFilters.winner}
                          onFilterChange={(v) =>
                            setWinnerFilters((p) => ({ ...p, winner: v }))
                          }
                        />
                      </TableHead>
                      <TableHead>
                        <FilterableColumnHeader
                          label='Bidder #'
                          sortField='bidder'
                          currentSort={winnerSort}
                          onSort={(f) => toggleWinnerSort(f as WinnerSortField)}
                          filterValue={winnerFilters.bidder}
                          onFilterChange={(v) =>
                            setWinnerFilters((p) => ({ ...p, bidder: v }))
                          }
                        />
                      </TableHead>
                      <TableHead>
                        <FilterableColumnHeader
                          label='Method'
                          sortField='method'
                          currentSort={winnerSort}
                          onSort={(f) => toggleWinnerSort(f as WinnerSortField)}
                          filterValue={winnerFilters.method}
                          onFilterChange={(v) =>
                            setWinnerFilters((p) => ({ ...p, method: v }))
                          }
                        />
                      </TableHead>
                      <TableHead>
                        <FilterableColumnHeader
                          label='Drawn At'
                          sortField='drawn_at'
                          currentSort={winnerSort}
                          onSort={(f) => toggleWinnerSort(f as WinnerSortField)}
                          filterValue={winnerFilters.drawn_at}
                          onFilterChange={(v) =>
                            setWinnerFilters((p) => ({ ...p, drawn_at: v }))
                          }
                        />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedWinners.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className='text-muted-foreground text-center'
                        >
                          No winners match the current filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAndSortedWinners.map((selection) => (
                        <TableRow key={selection.id}>
                          <TableCell className='font-medium'>
                            {selection.winner_name}
                          </TableCell>
                          <TableCell>
                            <Badge variant='outline'>
                              #{selection.bidder_number}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                selection.selection_method === 'random_draw'
                                  ? 'secondary'
                                  : 'outline'
                              }
                            >
                              {selection.selection_method === 'random_draw'
                                ? 'Random Draw'
                                : 'Manual'}
                            </Badge>
                          </TableCell>
                          <TableCell className='text-muted-foreground text-sm'>
                            {new Date(selection.selected_at).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Gallery view ────────────────────────────────────────────────────────────

function RGItemCard({ item, onClick }: { item: RGItem; onClick: () => void }) {
  return (
    <Card
      className='cursor-pointer overflow-hidden transition-shadow hover:shadow-md'
      onClick={onClick}
    >
      <CardContent className='space-y-3 pt-4'>
        <div className='flex items-start justify-between gap-2'>
          <div className='min-w-0'>
            <h4 className='truncate font-semibold'>{item.name}</h4>
            {item.description && (
              <p className='text-muted-foreground mt-0.5 line-clamp-2 text-xs'>
                {item.description}
              </p>
            )}
          </div>
          <div className='flex shrink-0 flex-col gap-1'>
            {item.is_open_for_entries ? (
              <Badge variant='default' className='text-xs'>
                Open
              </Badge>
            ) : (
              <Badge variant='secondary' className='text-xs'>
                Closed
              </Badge>
            )}
          </div>
        </div>

        <div className='grid grid-cols-3 gap-2 text-sm'>
          <div>
            <p className='text-muted-foreground text-xs'>Entry Price</p>
            <p className='font-medium'>{fmtCurrency(item.price_per_entry)}</p>
          </div>
          <div>
            <p className='text-muted-foreground text-xs'>Entries</p>
            <p className='font-medium'>{item.total_entries}</p>
          </div>
          <div>
            <p className='text-muted-foreground text-xs'>Raised</p>
            <p className='font-medium'>{fmtCurrency(item.total_revenue)}</p>
          </div>
        </div>

        {item.current_winner_name && (
          <div className='flex items-center gap-1.5 rounded-md border border-yellow-300 bg-yellow-50 px-2 py-1 dark:border-yellow-700 dark:bg-yellow-950/20'>
            <Trophy className='h-3.5 w-3.5 shrink-0 text-yellow-500' />
            <span className='truncate text-xs font-medium'>
              {item.current_winner_name}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Main tab component ──────────────────────────────────────────────────────

export function RGAuctioneerTab({ eventId }: Props) {
  const [items, setItems] = useState<RGItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<RGItem | null>(null)

  const loadItems = () => {
    setLoading(true)
    revenueGeneratorService
      .listItems(eventId)
      .then((data) => {
        setItems(data)
        // Keep the selected item in sync with refreshed data
        setSelectedItem((prev) =>
          prev ? (data.find((i) => i.id === prev.id) ?? null) : null
        )
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  if (selectedItem) {
    return (
      <RGItemDetail
        eventId={eventId}
        item={selectedItem}
        onBack={() => setSelectedItem(null)}
        onWinnerDrawn={(updated) => {
          setItems((prev) =>
            prev.map((i) => (i.id === updated.id ? updated : i))
          )
          setSelectedItem(updated)
        }}
      />
    )
  }

  const totalEntries = items.reduce((acc, i) => acc + i.total_entries, 0)
  const totalRevenue = items.reduce(
    (acc, i) => acc + Number(i.total_revenue),
    0
  )
  const itemsWithWinner = items.filter((i) => i.current_winner_name).length

  return (
    <div className='space-y-4'>
      <div>
        <h3 className='text-xl font-semibold'>Revenue Generators</h3>
        <p className='text-muted-foreground text-sm'>
          Ticket-based fundraising items. Click any item to view entries and
          draw a winner.
        </p>
      </div>

      {/* Totals summary */}
      <div className='grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4'>
        <SummaryCard label='Items' value={`${items.length}`} />
        <SummaryCard label='Total Entries' value={`${totalEntries}`} />
        <SummaryCard label='Total Raised' value={fmtCurrency(totalRevenue)} />
        <SummaryCard
          label='Winners Selected'
          value={`${itemsWithWinner} / ${items.length}`}
        />
      </div>

      {/* Gallery */}
      {loading ? (
        <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className='h-36 w-full' />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className='flex flex-col items-center gap-3 py-12 text-center'>
            <Ticket className='text-muted-foreground h-10 w-10' />
            <p className='text-muted-foreground'>
              No revenue generator items have been created for this event yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
          {items.map((item) => (
            <RGItemCard
              key={item.id}
              item={item}
              onClick={() => setSelectedItem(item)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
