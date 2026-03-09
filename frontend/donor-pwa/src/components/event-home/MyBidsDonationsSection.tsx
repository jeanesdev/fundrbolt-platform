/**
 * MyBidsDonationsSection – collapsible section on the "My Event" tab showing
 * the donor's auction bids and paddle-raise donations.
 *
 * - Desktop / tablet: two-column table layout
 * - Mobile: stacked cards
 * - Searchable by item number or item description (bids)
 */
import type { DonorActivityResponse } from '@/services/donor-activity-service'
import { ChevronDown, ChevronUp, Gavel, Gift, Search } from 'lucide-react'
import { useMemo, useState } from 'react'

interface MyBidsDonationsSectionProps {
  activity: DonorActivityResponse
  isAuctionClosed?: boolean
}

const BID_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  winning: { label: 'Winning', color: '#16a34a' },
  outbid: { label: 'Outbid', color: '#dc2626' },
  active: { label: 'Active', color: '#2563eb' },
  cancelled: { label: 'Cancelled', color: '#6b7280' },
  withdrawn: { label: 'Withdrawn', color: '#6b7280' },
}

const BID_STATUS_CLOSED_LABELS: Record<string, { label: string; color: string }> = {
  winning: { label: 'Won', color: '#16a34a' },
  outbid: { label: 'Lost', color: '#dc2626' },
  active: { label: 'Won', color: '#16a34a' },
  cancelled: { label: 'Cancelled', color: '#6b7280' },
  withdrawn: { label: 'Withdrawn', color: '#6b7280' },
}

function fmtCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount)
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function MyBidsDonationsSection({ activity, isAuctionClosed = false }: MyBidsDonationsSectionProps) {
  const getStatusInfo = (status: string) => {
    const labels = isAuctionClosed ? BID_STATUS_CLOSED_LABELS : BID_STATUS_LABELS
    return labels[status] ?? { label: status, color: '#6b7280' }
  }
  const [expanded, setExpanded] = useState(false)
  const [search, setSearch] = useState('')

  const hasBids = activity.bids.length > 0
  const hasDonations = activity.donations.length > 0

  const filteredBids = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return activity.bids
    return activity.bids.filter(
      (b) =>
        b.item_title.toLowerCase().includes(q) ||
        b.item_number.toString().includes(q)
    )
  }, [activity.bids, search])

  if (!hasBids && !hasDonations) return null

  const totalBid = activity.bids.reduce((s, b) => s + b.bid_amount, 0)
  const totalDonation = activity.donations.reduce((s, d) => s + d.amount, 0)

  return (
    <div
      className='overflow-hidden rounded-2xl border'
      style={{
        borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.2)',
        backgroundColor: 'rgb(var(--event-background, 255, 255, 255))',
      }}
    >
      {/* Header / toggle */}
      <button
        type='button'
        className='flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors active:opacity-70'
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <div className='flex items-center gap-2.5'>
          <div
            className='flex h-8 w-8 items-center justify-center rounded-full'
            style={{ backgroundColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.1)' }}
          >
            <Gavel
              className='h-4 w-4'
              style={{ color: 'rgb(var(--event-primary, 59, 130, 246))' }}
            />
          </div>
          <span
            className='text-sm font-semibold'
            style={{ color: 'var(--event-text-on-background, #111827)' }}
          >
            My Bids &amp; Donations
          </span>
          <span
            className='rounded-full px-2 py-0.5 text-xs font-medium'
            style={{
              backgroundColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.1)',
              color: 'rgb(var(--event-primary, 59, 130, 246))',
            }}
          >
            {activity.bids.length + activity.donations.length}
          </span>
        </div>
        {expanded ? (
          <ChevronUp
            className='h-4 w-4'
            style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}
          />
        ) : (
          <ChevronDown
            className='h-4 w-4'
            style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}
          />
        )}
      </button>

      {expanded && (
        <div className='border-t px-4 pb-4 pt-3' style={{ borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.1)' }}>

          {/* ── Bids ──────────────────────────────────────────────────────── */}
          {hasBids && (
            <div className='mb-4'>
              <div className='mb-2 flex items-center justify-between'>
                <div className='flex items-center gap-1.5'>
                  <Gavel
                    className='h-3.5 w-3.5'
                    style={{ color: 'rgb(var(--event-primary, 59, 130, 246))' }}
                  />
                  <span
                    className='text-xs font-semibold uppercase tracking-wide'
                    style={{ color: 'rgb(var(--event-primary, 59, 130, 246))' }}
                  >
                    Auction Bids
                  </span>
                </div>
                <span
                  className='text-xs font-semibold'
                  style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}
                >
                  Total: {fmtCurrency(totalBid)}
                </span>
              </div>

              {/* Search */}
              <div className='relative mb-2'>
                <Search
                  className='absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2'
                  style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}
                />
                <input
                  type='text'
                  placeholder='Search by item # or description…'
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className='w-full rounded-xl border bg-transparent py-2 pl-8 pr-3 text-sm outline-none focus:ring-1'
                  style={{
                    borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.25)',
                    color: 'var(--event-text-on-background, #111827)',
                  }}
                />
              </div>

              {filteredBids.length === 0 ? (
                <p
                  className='py-3 text-center text-sm italic'
                  style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}
                >
                  No bids match your search.
                </p>
              ) : (
                <>
                  {/* Table on md+, cards on sm */}
                  <div className='hidden md:block overflow-x-auto rounded-xl border' style={{ borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.12)' }}>
                    <table className='w-full text-sm'>
                      <thead>
                        <tr style={{ backgroundColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.06)' }}>
                          <th className='px-3 py-2 text-left font-semibold' style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}>#</th>
                          <th className='px-3 py-2 text-left font-semibold' style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}>Item</th>
                          <th className='px-3 py-2 text-right font-semibold' style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}>Your Bid</th>
                          <th className='px-3 py-2 text-center font-semibold' style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}>Status</th>
                          <th className='px-3 py-2 text-right font-semibold' style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}>Placed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredBids.map((bid) => {
                          const statusInfo = getStatusInfo(bid.bid_status)
                          return (
                            <tr key={bid.auction_item_id} className='border-t' style={{ borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.08)' }}>
                              <td className='px-3 py-2 font-mono font-semibold' style={{ color: 'rgb(var(--event-primary, 59, 130, 246))' }}>{bid.item_number}</td>
                              <td className='px-3 py-2 max-w-xs truncate' style={{ color: 'var(--event-text-on-background, #111827)' }}>{bid.item_title}</td>
                              <td className='px-3 py-2 text-right font-semibold' style={{ color: 'var(--event-text-on-background, #111827)' }}>{fmtCurrency(bid.bid_amount)}</td>
                              <td className='px-3 py-2 text-center'>
                                <span className='inline-block rounded-full px-2 py-0.5 text-xs font-semibold' style={{ color: statusInfo.color, backgroundColor: `${statusInfo.color}1a` }}>{statusInfo.label}</span>
                              </td>
                              <td className='px-3 py-2 text-right text-xs' style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}>{fmtDate(bid.placed_at)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className='grid gap-2 md:hidden'>
                    {filteredBids.map((bid) => {
                      const statusInfo = getStatusInfo(bid.bid_status)
                      return (
                        <div
                          key={bid.auction_item_id}
                          className='rounded-xl border px-3 py-2.5'
                          style={{
                            borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.12)',
                            backgroundColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.03)',
                          }}
                        >
                          <div className='flex items-start justify-between gap-2'>
                            <div className='min-w-0 flex-1'>
                              <p className='text-xs font-semibold' style={{ color: 'rgb(var(--event-primary, 59, 130, 246))' }}>Item #{bid.item_number}</p>
                              <p className='text-sm font-semibold truncate' style={{ color: 'var(--event-text-on-background, #111827)' }}>{bid.item_title}</p>
                            </div>
                            <div className='flex-shrink-0 text-right'>
                              <p className='text-base font-black' style={{ color: 'var(--event-text-on-background, #111827)' }}>{fmtCurrency(bid.bid_amount)}</p>
                              <span className='inline-block rounded-full px-2 py-0.5 text-xs font-semibold mt-0.5' style={{ color: statusInfo.color, backgroundColor: `${statusInfo.color}1a` }}>{statusInfo.label}</span>
                            </div>
                          </div>
                          <p className='mt-1 text-xs' style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}>{fmtDate(bid.placed_at)}</p>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Donations ──────────────────────────────────────────────────── */}
          {hasDonations && (
            <div>
              {hasBids && <div className='my-3 border-t' style={{ borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.1)' }} />}
              <div className='mb-2 flex items-center justify-between'>
                <div className='flex items-center gap-1.5'>
                  <Gift
                    className='h-3.5 w-3.5'
                    style={{ color: 'rgb(var(--event-primary, 59, 130, 246))' }}
                  />
                  <span
                    className='text-xs font-semibold uppercase tracking-wide'
                    style={{ color: 'rgb(var(--event-primary, 59, 130, 246))' }}
                  >
                    Paddle Raise Donations
                  </span>
                </div>
                <span
                  className='text-xs font-semibold'
                  style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}
                >
                  Total: {fmtCurrency(totalDonation)}
                </span>
              </div>

              <div className='grid gap-2'>
                {activity.donations.map((d) => (
                  <div
                    key={d.donation_id}
                    className='flex items-center justify-between rounded-xl border px-3 py-2.5'
                    style={{
                      borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.12)',
                      backgroundColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.03)',
                    }}
                  >
                    <div>
                      {d.labels.length > 0 && (
                        <p className='mb-0.5 text-xs' style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}>
                          {d.labels.join(' · ')}
                        </p>
                      )}
                      <p className='text-xs' style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}>
                        {fmtDate(d.donated_at)}
                      </p>
                    </div>
                    <p className='text-base font-black' style={{ color: 'var(--event-text-on-background, #111827)' }}>
                      {fmtCurrency(d.amount)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
