import { type FormEvent, type KeyboardEvent, useEffect, useRef } from 'react'

import type {
  QuickEntryDonationLabel,
  QuickEntryPaddleDonationResponse,
  QuickEntryPaddleSummary,
} from '../api/quickEntryApi'

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
  const bidderRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bidderRef.current?.focus()
    bidderRef.current?.select()
  }, [submitToken])

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
    <section className="space-y-3" aria-live="polite">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Total Pledged</p>
          <p className="text-xl font-semibold">
            ${summary?.total_pledged.toLocaleString('en-US') ?? '0'}
          </p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Donation Count</p>
          <p className="text-xl font-semibold">{summary?.donation_count ?? 0}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Unique Donors</p>
          <p className="text-xl font-semibold">{summary?.unique_donor_count ?? 0}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Participation</p>
          <p className="text-xl font-semibold">{(summary?.participation_percent ?? 0).toFixed(2)}%</p>
        </div>
      </div>

      <form className="grid gap-3" onSubmit={handleSubmit}>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="quick-entry-paddle-amount">
              Amount
            </label>
            <input
              id="quick-entry-paddle-amount"
              className="w-full rounded-md border px-3 py-2"
              inputMode="numeric"
              value={amount}
              onChange={(event) => onAmountChange(parseToWholeDollar(event.target.value))}
              placeholder="500"
              disabled={disabled}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="quick-entry-paddle-bidder">
              Bidder Number
            </label>
            <input
              id="quick-entry-paddle-bidder"
              ref={bidderRef}
              className="w-full rounded-md border px-3 py-2"
              inputMode="numeric"
              value={bidderNumber}
              onChange={(event) => onBidderNumberChange(event.target.value.replace(/[^\d]/g, ''))}
              onKeyDown={handleBidderKeyDown}
              placeholder="123"
              disabled={disabled}
            />
          </div>
        </div>

        <div className="space-y-2 rounded-md border p-3">
          <p className="text-sm font-medium">Donation Labels (optional)</p>
          {isLoadingLabels ? (
            <p className="text-sm text-muted-foreground">Loading donation labels...</p>
          ) : null}
          {!isLoadingLabels && labelsError ? (
            <p className="text-sm text-destructive">
              Failed to load donation labels. Run latest backend migrations and refresh.
            </p>
          ) : null}
          {!isLoadingLabels && !labelsError && labels.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No donation labels found. Run latest backend migrations and refresh.
            </p>
          ) : null}
          <div className="grid gap-2 md:grid-cols-2">
            {labels.map((label) => (
              <label key={label.id} className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedLabelIds.includes(label.id)}
                  onChange={() => toggleLabel(label.id)}
                  disabled={disabled}
                />
                <span>{label.name}</span>
              </label>
            ))}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="quick-entry-custom-label">
              Custom Label (optional)
            </label>
            <input
              id="quick-entry-custom-label"
              className="w-full rounded-md border px-3 py-2"
              value={customLabel}
              onChange={(event) => onCustomLabelChange(event.target.value)}
              maxLength={80}
              disabled={disabled}
            />
          </div>
        </div>
      </form>

      <div className="rounded-md border p-3">
        <p className="mb-2 text-sm font-medium">Counts by Amount Level</p>
        <ul className="space-y-1 text-sm">
          {(summary?.by_amount_level ?? []).map((row) => (
            <li key={row.amount} className="flex items-center justify-between">
              <span>${row.amount.toLocaleString('en-US')}</span>
              <span>{row.count}</span>
            </li>
          ))}
          {(summary?.by_amount_level ?? []).length === 0 ? (
            <li className="text-muted-foreground">No donations entered yet.</li>
          ) : null}
        </ul>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="bg-muted/20 text-left">
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Bidder</th>
              <th className="px-3 py-2">Donor</th>
              <th className="px-3 py-2">Labels</th>
              <th className="px-3 py-2">Time</th>
            </tr>
          </thead>
          <tbody>
            {recentDonations.map((donation) => (
              <tr key={donation.id} className="border-t">
                <td className="px-3 py-2">${donation.amount.toLocaleString('en-US')}</td>
                <td className="px-3 py-2">{donation.bidder_number}</td>
                <td className="px-3 py-2">{donation.donor_name ?? '—'}</td>
                <td className="px-3 py-2">
                  {donation.labels.length
                    ? donation.labels.map((label) => label.label).join(', ')
                    : '—'}
                </td>
                <td className="px-3 py-2">{new Date(donation.entered_at).toLocaleTimeString()}</td>
              </tr>
            ))}
            {recentDonations.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-center text-muted-foreground" colSpan={5}>
                  No paddle raise donations entered yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}
