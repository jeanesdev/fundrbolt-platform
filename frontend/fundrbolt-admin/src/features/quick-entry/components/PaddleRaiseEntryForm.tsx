import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type {
  QuickEntryDonationLabel,
  QuickEntryPaddleDonationResponse,
  QuickEntryPaddleSummary,
} from '../api/quickEntryApi'
import { FilterableColumnHeader, type SortDir } from './FilterableColumnHeader'

interface PaddleRaiseEntryFormProps {
  amount: string
  bidderNumber: string
  customLabel: string
  selectedLabelIds: string[]
  labels: QuickEntryDonationLabel[]
  labelsError?: unknown
  isLoadingLabels?: boolean
  recentDonations?: QuickEntryPaddleDonationResponse[]
  summary: QuickEntryPaddleSummary | undefined
  submitToken: number
  disabled?: boolean
  onAmountChange: (value: string) => void
  onBidderNumberChange: (value: string) => void
  onCustomLabelChange: (value: string) => void
  onSelectedLabelIdsChange: (value: string[]) => void
  onSubmit: () => void
}

function parseToWholeDollar(value: string): string {
  const digits = value.replace(/[^\d]/g, '')
  if (!digits) return ''
  return Number.parseInt(digits, 10).toLocaleString('en-US')
}

type SortField = 'amount' | 'bidder' | 'donor' | 'labels' | 'time'

