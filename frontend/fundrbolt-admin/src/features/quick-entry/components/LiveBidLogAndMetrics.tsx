import { useMemo, useState } from 'react'
import { Crown } from 'lucide-react'
import { useViewPreference } from '@/hooks/use-view-preference'
import { DataTableViewToggle } from '@/components/data-table/view-toggle'
import type { QuickEntryLiveSummary } from '../api/quickEntryApi'
import { FilterableColumnHeader, type SortDir } from './FilterableColumnHeader'

interface LiveBidLogAndMetricsProps {
  summary: QuickEntryLiveSummary | undefined
  isLoading: boolean
  isError: boolean
  hasSelectedItem: boolean
  isDeleting: boolean
  isAssigningWinner: boolean
  isRemovingWinner: boolean
  onDeleteBid: (bidId: string) => void
  onAssignWinner: () => void
  onRemoveWinner: () => void
}

type SortField = 'amount' | 'bidder' | 'donor' | 'table' | 'time' | 'status'

export function LiveBidLogAndMetrics({
  summary,
  isLoading,
  isError,
  hasSelectedItem,
  isDeleting,
  isAssigningWinner,
  isRemovingWinner,
  onDeleteBid,
  onAssignWinner,
  onRemoveWinner,
}: LiveBidLogAndMetricsProps) {
  const [tableFilters, setTableFilters] = useState({
    amount: '',
    bidder: '',
    donor: '',
    table: '',
    time: '',
    status: '',
  })
  const [tableSort, setTableSort] = useState<{
    field: SortField
    dir: SortDir
  } | null>(null)
  const [viewMode, setViewMode] = useViewPreference('live-bid-log')

  const toggleSort = (field: SortField) => {
    setTableSort((prev) => {
      if (!prev || prev.field !== field) return { field, dir: 'asc' }
      if (prev.dir === 'asc') return { field, dir: 'desc' }
      return null
    })
  }

  const bids = useMemo(() => summary?.bids ?? [], [summary?.bids])
  const winnerBid = useMemo(
    () => bids.find((b) => b.status === 'winning'),
    [bids]
  )
  const hasWinner = !!winnerBid

  const filteredAndSortedBids = useMemo(() => {
    const normalize = (v: string | null | undefined) => (v ?? '').toLowerCase()
    let rows = bids.filter((b) => {
      const timeText = new Date(b.accepted_at)
        .toLocaleTimeString()
        .toLowerCase()
      if (
        tableFilters.amount &&
        !String(b.amount).includes(tableFilters.amount.replace(/,/g, ''))
      )
        return false
      if (
        tableFilters.bidder &&
        !String(b.bidder_number).includes(tableFilters.bidder)
      )
        return false
      if (
        tableFilters.donor &&
        !normalize(b.donor_name).includes(tableFilters.donor.toLowerCase())
      )
        return false
      if (
        tableFilters.table &&
        !normalize(b.table_number).includes(tableFilters.table.toLowerCase())
      )
        return false
      if (
        tableFilters.time &&
        !timeText.includes(tableFilters.time.toLowerCase())
      )
        return false
      if (
        tableFilters.status &&
        !normalize(b.status).includes(tableFilters.status.toLowerCase())
      )
        return false
      return true
    })
    if (tableSort) {
      rows = [...rows].sort((a, b) => {
        let cmp = 0
        if (tableSort.field === 'amount') cmp = a.amount - b.amount
        else if (tableSort.field === 'bidder')
          cmp = a.bidder_number - b.bidder_number
        else if (tableSort.field === 'donor')
          cmp = (a.donor_name ?? '').localeCompare(b.donor_name ?? '')
        else if (tableSort.field === 'table')
          cmp = (a.table_number ?? '').localeCompare(b.table_number ?? '')
        else if (tableSort.field === 'time')
          cmp =
            new Date(a.accepted_at).getTime() -
            new Date(b.accepted_at).getTime()
        else if (tableSort.field === 'status')
          cmp = a.status.localeCompare(b.status)
        return tableSort.dir === 'asc' ? cmp : -cmp
      })
    }
    return rows
  }, [bids, tableFilters, tableSort])

  if (!hasSelectedItem) {
    return (
      <p className='text-muted-foreground text-sm'>
        Select an item to view live metrics.
      </p>
    )
  }

  if (isLoading) {
    return <p className='text-muted-foreground text-sm'>Loading…</p>
  }

  if (isError || !summary) {
    return (
      <>
        <p className='text-destructive text-sm'>
          Failed to load bid data. Check the console or try refreshing.
        </p>
      </>
    )
  }

  return (
    <section className='space-y-3' aria-live='polite'>
      {hasWinner && winnerBid ? (
        <div className='flex items-center justify-between rounded-md border border-yellow-400 bg-yellow-50 px-3 py-2 dark:border-yellow-600 dark:bg-yellow-950'>
          <div className='flex items-center gap-2'>
            <Crown className='h-4 w-4 text-yellow-600 dark:text-yellow-400' />
            <span className='text-sm font-medium'>
              Winner: Bidder #{winnerBid.bidder_number} — $
              {winnerBid.amount.toLocaleString('en-US')}
            </span>
          </div>
          <button
            type='button'
            className='rounded border px-2 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60'
            onClick={() => {
              if (
                window.confirm(
                  'Remove winner? Bidding will reopen for this item.'
                )
              ) {
                onRemoveWinner()
              }
            }}
            disabled={isRemovingWinner}
          >
            {isRemovingWinner ? 'Removing…' : 'Remove Winner'}
          </button>
        </div>
      ) : null}

      <div className='grid grid-cols-2 gap-3 sm:grid-cols-3'>
        <div className='rounded-md border p-3'>
          <p className='text-muted-foreground text-xs'>Current Highest Bid</p>
          <p className='text-xl font-semibold'>
            ${summary.current_highest_bid.toLocaleString('en-US')}
          </p>
        </div>
        <div className='rounded-md border p-3'>
          <p className='text-muted-foreground text-xs'>Bid Count</p>
          <p className='text-xl font-semibold'>{summary.bid_count}</p>
        </div>
        <div className='rounded-md border p-3'>
          <p className='text-muted-foreground text-xs'>Unique Bidders</p>
          <p className='text-xl font-semibold'>{summary.unique_bidder_count}</p>
        </div>
      </div>

      {!hasWinner && (
        <div className='flex justify-end'>
          <button
            type='button'
            className='rounded-md border px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60'
            onClick={() => {
              if (
                window.confirm(
                  'Assign winner to the current highest valid bid?'
                )
              ) {
                onAssignWinner()
              }
            }}
            disabled={summary.bid_count === 0 || isAssigningWinner}
            aria-label='Assign winner to highest valid bid'
          >
            {isAssigningWinner ? 'Assigning Winner…' : 'Assign Winner'}
          </button>
        </div>
      )}

      <div className='flex justify-end'>
        <DataTableViewToggle value={viewMode} onChange={setViewMode} />
      </div>

      {viewMode === 'card' ? (
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          {filteredAndSortedBids.length === 0 ? (
            <div className='text-muted-foreground col-span-full rounded-md border py-4 text-center text-sm'>
              {bids.length === 0
                ? 'No bids entered yet.'
                : 'No bids match the current filters.'}
            </div>
          ) : (
            filteredAndSortedBids.map((bid) => {
              const isWinner = bid.status === 'winning'
              return (
                <div
                  key={bid.id}
                  className={`rounded-md border p-3 space-y-1${isWinner ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-950/40' : ''}`}
                >
                  <div className='flex items-center justify-between'>
                    <span className='flex items-center gap-1'>
                      {isWinner && (
                        <Crown className='h-3 w-3 text-yellow-600 dark:text-yellow-400' />
                      )}
                      <span className='text-lg font-semibold'>
                        ${bid.amount.toLocaleString('en-US')}
                      </span>
                    </span>
                    <span className='text-muted-foreground text-sm'>
                      #{bid.bidder_number}
                    </span>
                  </div>
                  <p className='text-sm'>{bid.donor_name ?? '—'}</p>
                  <div className='text-muted-foreground flex items-center justify-between text-xs'>
                    <span>
                      {bid.table_number ?? '—'} ·{' '}
                      {new Date(bid.accepted_at).toLocaleTimeString()}
                    </span>
                    <div className='flex items-center gap-2'>
                      <span>{bid.status}</span>
                      <button
                        type='button'
                        className='rounded border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60'
                        onClick={() => onDeleteBid(bid.id)}
                        disabled={isDeleting}
                        aria-label={`Delete bid ${bid.id}`}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      ) : (
        <div className='overflow-x-auto rounded-md border'>
          <table className='w-full min-w-[640px] text-sm'>
            <thead>
              <tr className='bg-muted/20 text-left'>
                <th className='px-3 py-2'>
                  <FilterableColumnHeader
                    label='Amount'
                    sortField='amount'
                    currentSort={tableSort}
                    onSort={(f) => toggleSort(f as SortField)}
                    filterValue={tableFilters.amount}
                    onFilterChange={(v) =>
                      setTableFilters((p) => ({ ...p, amount: v }))
                    }
                  />
                </th>
                <th className='px-3 py-2'>
                  <FilterableColumnHeader
                    label='Bidder'
                    sortField='bidder'
                    currentSort={tableSort}
                    onSort={(f) => toggleSort(f as SortField)}
                    filterValue={tableFilters.bidder}
                    onFilterChange={(v) =>
                      setTableFilters((p) => ({ ...p, bidder: v }))
                    }
                  />
                </th>
                <th className='px-3 py-2'>
                  <FilterableColumnHeader
                    label='Donor'
                    sortField='donor'
                    currentSort={tableSort}
                    onSort={(f) => toggleSort(f as SortField)}
                    filterValue={tableFilters.donor}
                    onFilterChange={(v) =>
                      setTableFilters((p) => ({ ...p, donor: v }))
                    }
                  />
                </th>
                <th className='px-3 py-2'>
                  <FilterableColumnHeader
                    label='Table'
                    sortField='table'
                    currentSort={tableSort}
                    onSort={(f) => toggleSort(f as SortField)}
                    filterValue={tableFilters.table}
                    onFilterChange={(v) =>
                      setTableFilters((p) => ({ ...p, table: v }))
                    }
                  />
                </th>
                <th className='px-3 py-2'>
                  <FilterableColumnHeader
                    label='Time'
                    sortField='time'
                    currentSort={tableSort}
                    onSort={(f) => toggleSort(f as SortField)}
                    filterValue={tableFilters.time}
                    onFilterChange={(v) =>
                      setTableFilters((p) => ({ ...p, time: v }))
                    }
                  />
                </th>
                <th className='px-3 py-2'>
                  <FilterableColumnHeader
                    label='Status'
                    sortField='status'
                    currentSort={tableSort}
                    onSort={(f) => toggleSort(f as SortField)}
                    filterValue={tableFilters.status}
                    onFilterChange={(v) =>
                      setTableFilters((p) => ({ ...p, status: v }))
                    }
                  />
                </th>
                <th className='px-3 py-2'>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedBids.map((bid) => {
                const isWinner = bid.status === 'winning'
                return (
                  <tr
                    key={bid.id}
                    className={`border-t${isWinner ? 'bg-yellow-50 dark:bg-yellow-950/40' : ''}`}
                  >
                    <td className='px-3 py-2'>
                      <span className='flex items-center gap-1'>
                        {isWinner && (
                          <Crown className='h-3 w-3 text-yellow-600 dark:text-yellow-400' />
                        )}
                        ${bid.amount.toLocaleString('en-US')}
                      </span>
                    </td>
                    <td className='px-3 py-2'>{bid.bidder_number}</td>
                    <td className='px-3 py-2'>{bid.donor_name ?? '—'}</td>
                    <td className='px-3 py-2'>{bid.table_number ?? '—'}</td>
                    <td className='px-3 py-2'>
                      {new Date(bid.accepted_at).toLocaleTimeString()}
                    </td>
                    <td className='px-3 py-2'>{bid.status}</td>
                    <td className='px-3 py-2'>
                      <button
                        type='button'
                        className='rounded border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60'
                        onClick={() => onDeleteBid(bid.id)}
                        disabled={isDeleting}
                        aria-label={`Delete bid ${bid.id}`}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })}
              {filteredAndSortedBids.length === 0 ? (
                <tr>
                  <td
                    className='text-muted-foreground px-3 py-4 text-center'
                    colSpan={7}
                  >
                    {bids.length === 0
                      ? 'No bids entered yet.'
                      : 'No bids match the current filters.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
