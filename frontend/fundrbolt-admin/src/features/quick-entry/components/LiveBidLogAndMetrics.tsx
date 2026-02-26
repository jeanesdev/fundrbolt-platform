import type { QuickEntryLiveSummary } from '../api/quickEntryApi'

interface LiveBidLogAndMetricsProps {
  summary: QuickEntryLiveSummary | undefined
  isLoading: boolean
  isDeleting: boolean
  isAssigningWinner: boolean
  onDeleteBid: (bidId: string) => void
  onAssignWinner: () => void
}

export function LiveBidLogAndMetrics({
  summary,
  isLoading,
  isDeleting,
  isAssigningWinner,
  onDeleteBid,
  onAssignWinner,
}: LiveBidLogAndMetricsProps) {
  if (isLoading || !summary) {
    return <p className="text-sm text-muted-foreground">Select an item to view live metrics.</p>
  }

  return (
    <section className="space-y-3" aria-live="polite">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Current Highest Bid</p>
          <p className="text-xl font-semibold">${summary.current_highest_bid.toLocaleString('en-US')}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Bid Count</p>
          <p className="text-xl font-semibold">{summary.bid_count}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Unique Bidders</p>
          <p className="text-xl font-semibold">{summary.unique_bidder_count}</p>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          className="rounded-md border px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => {
            if (window.confirm('Assign winner to the current highest valid bid?')) {
              onAssignWinner()
            }
          }}
          disabled={summary.bid_count === 0 || isAssigningWinner}
          aria-label="Assign winner to highest valid bid"
        >
          {isAssigningWinner ? 'Assigning Winner…' : 'Assign Winner'}
        </button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="bg-muted/20 text-left">
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Bidder</th>
              <th className="px-3 py-2">Donor</th>
              <th className="px-3 py-2">Table</th>
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {summary.bids.map((bid) => (
              <tr key={bid.id} className="border-t">
                <td className="px-3 py-2">${bid.amount.toLocaleString('en-US')}</td>
                <td className="px-3 py-2">{bid.bidder_number}</td>
                <td className="px-3 py-2">{bid.donor_name ?? '—'}</td>
                <td className="px-3 py-2">{bid.table_number ?? '—'}</td>
                <td className="px-3 py-2">{new Date(bid.accepted_at).toLocaleTimeString()}</td>
                <td className="px-3 py-2">{bid.status}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="rounded border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => onDeleteBid(bid.id)}
                    disabled={isDeleting}
                    aria-label={`Delete bid ${bid.id}`}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {summary.bids.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-center text-muted-foreground" colSpan={7}>
                  No bids entered yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}