export function PaddleRaiseEntryForm({
  amount,
  bidderNumber,
  customLabel,
  selectedLabelIds,
  labels,
  labelsError,
  isLoadingLabels,
  recentDonations = [],
  summary,
  submitToken,
  disabled,
  onAmountChange,
  onBidderNumberChange,
  onCustomLabelChange,
  onSelectedLabelIdsChange,
  onSubmit,
}: PaddleRaiseEntryFormProps) {
  const amountRef = useRef<HTMLInputElement>(null)
  const bidderRef = useRef<HTMLInputElement>(null)
  const [tableFilters, setTableFilters] = useState({
    amount: '',
    bidder: '',
    donor: '',
    labels: '',
    time: '',
  })
  const [tableSort, setTableSort] = useState<{
    field: SortField
    dir: SortDir
  } | null>(null)

  const toggleSort = (field: SortField) => {
    setTableSort((prev) => {
      if (!prev || prev.field !== field) return { field, dir: 'asc' }
      if (prev.dir === 'asc') return { field, dir: 'desc' }
      return null
    })
  }

  const filteredAndSortedDonations = useMemo(() => {
    const normalize = (v: string | null | undefined) => (v ?? '').toLowerCase()
    let rows = recentDonations.filter((d) => {
      const labelText = d.labels.map((l) => l.label).join(', ')
      const timeText = new Date(d.entered_at).toLocaleTimeString().toLowerCase()
      if (
        tableFilters.amount &&
        !String(d.amount).includes(tableFilters.amount.replace(/,/g, ''))
      )
        return false
      if (
        tableFilters.bidder &&
        !String(d.bidder_number).includes(tableFilters.bidder)
      )
        return false
      if (
        tableFilters.donor &&
        !normalize(d.donor_name).includes(tableFilters.donor.toLowerCase())
      )
        return false
      if (
        tableFilters.labels &&
        !normalize(labelText).includes(tableFilters.labels.toLowerCase())
      )
        return false
      if (
        tableFilters.time &&
        !timeText.includes(tableFilters.time.toLowerCase())
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
        else if (tableSort.field === 'labels') {
          const al = a.labels.map((l) => l.label).join(', ')
          const bl = b.labels.map((l) => l.label).join(', ')
          cmp = al.localeCompare(bl)
        } else if (tableSort.field === 'time') {
          cmp =
            new Date(a.entered_at).getTime() - new Date(b.entered_at).getTime()
        }
        return tableSort.dir === 'asc' ? cmp : -cmp
      })
    }
    return rows
  }, [recentDonations, tableFilters, tableSort])

  useEffect(() => {
    bidderRef.current?.focus()
    bidderRef.current?.select()
  }, [submitToken])

  const handleAmountKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      bidderRef.current?.focus()
      bidderRef.current?.select()
    }
  }

  const handleBidderKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      onSubmit()
    }
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit()
  }

  const toggleLabel = (id: string) => {
    if (selectedLabelIds.includes(id)) {
      onSelectedLabelIdsChange(selectedLabelIds.filter((value) => value !== id))
      return
    }
    onSelectedLabelIdsChange([...selectedLabelIds, id])
  }

  return (
    <section className='space-y-3' aria-live='polite'>
      <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
        <div className='rounded-md border p-3'>
          <p className='text-muted-foreground text-xs'>Total Pledged</p>
          <p className='text-xl font-semibold'>
            ${summary?.total_pledged.toLocaleString('en-US') ?? '0'}
          </p>
        </div>
        <div className='rounded-md border p-3'>
          <p className='text-muted-foreground text-xs'>Donation Count</p>
          <p className='text-xl font-semibold'>
            {summary?.donation_count ?? 0}
          </p>
        </div>
        <div className='rounded-md border p-3'>
          <p className='text-muted-foreground text-xs'>Unique Donors</p>
          <p className='text-xl font-semibold'>
            {summary?.unique_donor_count ?? 0}
          </p>
        </div>
        <div className='rounded-md border p-3'>
          <p className='text-muted-foreground text-xs'>Participation</p>
          <p className='text-xl font-semibold'>
            {(summary?.participation_percent ?? 0).toFixed(2)}%
          </p>
        </div>
      </div>

      <form className='grid gap-3' onSubmit={handleSubmit}>
        <div className='grid grid-cols-2 gap-3'>
          <div className='space-y-1'>
            <label
              className='text-sm font-medium'
              htmlFor='quick-entry-paddle-amount'
            >
              Amount
            </label>
            <input
              id='quick-entry-paddle-amount'
              ref={amountRef}
              className='w-full rounded-md border px-3 py-2'
              inputMode='numeric'
              value={amount}
              onChange={(event) =>
                onAmountChange(parseToWholeDollar(event.target.value))
              }
              onKeyDown={handleAmountKeyDown}
              placeholder='500'
              disabled={disabled}
            />
          </div>

          <div className='space-y-1'>
            <label
              className='text-sm font-medium'
              htmlFor='quick-entry-paddle-bidder'
            >
              Bidder Number
            </label>
            <input
              id='quick-entry-paddle-bidder'
              ref={bidderRef}
              className='w-full rounded-md border px-3 py-2'
              inputMode='numeric'
              value={bidderNumber}
              onChange={(event) =>
                onBidderNumberChange(event.target.value.replace(/[^\d]/g, ''))
              }
              onKeyDown={handleBidderKeyDown}
              placeholder='123'
              disabled={disabled}
            />
          </div>
        </div>

        <button
          type='submit'
          className='w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50'
          disabled={disabled}
        >
          {disabled ? 'Submitting…' : 'Submit Donation'}
        </button>

        <div className='space-y-2 rounded-md border p-3'>
          <p className='text-sm font-medium'>Donation Labels (optional)</p>
          {isLoadingLabels ? (
            <p className='text-muted-foreground text-sm'>
              Loading donation labels...
            </p>
          ) : null}
          {!isLoadingLabels && labelsError ? (
            <p className='text-destructive text-sm'>
              Failed to load donation labels. Run latest backend migrations and
              refresh.
            </p>
          ) : null}
          {!isLoadingLabels && !labelsError && labels.length === 0 ? (
            <p className='text-muted-foreground text-sm'>
              No donation labels found. Run latest backend migrations and
              refresh.
            </p>
          ) : null}
          <div className='grid grid-cols-2 gap-2'>
            {labels.map((label) => (
              <label
                key={label.id}
                className='inline-flex items-center gap-2 text-sm'
              >
                <input
                  type='checkbox'
                  checked={selectedLabelIds.includes(label.id)}
                  onChange={() => toggleLabel(label.id)}
                  disabled={disabled}
                />
                <span>{label.name}</span>
              </label>
            ))}
          </div>
          <div className='space-y-1'>
            <label
              className='text-sm font-medium'
              htmlFor='quick-entry-custom-label'
            >
              Custom Label (optional)
            </label>
            <input
              id='quick-entry-custom-label'
              className='w-full rounded-md border px-3 py-2'
              value={customLabel}
              onChange={(event) => onCustomLabelChange(event.target.value)}
              maxLength={80}
              disabled={disabled}
            />
          </div>
        </div>
      </form>

      <div className='rounded-md border p-3'>
        <p className='mb-2 text-sm font-medium'>Counts by Amount Level</p>
        <ul className='space-y-1 text-sm'>
          {(summary?.by_amount_level ?? []).map((row) => (
            <li key={row.amount} className='flex items-center justify-between'>
              <span>${row.amount.toLocaleString('en-US')}</span>
              <span>{row.count}</span>
            </li>
          ))}
          {(summary?.by_amount_level ?? []).length === 0 ? (
            <li className='text-muted-foreground'>No donations entered yet.</li>
          ) : null}
        </ul>
      </div>

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
                  onFilterChange={(v) => setTableFilters((p) => ({ ...p, amount: v }))}
                />
              </th>
              <th className='px-3 py-2'>
                <FilterableColumnHeader
                  label='Bidder'
                  sortField='bidder'
                  currentSort={tableSort}
                  onSort={(f) => toggleSort(f as SortField)}
                  filterValue={tableFilters.bidder}
                  onFilterChange={(v) => setTableFilters((p) => ({ ...p, bidder: v }))}
                />
              </th>
              <th className='px-3 py-2'>
                <FilterableColumnHeader
                  label='Donor'
                  sortField='donor'
                  currentSort={tableSort}
                  onSort={(f) => toggleSort(f as SortField)}
                  filterValue={tableFilters.donor}
                  onFilterChange={(v) => setTableFilters((p) => ({ ...p, donor: v }))}
                />
              </th>
              <th className='px-3 py-2'>
                <FilterableColumnHeader
                  label='Labels'
                  sortField='labels'
                  currentSort={tableSort}
                  onSort={(f) => toggleSort(f as SortField)}
                  filterValue={tableFilters.labels}
                  onFilterChange={(v) => setTableFilters((p) => ({ ...p, labels: v }))}
                />
              </th>
              <th className='px-3 py-2'>
                <FilterableColumnHeader
                  label='Time'
                  sortField='time'
                  currentSort={tableSort}
                  onSort={(f) => toggleSort(f as SortField)}
                  filterValue={tableFilters.time}
                  onFilterChange={(v) => setTableFilters((p) => ({ ...p, time: v }))}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedDonations.map((donation) => (
              <tr key={donation.id} className='border-t'>
                <td className='px-3 py-2'>
                  ${donation.amount.toLocaleString('en-US')}
                </td>
                <td className='px-3 py-2'>{donation.bidder_number}</td>
                <td className='px-3 py-2'>{donation.donor_name ?? '—'}</td>
                <td className='px-3 py-2'>
                  {donation.labels.length
                    ? donation.labels.map((label) => label.label).join(', ')
                    : '—'}
                </td>
                <td className='px-3 py-2'>
                  {new Date(donation.entered_at).toLocaleTimeString()}
                </td>
              </tr>
            ))}
            {filteredAndSortedDonations.length === 0 ? (
              <tr>
                <td
                  className='text-muted-foreground px-3 py-4 text-center'
                  colSpan={5}
                >
                  {recentDonations.length === 0
                    ? 'No paddle raise donations entered yet.'
                    : 'No donations match the current filters.'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}
