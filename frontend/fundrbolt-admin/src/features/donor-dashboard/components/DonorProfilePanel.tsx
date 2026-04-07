import { DataTableViewToggle } from '@/components/data-table/view-toggle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useViewPreference } from '@/hooks/use-view-preference'
import { ArrowLeft, Filter, Mail, Phone, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useDonorProfile } from '../hooks/useDonorDashboard'

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

interface DonorProfilePanelProps {
  userId: string
  eventId?: string
  npoId?: string
  onClose: () => void
}

interface ProfileFilters {
  bidItem: string
  donationSource: string
  ticketPackage: string
  eventName: string
}

export function DonorProfilePanel({
  userId,
  eventId,
  npoId,
  onClose,
}: DonorProfilePanelProps) {
  const [viewMode, setViewMode] = useViewPreference('donor-profile')
  const [filters, setFilters] = useState<ProfileFilters>({
    bidItem: '',
    donationSource: '',
    ticketPackage: '',
    eventName: '',
  })
  const [cardFiltersOpen, setCardFiltersOpen] = useState(false)

  const {
    data: profile,
    isLoading,
    isError,
    refetch,
  } = useDonorProfile(userId, { event_id: eventId, npo_id: npoId })

  const activeFilterCount = Object.values(filters).filter(Boolean).length

  const clearFilters = () =>
    setFilters({
      bidItem: '',
      donationSource: '',
      ticketPackage: '',
      eventName: '',
    })

  // Filter bid/donation/ticket history
  const filteredBids = useMemo(() => {
    if (!profile) return []
    let items = profile.bid_history
    if (filters.bidItem) {
      const q = filters.bidItem.toLowerCase()
      items = items.filter((b) => b.item_title.toLowerCase().includes(q))
    }
    if (filters.eventName) {
      const q = filters.eventName.toLowerCase()
      items = items.filter((b) => b.event_name.toLowerCase().includes(q))
    }
    return items
  }, [profile, filters.bidItem, filters.eventName])

  const filteredDonations = useMemo(() => {
    if (!profile) return []
    let items = profile.donation_history
    if (filters.donationSource) {
      const q = filters.donationSource.toLowerCase()
      items = items.filter((d) => d.source.toLowerCase().includes(q))
    }
    if (filters.eventName) {
      const q = filters.eventName.toLowerCase()
      items = items.filter((d) => d.event_name.toLowerCase().includes(q))
    }
    return items
  }, [profile, filters.donationSource, filters.eventName])

  const filteredTickets = useMemo(() => {
    if (!profile) return []
    let items = profile.ticket_history
    if (filters.ticketPackage) {
      const q = filters.ticketPackage.toLowerCase()
      items = items.filter((t) => t.package_name.toLowerCase().includes(q))
    }
    if (filters.eventName) {
      const q = filters.eventName.toLowerCase()
      items = items.filter((t) => t.event_name.toLowerCase().includes(q))
    }
    return items
  }, [profile, filters.ticketPackage, filters.eventName])

  if (isLoading) {
    return (
      <Card>
        <CardContent className='text-muted-foreground p-6 text-sm'>
          Loading donor profile...
        </CardContent>
      </Card>
    )
  }

  if (isError || !profile) {
    return (
      <Card>
        <CardContent className='space-y-4 p-6'>
          <p className='text-destructive text-sm'>
            Unable to load donor profile.
          </p>
          <Button type='button' onClick={() => void refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Group event history by NPO for cross-NPO view
  const npoGroups = new Map<string, typeof profile.event_history>()
  for (const event of profile.event_history) {
    const key = event.npo_name
    if (!npoGroups.has(key)) npoGroups.set(key, [])
    npoGroups.get(key)!.push(event)
  }

  // Determine if cross-NPO context should be shown in activity tables
  const showNpoColumn = npoGroups.size > 1

  const categoryChartData = profile.category_interests.map((c) => ({
    name: c.category,
    bids: c.bid_count,
    amount: c.total_bid_amount,
  }))

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between gap-4'>
        <div className='flex items-center gap-4'>
          <Button type='button' variant='ghost' size='sm' onClick={onClose}>
            <ArrowLeft className='mr-1 h-4 w-4' />
            Back
          </Button>
          <div>
            <h2 className='text-xl font-semibold'>
              {profile.first_name} {profile.last_name}
              {!profile.is_active && (
                <Badge variant='secondary' className='ml-2'>
                  Inactive
                </Badge>
              )}
            </h2>
            <div className='text-muted-foreground flex items-center gap-4 text-sm'>
              <span className='flex items-center gap-1'>
                <Mail className='h-3 w-3' /> {profile.email}
              </span>
              {profile.phone && (
                <span className='flex items-center gap-1'>
                  <Phone className='h-3 w-3' /> {profile.phone}
                </span>
              )}
            </div>
          </div>
        </div>
        <DataTableViewToggle value={viewMode} onChange={setViewMode} />
      </div>

      {/* Summary Cards */}
      <div className='grid grid-cols-2 gap-4 md:grid-cols-4'>
        <Card>
          <CardContent className='p-4'>
            <p className='text-muted-foreground text-xs'>Total Given</p>
            <p className='text-xl font-bold'>{fmt(profile.total_given)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='p-4'>
            <p className='text-muted-foreground text-xs'>Events Attended</p>
            <p className='text-xl font-bold'>{profile.events_attended}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='p-4'>
            <p className='text-muted-foreground text-xs'>Win Rate</p>
            <p className='text-xl font-bold'>
              {(profile.outbid_summary.win_rate * 100).toFixed(0)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='p-4'>
            <p className='text-muted-foreground text-xs'>Outbid Amount</p>
            <p className='text-xl font-bold'>
              {fmt(profile.outbid_summary.total_outbid_amount)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Card filter bar (shared for card mode) */}
      {viewMode === 'card' && (
        <div className='space-y-2'>
          <div className='flex items-center gap-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={() => setCardFiltersOpen(!cardFiltersOpen)}
            >
              <Filter className='mr-1 h-4 w-4' />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant='secondary' className='ml-1'>
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
            {activeFilterCount > 0 && (
              <Button variant='ghost' size='sm' onClick={clearFilters}>
                <X className='mr-1 h-4 w-4' />
                Clear
              </Button>
            )}
          </div>
          {cardFiltersOpen && (
            <div className='bg-muted/30 rounded-md border p-3'>
              <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4'>
                <div className='space-y-1'>
                  <span className='text-muted-foreground text-xs'>
                    Event name
                  </span>
                  <Input
                    placeholder='Filter event…'
                    value={filters.eventName}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        eventName: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className='space-y-1'>
                  <span className='text-muted-foreground text-xs'>
                    Bid item
                  </span>
                  <Input
                    placeholder='Filter item…'
                    value={filters.bidItem}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        bidItem: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className='space-y-1'>
                  <span className='text-muted-foreground text-xs'>
                    Donation source
                  </span>
                  <Input
                    placeholder='Filter source…'
                    value={filters.donationSource}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        donationSource: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className='space-y-1'>
                  <span className='text-muted-foreground text-xs'>
                    Ticket package
                  </span>
                  <Input
                    placeholder='Filter package…'
                    value={filters.ticketPackage}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        ticketPackage: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Event History */}
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Event History</CardTitle>
        </CardHeader>
        <CardContent>
          {profile.event_history.length === 0 ? (
            <p className='text-muted-foreground text-sm'>
              No event history found.
            </p>
          ) : viewMode === 'card' ? (
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
              {Array.from(npoGroups.entries()).flatMap(([npoName, events]) =>
                events.map((e) => (
                  <div
                    key={e.event_id}
                    className='space-y-1 rounded-md border p-3'
                  >
                    <div className='font-medium'>{e.event_name}</div>
                    {npoGroups.size > 1 && (
                      <Badge variant='outline' className='text-xs'>
                        {npoName}
                      </Badge>
                    )}
                    <dl className='grid grid-cols-2 gap-x-4 gap-y-1 text-sm'>
                      <dt className='text-muted-foreground'>Date</dt>
                      <dd>{fmtDate(e.event_date)}</dd>
                      <dt className='text-muted-foreground'>Checked In</dt>
                      <dd>
                        {e.checked_in ? (
                          <Badge variant='default'>Yes</Badge>
                        ) : (
                          <Badge variant='secondary'>No</Badge>
                        )}
                      </dd>
                      <dt className='text-muted-foreground'>Given</dt>
                      <dd className='font-semibold'>
                        {fmt(e.total_given_at_event)}
                      </dd>
                    </dl>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className='overflow-x-auto'>
              {Array.from(npoGroups.entries()).map(([npoName, events]) => (
                <div key={npoName} className='mb-4'>
                  {npoGroups.size > 1 && (
                    <h4 className='text-muted-foreground mb-2 text-sm font-medium'>
                      {npoName}
                    </h4>
                  )}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Checked In</TableHead>
                        <TableHead>Given</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.map((e) => (
                        <TableRow key={e.event_id}>
                          <TableCell>{e.event_name}</TableCell>
                          <TableCell>{fmtDate(e.event_date)}</TableCell>
                          <TableCell>
                            {e.checked_in ? (
                              <Badge variant='default'>Yes</Badge>
                            ) : (
                              <Badge variant='secondary'>No</Badge>
                            )}
                          </TableCell>
                          <TableCell>{fmt(e.total_given_at_event)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Interests Chart */}
      {categoryChartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Category Interests</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width='100%' height={300}>
              <BarChart data={categoryChartData} margin={{ bottom: 40 }}>
                <CartesianGrid vertical={false} strokeDasharray='3 3' />
                <XAxis
                  dataKey='name'
                  fontSize={12}
                  interval={0}
                  angle={-35}
                  textAnchor='end'
                />
                <YAxis tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-popover)',
                    color: 'var(--color-popover-foreground)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '0.375rem',
                  }}
                  formatter={(value, name) => [
                    name === 'amount' ? fmt(Number(value ?? 0)) : (value ?? 0),
                    name === 'amount' ? 'Bid Amount' : 'Bid Count',
                  ]}
                />
                <Bar
                  dataKey='amount'
                  fill='currentColor'
                  className='fill-primary'
                  radius={[4, 4, 0, 0]}
                  label={{
                    position: 'top' as const,
                    fontSize: 11,
                    formatter: ((v: unknown) => fmt(Number(v ?? 0))) as never,
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Bid History */}
      {profile.bid_history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Bid History</CardTitle>
          </CardHeader>
          <CardContent>
            {viewMode === 'card' ? (
              <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                {filteredBids.map((b) => (
                  <div
                    key={b.bid_id}
                    className='space-y-1 rounded-md border p-3'
                  >
                    <div className='flex items-center justify-between'>
                      <span className='font-medium'>{b.item_title}</span>
                      <Badge
                        variant={
                          b.bid_status === 'winning'
                            ? 'default'
                            : b.bid_status === 'outbid'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {b.bid_status}
                      </Badge>
                    </div>
                    {showNpoColumn && b.npo_name && (
                      <Badge variant='outline' className='text-xs'>
                        {b.npo_name}
                      </Badge>
                    )}
                    <dl className='grid grid-cols-2 gap-x-4 gap-y-1 text-sm'>
                      <dt className='text-muted-foreground'>Amount</dt>
                      <dd className='font-semibold'>{fmt(b.bid_amount)}</dd>
                      <dt className='text-muted-foreground'>Type</dt>
                      <dd>{b.bid_type}</dd>
                      <dt className='text-muted-foreground'>Event</dt>
                      <dd>{b.event_name}</dd>
                      <dt className='text-muted-foreground'>Date</dt>
                      <dd>{fmtDateTime(b.created_at)}</dd>
                    </dl>
                  </div>
                ))}
              </div>
            ) : (
              <div className='overflow-x-auto'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Event</TableHead>
                      {showNpoColumn && <TableHead>NPO</TableHead>}
                      <TableHead>Date</TableHead>
                    </TableRow>
                    {/* Filter row */}
                    <TableRow>
                      <TableHead>
                        <Input
                          placeholder='Filter item…'
                          value={filters.bidItem}
                          onChange={(e) =>
                            setFilters((prev) => ({
                              ...prev,
                              bidItem: e.target.value,
                            }))
                          }
                          className='h-7 text-xs'
                        />
                      </TableHead>
                      <TableHead />
                      <TableHead />
                      <TableHead />
                      <TableHead>
                        <Input
                          placeholder='Filter event…'
                          value={filters.eventName}
                          onChange={(e) =>
                            setFilters((prev) => ({
                              ...prev,
                              eventName: e.target.value,
                            }))
                          }
                          className='h-7 text-xs'
                        />
                      </TableHead>
                      {showNpoColumn && <TableHead />}
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBids.map((b) => (
                      <TableRow key={b.bid_id}>
                        <TableCell>{b.item_title}</TableCell>
                        <TableCell>{fmt(b.bid_amount)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              b.bid_status === 'winning'
                                ? 'default'
                                : b.bid_status === 'outbid'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                          >
                            {b.bid_status}
                          </Badge>
                        </TableCell>
                        <TableCell>{b.bid_type}</TableCell>
                        <TableCell>{b.event_name}</TableCell>
                        {showNpoColumn && (
                          <TableCell>
                            <Badge variant='outline'>{b.npo_name}</Badge>
                          </TableCell>
                        )}
                        <TableCell>{fmtDateTime(b.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Donation History */}
      {profile.donation_history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Donation History</CardTitle>
          </CardHeader>
          <CardContent>
            {viewMode === 'card' ? (
              <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                {filteredDonations.map((d) => (
                  <div
                    key={d.donation_id}
                    className='space-y-1 rounded-md border p-3'
                  >
                    <div className='font-semibold'>{fmt(d.amount)}</div>
                    {showNpoColumn && d.npo_name && (
                      <Badge variant='outline' className='text-xs'>
                        {d.npo_name}
                      </Badge>
                    )}
                    <dl className='grid grid-cols-2 gap-x-4 gap-y-1 text-sm'>
                      <dt className='text-muted-foreground'>Source</dt>
                      <dd>{d.source.replace(/_/g, ' ')}</dd>
                      <dt className='text-muted-foreground'>Event</dt>
                      <dd>{d.event_name}</dd>
                      <dt className='text-muted-foreground'>Date</dt>
                      <dd>{fmtDate(d.created_at)}</dd>
                    </dl>
                  </div>
                ))}
              </div>
            ) : (
              <div className='overflow-x-auto'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Amount</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Event</TableHead>
                      {showNpoColumn && <TableHead>NPO</TableHead>}
                      <TableHead>Date</TableHead>
                    </TableRow>
                    {/* Filter row */}
                    <TableRow>
                      <TableHead />
                      <TableHead>
                        <Input
                          placeholder='Filter source…'
                          value={filters.donationSource}
                          onChange={(e) =>
                            setFilters((prev) => ({
                              ...prev,
                              donationSource: e.target.value,
                            }))
                          }
                          className='h-7 text-xs'
                        />
                      </TableHead>
                      <TableHead>
                        <Input
                          placeholder='Filter event…'
                          value={filters.eventName}
                          onChange={(e) =>
                            setFilters((prev) => ({
                              ...prev,
                              eventName: e.target.value,
                            }))
                          }
                          className='h-7 text-xs'
                        />
                      </TableHead>
                      {showNpoColumn && <TableHead />}
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDonations.map((d) => (
                      <TableRow key={d.donation_id}>
                        <TableCell>{fmt(d.amount)}</TableCell>
                        <TableCell>{d.source.replace(/_/g, ' ')}</TableCell>
                        <TableCell>{d.event_name}</TableCell>
                        {showNpoColumn && (
                          <TableCell>
                            <Badge variant='outline'>{d.npo_name}</Badge>
                          </TableCell>
                        )}
                        <TableCell>{fmtDate(d.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Ticket History */}
      {profile.ticket_history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Ticket History</CardTitle>
          </CardHeader>
          <CardContent>
            {viewMode === 'card' ? (
              <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                {filteredTickets.map((t) => (
                  <div
                    key={t.purchase_id}
                    className='space-y-1 rounded-md border p-3'
                  >
                    <div className='font-medium'>{t.package_name}</div>
                    {showNpoColumn && t.npo_name && (
                      <Badge variant='outline' className='text-xs'>
                        {t.npo_name}
                      </Badge>
                    )}
                    <dl className='grid grid-cols-2 gap-x-4 gap-y-1 text-sm'>
                      <dt className='text-muted-foreground'>Qty</dt>
                      <dd>{t.quantity}</dd>
                      <dt className='text-muted-foreground'>Price</dt>
                      <dd className='font-semibold'>{fmt(t.total_price)}</dd>
                      <dt className='text-muted-foreground'>Event</dt>
                      <dd>{t.event_name}</dd>
                      <dt className='text-muted-foreground'>Date</dt>
                      <dd>{fmtDate(t.purchased_at)}</dd>
                    </dl>
                  </div>
                ))}
              </div>
            ) : (
              <div className='overflow-x-auto'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Package</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Event</TableHead>
                      {showNpoColumn && <TableHead>NPO</TableHead>}
                      <TableHead>Date</TableHead>
                    </TableRow>
                    {/* Filter row */}
                    <TableRow>
                      <TableHead>
                        <Input
                          placeholder='Filter package…'
                          value={filters.ticketPackage}
                          onChange={(e) =>
                            setFilters((prev) => ({
                              ...prev,
                              ticketPackage: e.target.value,
                            }))
                          }
                          className='h-7 text-xs'
                        />
                      </TableHead>
                      <TableHead />
                      <TableHead />
                      <TableHead>
                        <Input
                          placeholder='Filter event…'
                          value={filters.eventName}
                          onChange={(e) =>
                            setFilters((prev) => ({
                              ...prev,
                              eventName: e.target.value,
                            }))
                          }
                          className='h-7 text-xs'
                        />
                      </TableHead>
                      {showNpoColumn && <TableHead />}
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTickets.map((t) => (
                      <TableRow key={t.purchase_id}>
                        <TableCell>{t.package_name}</TableCell>
                        <TableCell>{t.quantity}</TableCell>
                        <TableCell>{fmt(t.total_price)}</TableCell>
                        <TableCell>{t.event_name}</TableCell>
                        {showNpoColumn && (
                          <TableCell>
                            <Badge variant='outline'>{t.npo_name}</Badge>
                          </TableCell>
                        )}
                        <TableCell>{fmtDate(t.purchased_at)}</TableCell>
                      </TableRow>
                    ))}
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
