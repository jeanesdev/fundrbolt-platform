import { BidderAvatar } from '@/components/bidder-avatar'
import { DataTableViewToggle } from '@/components/data-table/view-toggle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useEventWorkspace } from '@/features/events/useEventWorkspace'
import { RGAuctioneerTab } from '@/features/revenue-generators'
import { useViewPreference } from '@/hooks/use-view-preference'
import { auctioneerService } from '@/services/auctioneerService'
import { reportService } from '@/services/reportService'
import { getAuctioneerRunOfShow } from '@/services/runOfShowService'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  ArrowUpDown,
  CalendarClock,
  CircleDollarSign,
  Clock,
  Coins,
  Download,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Gavel,
  HandCoins,
  Image as ImageIcon,
  Pin,
  PinOff,
  Target,
  Timer,
} from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { EventMapCard } from '../components/EventMapCard'
import { RosCountdownBadge } from '../components/RosCountdownBadge'
import { RunOfShowCard } from '../components/RunOfShowCard'
import {
  useAuctioneerDashboard,
  useAuctioneerSettings,
  useLiveAuctionGallery,
  usePaddleRaiseDashboard,
  useRevenueGeneratorItems,
  useSilentAuctionGallery,
  useUpsertSettings,
} from '../hooks/useAuctioneerData'

const fmtCurrency = (value: number | null | undefined) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value ?? 0)

const getTimeRemaining = (target: string | null | undefined) => {
  if (!target) return '--:--:--'

  const diff = new Date(target).getTime() - Date.now()
  if (diff <= 0) return '0:00:00'

  const hours = Math.floor(diff / 3_600_000)
  const minutes = Math.floor((diff % 3_600_000) / 60_000)
  const seconds = Math.floor((diff % 60_000) / 1_000)

  return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

const parsePositiveInteger = (value: string) => {
  const parsed = Number.parseInt(value.replace(/[^0-9]/g, ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

const matchesPaddleRaiseQuery = (
  query: string,
  bidder: {
    bidder_name: string
    bidder_number: number | null
    table_number: number | null
  },
  labelNames: string[] = []
) => {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return true

  return [
    bidder.bidder_name,
    bidder.bidder_number?.toString(),
    bidder.table_number?.toString(),
    ...labelNames,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(normalizedQuery)
}

interface AuctioneerDashboardPageProps {
  defaultTab?: 'live' | 'silent' | 'paddle' | 'revenue'
}

export function AuctioneerDashboardPage({
  defaultTab = 'live',
}: AuctioneerDashboardPageProps) {
  const navigate = useNavigate()
  const { currentEvent } = useEventWorkspace()
  const {
    data: dashboard,
    isLoading,
    error,
  } = useAuctioneerDashboard(currentEvent.id)
  const liveGallery = useLiveAuctionGallery(currentEvent.id)
  const silentGallery = useSilentAuctionGallery(currentEvent.id)
  const paddleRaise = usePaddleRaiseDashboard(currentEvent.id)
  const revenueGenerators = useRevenueGeneratorItems(currentEvent.id)
  const { data: settings } = useAuctioneerSettings(currentEvent.id)
  const upsertSettings = useUpsertSettings(currentEvent.id)
  const { data: rosData } = useQuery({
    queryKey: ['auctioneer-ros', currentEvent.id],
    queryFn: () => getAuctioneerRunOfShow(currentEvent.id),
    refetchInterval: 30_000,
  })
  const rosNextItem = rosData?.next_item ?? null
  const [silentViewMode, setSilentViewMode] = useViewPreference(
    'auctioneer-silent-gallery'
  )
  const [paddleLevelsInput, setPaddleLevelsInput] = useState('')
  const [paddleTotalGoalInput, setPaddleTotalGoalInput] = useState('')
  const [paddleLevelGoalInputs, setPaddleLevelGoalInputs] = useState<
    Record<string, string>
  >({})
  const [paddleDonationsFilter, setPaddleDonationsFilter] = useState('')
  const [paddleDonationsSort, setPaddleDonationsSort] = useState<
    'newest' | 'oldest' | 'amount_desc' | 'amount_asc' | 'bidder_asc'
  >('newest')
  const [activeTab, setActiveTab] = useState<
    'live' | 'silent' | 'paddle' | 'revenue'
  >(defaultTab)
  const [showCommissionTotals, setShowCommissionTotals] = useState(true)
  const [summaryPinned, setSummaryPinned] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('auctioneer-summary-pinned')
      return saved ? saved === 'true' : true
    } catch {
      return true
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('auctioneer-summary-pinned', String(summaryPinned))
    } catch {
      // Ignore localStorage failures
    }
  }, [summaryPinned])

  useEffect(() => {
    if (settings?.paddle_raise_levels?.length) {
      setPaddleLevelsInput(settings.paddle_raise_levels.join(', '))
      setPaddleTotalGoalInput(
        settings.paddle_raise_total_goal
          ? String(settings.paddle_raise_total_goal)
          : ''
      )
      setPaddleLevelGoalInputs(
        Object.fromEntries(
          settings.paddle_raise_levels.map((level) => [
            String(level),
            settings.paddle_raise_level_goals[String(level)]
              ? String(settings.paddle_raise_level_goals[String(level)])
              : '',
          ])
        )
      )
    }
  }, [
    settings?.paddle_raise_level_goals,
    settings?.paddle_raise_levels,
    settings?.paddle_raise_total_goal,
  ])

  const openItem = (itemId: string) => {
    void navigate({
      to: '/events/$eventId/auction-items/$itemId',
      params: {
        eventId: currentEvent.id,
        itemId,
      },
      search: {
        source: 'auctioneer',
      },
    })
  }

  const savePaddleSettings = () => {
    if (!settings) return
    const parsed = Array.from(
      new Set(
        paddleLevelsInput
          .split(',')
          .map((value) => Number.parseInt(value.trim(), 10))
          .filter((value) => Number.isFinite(value) && value > 0)
      )
    ).sort((a, b) => b - a)

    if (!parsed.length) return

    const parsedLevelGoals = Object.fromEntries(
      parsed
        .map((level) => [
          String(level),
          parsePositiveInteger(paddleLevelGoalInputs[String(level)] ?? ''),
        ])
        .filter((entry): entry is [string, number] => entry[1] !== null)
    )

    upsertSettings.mutate({
      live_auction_percent: settings.live_auction_percent,
      paddle_raise_percent: settings.paddle_raise_percent,
      silent_auction_percent: settings.silent_auction_percent,
      paddle_raise_levels: parsed,
      paddle_raise_total_goal: parsePositiveInteger(paddleTotalGoalInput),
      paddle_raise_level_goals: parsedLevelGoals,
    })
  }

  const reportToastId = useRef<string | number>('auctioneer-financial-report')

  const requestFinancialReport = () => {
    toast.loading('Generating Financial Report…', {
      id: reportToastId.current,
      duration: Infinity,
      description: 'This may take a moment.',
    })

    reportService
      .fetchAuctioneerReportBlob(currentEvent.id)
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob)
        const filename = `auctioneer-report-${currentEvent.slug || currentEvent.id}.pdf`

        toast.success('Financial Report Ready', {
          id: reportToastId.current,
          duration: Infinity,
          description: 'Your auctioneer financial report is ready.',
          action: {
            label: 'Download PDF',
            onClick: () => {
              const link = document.createElement('a')
              link.href = blobUrl
              link.download = filename
              link.click()
              URL.revokeObjectURL(blobUrl)
            },
          },
        })
      })
      .catch((err: unknown) => {
        toast.error('Report generation failed', {
          id: reportToastId.current,
          description: err instanceof Error ? err.message : 'Please try again.',
        })
      })
  }

  const exportLiveSlides = async () => {
    const blob = await auctioneerService.downloadLiveAuctionSlides(
      currentEvent.id
    )
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${currentEvent.slug || 'event'}-live-auction-slides.pptx`
    link.click()
    window.URL.revokeObjectURL(url)
  }

  const filteredDonations = useMemo(() => {
    const rows = [...(paddleRaise.data?.donations ?? [])].filter((donation) =>
      matchesPaddleRaiseQuery(
        paddleDonationsFilter,
        donation.bidder,
        donation.label_names
      )
    )

    rows.sort((left, right) => {
      if (paddleDonationsSort === 'amount_desc') {
        return Number(right.bid_amount) - Number(left.bid_amount)
      }

      if (paddleDonationsSort === 'amount_asc') {
        return Number(left.bid_amount) - Number(right.bid_amount)
      }

      if (paddleDonationsSort === 'oldest') {
        return (
          new Date(left.placed_at).getTime() -
          new Date(right.placed_at).getTime()
        )
      }

      if (paddleDonationsSort === 'bidder_asc') {
        return left.bidder.bidder_name.localeCompare(right.bidder.bidder_name)
      }

      return (
        new Date(right.placed_at).getTime() - new Date(left.placed_at).getTime()
      )
    })

    return rows
  }, [paddleDonationsFilter, paddleDonationsSort, paddleRaise.data?.donations])

  const revenueGeneratorHeaderCards = useMemo(() => {
    const items = [...(revenueGenerators.data ?? [])].sort(
      (left, right) => left.display_order - right.display_order
    )
    const totalRevenue = items.reduce(
      (sum, item) => sum + Number(item.total_revenue ?? 0),
      0
    )

    return {
      totalRevenue,
      items,
    }
  }, [revenueGenerators.data])

  if (isLoading) {
    return (
      <div className='space-y-4 px-2 py-4 sm:px-4'>
        <Skeleton className='h-20 w-full' />
        <Skeleton className='h-16 w-full' />
        <Skeleton className='h-96 w-full' />
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className='px-2 py-4 sm:px-4'>
        <p className='text-destructive'>Failed to load auctioneer dashboard.</p>
      </div>
    )
  }

  const liveTimerValue =
    dashboard.timers.live_auction_status === 'not_started'
      ? getTimeRemaining(dashboard.timers.live_auction_start_datetime)
      : dashboard.timers.live_auction_status === 'in_progress'
        ? 'Live'
        : 'Ended'

  const silentTimerValue =
    dashboard.timers.silent_auction_status === 'open'
      ? getTimeRemaining(dashboard.timers.auction_close_datetime)
      : dashboard.timers.silent_auction_status === 'not_started'
        ? 'Pending'
        : 'Ended'

  return (
    <div className='space-y-6 px-2 py-4 sm:px-4'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <h2 className='text-2xl font-bold'>Auctioneer Dashboard</h2>
          <p className='text-muted-foreground text-sm'>
            Run the live room, track silent activity, and monitor paddle raise
            results in real time.
          </p>
        </div>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={requestFinancialReport}
        >
          <FileText className='mr-1.5 h-4 w-4' />
          Financial Report
        </Button>
      </div>

      <div
        className={`bg-background/95 supports-[backdrop-filter]:bg-background/85 -mx-4 border-b px-4 py-2 backdrop-blur lg:-mx-6 lg:px-6 ${summaryPinned ? 'sticky top-14 z-20' : ''
          }`}
      >
        <div className='relative'>
          <div className='grid min-w-0 auto-cols-auto grid-flow-col grid-rows-2 gap-1.5 overflow-x-auto pr-8 pb-0.5'>
            {rosData && <RosCountdownBadge nextItem={rosNextItem} />}
            <CompactStatusChip
              icon={<CircleDollarSign className='h-3.5 w-3.5' />}
              label='Event'
              value={fmtCurrency(dashboard.event_totals.event_total_raised)}
            />
            {currentEvent.last_year_total != null && (
              <CompactStatusChip
                icon={<CalendarClock className='h-3.5 w-3.5' />}
                label='Last Year'
                value={fmtCurrency(currentEvent.last_year_total)}
              />
            )}
            <CompactStatusChip
              icon={<Coins className='h-3.5 w-3.5' />}
              label='Commission'
              onClick={() => setActiveTab('live')}
              value={
                showCommissionTotals
                  ? fmtCurrency(dashboard.earnings.total_earnings)
                  : 'Hidden'
              }
              action={
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  className='h-6 w-6'
                  onClick={() => setShowCommissionTotals((current) => !current)}
                  aria-label={
                    showCommissionTotals
                      ? 'Hide total commission'
                      : 'Show total commission'
                  }
                  title={
                    showCommissionTotals
                      ? 'Hide total commission'
                      : 'Show total commission'
                  }
                >
                  {showCommissionTotals ? (
                    <EyeOff className='h-3.5 w-3.5' />
                  ) : (
                    <Eye className='h-3.5 w-3.5' />
                  )}
                </Button>
              }
            />
            <CompactStatusChip
              icon={<Gavel className='h-3.5 w-3.5' />}
              label='Live Raised'
              value={fmtCurrency(dashboard.event_totals.live_auction_raised)}
              onClick={() => setActiveTab('live')}
            />
            <CompactStatusChip
              icon={<Target className='h-3.5 w-3.5' />}
              label='Silent Raised'
              value={fmtCurrency(dashboard.event_totals.silent_auction_raised)}
              onClick={() => setActiveTab('silent')}
            />
            <CompactStatusChip
              icon={<HandCoins className='h-3.5 w-3.5' />}
              label='Paddle Raised'
              value={fmtCurrency(dashboard.event_totals.paddle_raise_raised)}
              onClick={() => setActiveTab('paddle')}
            />
            <CompactStatusChip
              icon={<HandCoins className='h-3.5 w-3.5' />}
              label='Revenue Generators'
              value={fmtCurrency(revenueGeneratorHeaderCards.totalRevenue)}
              onClick={() => setActiveTab('revenue')}
            />
            {revenueGeneratorHeaderCards.items.map((item) => (
              <CompactStatusChip
                key={item.id}
                icon={<HandCoins className='h-3.5 w-3.5' />}
                label={item.name}
                value={fmtCurrency(item.total_revenue)}
                onClick={() => setActiveTab('revenue')}
              />
            ))}
            <CompactStatusChip
              icon={<Timer className='h-3.5 w-3.5' />}
              label='Live'
              value={liveTimerValue}
              onClick={() => setActiveTab('live')}
            />
            <CompactStatusChip
              icon={<Clock className='h-3.5 w-3.5' />}
              label='Silent'
              value={silentTimerValue}
              onClick={() => setActiveTab('silent')}
            />
          </div>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='absolute top-0 right-0 h-7 w-7'
            onClick={() => setSummaryPinned((current) => !current)}
            aria-label={
              summaryPinned ? 'Unpin summary header' : 'Pin summary header'
            }
            title={
              summaryPinned ? 'Unpin summary header' : 'Pin summary header'
            }
          >
            {summaryPinned ? (
              <PinOff className='h-3.5 w-3.5' />
            ) : (
              <Pin className='h-3.5 w-3.5' />
            )}
          </Button>
        </div>
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <RunOfShowCard eventId={currentEvent.id} />
        <EventMapCard layoutImageUrl={currentEvent.seating_layout_image_url} />
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) =>
          setActiveTab(v as 'live' | 'silent' | 'paddle' | 'revenue')
        }
        className='space-y-4'
      >
        <div className='overflow-x-auto'>
          <TabsList className='flex w-full min-w-max'>
            <TabsTrigger value='live' className='flex-1'>
              Live Auction
            </TabsTrigger>
            <TabsTrigger value='silent' className='flex-1'>
              Silent Auction
            </TabsTrigger>
            <TabsTrigger value='paddle' className='flex-1'>
              Paddle Raise
            </TabsTrigger>
            <TabsTrigger value='revenue' className='flex-1'>
              Revenue Generators
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value='live'>
          <ItemGallerySection
            title='Live Auction'
            subtitle='Gallery of live auction items with current room activity.'
            items={liveGallery.data?.items}
            isLoading={liveGallery.isLoading}
            error={liveGallery.error}
            totalItems={liveGallery.data?.total_items ?? 0}
            totalRaised={liveGallery.data?.total_raised ?? 0}
            totalBids={liveGallery.data?.total_bids ?? 0}
            viewMode='card'
            onItemClick={openItem}
            actions={
              <Button
                variant='outline'
                size='sm'
                onClick={() => void exportLiveSlides()}
              >
                <Download className='mr-1.5 h-4 w-4' />
                Export PowerPoint
              </Button>
            }
          />
        </TabsContent>

        <TabsContent value='silent'>
          <ItemGallerySection
            title='Silent Auction'
            subtitle='Switch between card and table layouts for silent auction items.'
            items={silentGallery.data?.items}
            isLoading={silentGallery.isLoading}
            error={silentGallery.error}
            totalItems={silentGallery.data?.total_items ?? 0}
            totalRaised={silentGallery.data?.total_raised ?? 0}
            totalBids={silentGallery.data?.total_bids ?? 0}
            viewMode={silentViewMode}
            onViewModeChange={setSilentViewMode}
            onItemClick={openItem}
          />
        </TabsContent>

        <TabsContent value='paddle'>
          <div className='space-y-4'>
            <CompactSummaryGrid
              cards={[
                {
                  label: 'Total Pledged',
                  value: fmtCurrency(paddleRaise.data?.total_pledged),
                  detail:
                    paddleRaise.data?.total_goal != null &&
                      paddleRaise.data?.total_goal_progress_percent != null
                      ? `Goal ${fmtCurrency(
                        paddleRaise.data.total_goal
                      )} · ${paddleRaise.data.total_goal_progress_percent.toFixed(2)}% complete`
                      : undefined,
                },
                {
                  label: 'Last Hero Total',
                  value: fmtCurrency(paddleRaise.data?.last_hero_total),
                },
                {
                  label: 'Donation Count',
                  value: `${paddleRaise.data?.donation_count ?? 0}`,
                },
                {
                  label: 'Participation',
                  value: `${(paddleRaise.data?.participation_percent ?? 0).toFixed(2)}%`,
                },
              ]}
            />

            <Card>
              <CardHeader>
                <CardTitle>Paddle Raise Levels</CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]'>
                  <Input
                    value={paddleLevelsInput}
                    onChange={(event) =>
                      setPaddleLevelsInput(event.target.value)
                    }
                    placeholder='10000, 5000, 2500, 1000, 500, 250, 100'
                  />
                  <Input
                    value={paddleTotalGoalInput}
                    onChange={(event) =>
                      setPaddleTotalGoalInput(event.target.value)
                    }
                    inputMode='numeric'
                    placeholder='Paddle raise total goal'
                  />
                  <Button
                    onClick={savePaddleSettings}
                    disabled={upsertSettings.isPending || !settings}
                  >
                    Save Goals
                  </Button>
                </div>
                <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
                  {(paddleRaise.data?.level_summaries ?? []).map((level) => (
                    <Card key={`${level.amount}-${level.is_monthly}`}>
                      <CardContent className='space-y-2 pt-4'>
                        <div className='flex items-center gap-2'>
                          <p className='text-lg font-semibold'>
                            {fmtCurrency(level.amount)}
                          </p>
                          {level.is_monthly ? (
                            <Badge variant='outline'>Monthly</Badge>
                          ) : null}
                        </div>
                        <p className='text-muted-foreground text-sm'>
                          {level.bidder_count} bidders ·{' '}
                          {fmtCurrency(level.total_amount)}
                        </p>
                        <p className='text-muted-foreground text-xs'>
                          Participation {level.participation_percent.toFixed(2)}
                          %
                        </p>
                        {level.goal_amount != null &&
                          level.goal_progress_percent != null ? (
                          <p className='text-muted-foreground text-xs'>
                            Goal {fmtCurrency(level.goal_amount)} ·{' '}
                            {level.goal_progress_percent.toFixed(2)}% complete
                          </p>
                        ) : null}
                        {!level.is_monthly ? (
                          <Input
                            value={
                              paddleLevelGoalInputs[String(level.amount)] ?? ''
                            }
                            onChange={(event) =>
                              setPaddleLevelGoalInputs((current) => ({
                                ...current,
                                [String(level.amount)]: event.target.value,
                              }))
                            }
                            inputMode='numeric'
                            placeholder='Level goal'
                          />
                        ) : null}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className='grid gap-4 xl:grid-cols-2'>
              <BidderTotalsCard
                title='Paddle Raise Totals by Bidder'
                rows={paddleRaise.data?.bidder_totals ?? []}
              />
              <BidderTotalsCard
                title='Last Hero Totals by Bidder'
                rows={paddleRaise.data?.last_hero_bidder_totals ?? []}
                highlightLastHero
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Live Paddle Raise Results</CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                {paddleRaise.isLoading ? (
                  <Skeleton className='h-56 w-full' />
                ) : paddleRaise.error ? (
                  <p className='text-destructive'>
                    Failed to load paddle raise results.
                  </p>
                ) : (
                  <div className='space-y-4'>
                    <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
                      <Input
                        value={paddleDonationsFilter}
                        onChange={(event) =>
                          setPaddleDonationsFilter(event.target.value)
                        }
                        placeholder='Filter by bidder, bidder #, table, or label'
                        className='md:max-w-sm'
                      />
                      <Select
                        value={paddleDonationsSort}
                        onValueChange={(value) =>
                          setPaddleDonationsSort(
                            value as
                            | 'newest'
                            | 'oldest'
                            | 'amount_desc'
                            | 'amount_asc'
                            | 'bidder_asc'
                          )
                        }
                      >
                        <SelectTrigger className='w-full md:w-52'>
                          <SelectValue placeholder='Sort donations' />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='newest'>Newest first</SelectItem>
                          <SelectItem value='oldest'>Oldest first</SelectItem>
                          <SelectItem value='amount_desc'>
                            Amount high to low
                          </SelectItem>
                          <SelectItem value='amount_asc'>
                            Amount low to high
                          </SelectItem>
                          <SelectItem value='bidder_asc'>Bidder A-Z</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <p className='text-muted-foreground text-sm'>
                      Showing {filteredDonations.length} of{' '}
                      {paddleRaise.data?.donations?.length ?? 0} donations
                    </p>
                    <div className='overflow-x-auto'>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Bidder</TableHead>
                            <TableHead>Labels</TableHead>
                            <TableHead className='text-right'>Amount</TableHead>
                            <TableHead>Entered</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredDonations.map((donation) => (
                            <TableRow key={donation.id}>
                              <TableCell>
                                <BidderIdentity bidder={donation.bidder} />
                              </TableCell>
                              <TableCell>
                                <div className='flex flex-wrap gap-1'>
                                  {donation.label_names.length ? (
                                    donation.label_names.map((label) => (
                                      <Badge
                                        key={`${donation.id}-${label}`}
                                        variant='outline'
                                      >
                                        {label}
                                      </Badge>
                                    ))
                                  ) : (
                                    <span className='text-muted-foreground text-sm'>
                                      —
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className='text-right font-semibold'>
                                {fmtCurrency(donation.bid_amount)}
                              </TableCell>
                              <TableCell className='text-muted-foreground text-sm'>
                                {new Date(donation.placed_at).toLocaleString()}
                              </TableCell>
                            </TableRow>
                          ))}
                          {!filteredDonations.length ? (
                            <TableRow>
                              <TableCell
                                colSpan={4}
                                className='text-muted-foreground py-6 text-center'
                              >
                                No matching paddle raise donations.
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value='revenue'>
          <RGAuctioneerTab eventId={currentEvent.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function CompactSummaryGrid({
  cards,
}: {
  cards: Array<{
    label: string
    value: string
    detail?: string
    action?: ReactNode
  }>
}) {
  return (
    <div className='grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4'>
      {cards.map((card) => (
        <Card key={card.label} className='shadow-none'>
          <CardContent className='px-3 py-2'>
            <div className='flex items-center justify-between gap-1'>
              <p className='text-muted-foreground text-xs leading-none'>
                {card.label}
              </p>
              {card.action}
            </div>
            <p className='mt-0.5 text-sm leading-tight font-semibold'>
              {card.value}
            </p>
            {card.detail ? (
              <p className='text-muted-foreground mt-1 text-[11px] leading-tight'>
                {card.detail}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function CompactStatusChip({
  label,
  value,
  icon,
  action,
  onClick,
}: {
  label: string
  value: string
  icon?: ReactNode
  action?: ReactNode
  onClick?: () => void
}) {
  return (
    <div
      className={`bg-muted/70 flex min-h-9 items-center gap-2 rounded-md border px-2.5 py-1 text-xs${onClick
          ? 'hover:bg-muted hover:border-foreground/20 cursor-pointer transition-colors'
          : ''
        }`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') onClick()
          }
          : undefined
      }
    >
      {icon ? (
        <span className='text-muted-foreground shrink-0'>{icon}</span>
      ) : null}
      <div className='min-w-0'>
        <div className='text-muted-foreground leading-none'>{label}</div>
        <div className='truncate pt-0.5 leading-none font-semibold'>
          {value}
        </div>
      </div>
      {action ? <div className='ml-1 shrink-0'>{action}</div> : null}
    </div>
  )
}

function ItemGallerySection({
  title,
  subtitle,
  items,
  isLoading,
  error,
  totalItems,
  totalRaised,
  totalBids,
  viewMode,
  onViewModeChange,
  onItemClick,
  actions,
}: {
  title: string
  subtitle: string
  items:
  | Array<{
    id: string
    bid_number: number | null
    title: string
    current_bid_amount: number | null
    bid_count: number
    bidder_count: number
    primary_image_url: string | null
    donor_value: number | null
    auction_type: string
    has_commission: boolean
    has_bounty: boolean
    commission_percent: number | null
    flat_fee: number | null
  }>
  | null
  | undefined
  isLoading: boolean
  error: unknown
  totalItems: number
  totalRaised: number
  totalBids: number
  viewMode: 'card' | 'table'
  onViewModeChange?: (mode: 'card' | 'table') => void
  onItemClick: (itemId: string) => void
  actions?: ReactNode
}) {
  const [tableFilters, setTableFilters] = useState({
    item: '',
    highBid: '',
    bids: '',
    bidders: '',
    payout: 'all',
  })
  const [tableSortKey, setTableSortKey] = useState<
    'item' | 'highBid' | 'bids' | 'bidders' | 'payout'
  >('highBid')
  const [tableSortDirection, setTableSortDirection] = useState<'asc' | 'desc'>(
    'desc'
  )

  const displayedTableItems = useMemo(() => {
    const filteredItems = [...(items ?? [])].filter((item) => {
      if (
        tableFilters.item &&
        !`${item.bid_number ?? ''} ${item.title}`
          .toLowerCase()
          .includes(tableFilters.item.trim().toLowerCase())
      ) {
        return false
      }

      if (
        tableFilters.highBid &&
        !String(Number(item.current_bid_amount ?? 0)).includes(
          tableFilters.highBid.trim()
        )
      ) {
        return false
      }

      if (
        tableFilters.bids &&
        !String(item.bid_count).includes(tableFilters.bids.trim())
      ) {
        return false
      }

      if (
        tableFilters.bidders &&
        !String(item.bidder_count).includes(tableFilters.bidders.trim())
      ) {
        return false
      }

      if (tableFilters.payout === 'commission' && !item.has_commission) {
        return false
      }

      if (tableFilters.payout === 'bounty' && !item.has_bounty) {
        return false
      }

      if (
        tableFilters.payout === 'none' &&
        (item.has_commission || item.has_bounty)
      ) {
        return false
      }

      return true
    })

    filteredItems.sort((left, right) => {
      const getPayoutValue = (item: (typeof filteredItems)[number]) => {
        if (item.has_commission) return Number(item.commission_percent ?? 0)
        if (item.has_bounty) return Number(item.flat_fee ?? 0)
        return -1
      }

      let compare = 0
      switch (tableSortKey) {
        case 'item':
          compare = `${left.bid_number ?? ''} ${left.title}`.localeCompare(
            `${right.bid_number ?? ''} ${right.title}`
          )
          break
        case 'highBid':
          compare =
            Number(left.current_bid_amount ?? 0) -
            Number(right.current_bid_amount ?? 0)
          break
        case 'bids':
          compare = left.bid_count - right.bid_count
          break
        case 'bidders':
          compare = left.bidder_count - right.bidder_count
          break
        case 'payout':
          compare = getPayoutValue(left) - getPayoutValue(right)
          break
      }

      return tableSortDirection === 'asc' ? compare : -compare
    })

    return filteredItems
  }, [items, tableFilters, tableSortDirection, tableSortKey])

  const handleTableSortChange = (
    key: 'item' | 'highBid' | 'bids' | 'bidders' | 'payout'
  ) => {
    if (tableSortKey === key) {
      setTableSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }

    setTableSortKey(key)
    setTableSortDirection(key === 'item' ? 'asc' : 'desc')
  }

  const updateTableFilter = (key: keyof typeof tableFilters, value: string) => {
    setTableFilters((current) => ({
      ...current,
      [key]: value,
    }))
  }

  const sortIndicator = (
    key: 'item' | 'highBid' | 'bids' | 'bidders' | 'payout'
  ) => {
    if (tableSortKey !== key) return null
    return tableSortDirection === 'asc' ? '^' : 'v'
  }

  const renderTextHeader = (
    label: string,
    key: 'item' | 'highBid' | 'bids' | 'bidders',
    filterKey: 'item' | 'highBid' | 'bids' | 'bidders',
    placeholder: string,
    className?: string
  ) => (
    <TableHead className={className}>
      <div className='flex items-center gap-2'>
        <button
          className='flex items-center gap-2'
          onClick={() => handleTableSortChange(key)}
          type='button'
        >
          {label}
          <ArrowUpDown className='text-muted-foreground h-3 w-3' />
          <span className='text-muted-foreground text-xs'>
            {sortIndicator(key)}
          </span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className='text-muted-foreground hover:text-foreground rounded-sm p-1'
              type='button'
              aria-label={`Filter ${label}`}
            >
              <Filter className='h-3 w-3' />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='start' className='w-56'>
            <DropdownMenuLabel>{label}</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => handleTableSortChange(key)}>
              Toggle sort
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Filter</DropdownMenuLabel>
            <div
              className='px-2 py-2'
              onClick={(event) => event.stopPropagation()}
            >
              <Input
                placeholder={placeholder}
                value={tableFilters[filterKey]}
                onChange={(event) =>
                  updateTableFilter(filterKey, event.target.value)
                }
                onKeyDown={(event) => event.stopPropagation()}
              />
            </div>
            <DropdownMenuItem
              disabled={!tableFilters[filterKey]}
              onSelect={() => updateTableFilter(filterKey, '')}
            >
              Clear filter
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TableHead>
  )

  const renderPayoutHeader = () => (
    <TableHead>
      <div className='flex items-center gap-2'>
        <button
          className='flex items-center gap-2'
          onClick={() => handleTableSortChange('payout')}
          type='button'
        >
          Comp / Bounty
          <ArrowUpDown className='text-muted-foreground h-3 w-3' />
          <span className='text-muted-foreground text-xs'>
            {sortIndicator('payout')}
          </span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className='text-muted-foreground hover:text-foreground rounded-sm p-1'
              type='button'
              aria-label='Filter payout'
            >
              <Filter className='h-3 w-3' />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='start' className='w-56'>
            <DropdownMenuLabel>Comp / Bounty</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => handleTableSortChange('payout')}>
              Toggle sort
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Filter</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={tableFilters.payout}
              onValueChange={(value) => updateTableFilter('payout', value)}
            >
              <DropdownMenuRadioItem value='all'>
                All items
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value='commission'>
                Commission only
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value='bounty'>
                Bounty only
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value='none'>
                No payout
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TableHead>
  )

  return (
    <div className='space-y-4'>
      <div className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
        <div>
          <h3 className='text-xl font-semibold'>{title}</h3>
          <p className='text-muted-foreground text-sm'>{subtitle}</p>
        </div>
        <div className='flex items-center gap-2'>
          {onViewModeChange ? (
            <DataTableViewToggle value={viewMode} onChange={onViewModeChange} />
          ) : null}
          {actions}
        </div>
      </div>

      <CompactSummaryGrid
        cards={[
          { label: 'Items', value: `${totalItems}` },
          { label: 'Total Raised', value: fmtCurrency(totalRaised) },
          { label: 'Total Bids', value: `${totalBids}` },
          {
            label: 'Avg. Bids Per Item',
            value: totalItems
              ? `${(totalBids / totalItems).toFixed(1)}`
              : '0.0',
          },
        ]}
      />

      {isLoading ? (
        <Skeleton className='h-80 w-full' />
      ) : error ? (
        <p className='text-destructive'>
          Failed to load {title.toLowerCase()}.
        </p>
      ) : !items?.length ? (
        <Card>
          <CardContent className='py-8 text-center'>
            <p className='text-muted-foreground'>No items available.</p>
          </CardContent>
        </Card>
      ) : viewMode === 'table' ? (
        <Card>
          <CardContent className='space-y-3 p-0'>
            <div className='text-muted-foreground px-4 pt-4 text-sm'>
              Showing {displayedTableItems.length} of {items.length} items
            </div>
            <div className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow>
                    {renderTextHeader(
                      'Item',
                      'item',
                      'item',
                      'Filter by item title or bid #'
                    )}
                    {renderTextHeader(
                      'High Bid',
                      'highBid',
                      'highBid',
                      'Filter by high bid',
                      'text-right'
                    )}
                    {renderTextHeader(
                      'Bids',
                      'bids',
                      'bids',
                      'Filter by bid count',
                      'text-right'
                    )}
                    {renderTextHeader(
                      'Bidders',
                      'bidders',
                      'bidders',
                      'Filter by bidder count',
                      'text-right'
                    )}
                    {renderPayoutHeader()}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedTableItems.map((item) => (
                    <TableRow
                      key={item.id}
                      className='cursor-pointer'
                      onClick={() => onItemClick(item.id)}
                    >
                      <TableCell>
                        <div className='flex items-center gap-3'>
                          <div className='bg-muted/50 flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md'>
                            {item.primary_image_url ? (
                              <img
                                src={item.primary_image_url}
                                alt={item.title}
                                className='h-full w-full object-cover'
                              />
                            ) : (
                              <ImageIcon className='text-muted-foreground h-4 w-4' />
                            )}
                          </div>
                          <div className='font-medium'>
                            #{item.bid_number ?? '—'} {item.title}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className='text-right font-semibold'>
                        {fmtCurrency(item.current_bid_amount)}
                      </TableCell>
                      <TableCell className='text-right'>
                        {item.bid_count}
                      </TableCell>
                      <TableCell className='text-right'>
                        {item.bidder_count}
                      </TableCell>
                      <TableCell>
                        <CommissionBadges item={item} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {!displayedTableItems.length ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className='text-muted-foreground py-8 text-center'
                      >
                        No silent auction items match the current filters.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
          {items.map((item) => (
            <Card
              key={item.id}
              className='cursor-pointer overflow-hidden transition-shadow hover:shadow-md'
              onClick={() => onItemClick(item.id)}
            >
              <div className='bg-muted/50 aspect-[16/10] overflow-hidden'>
                {item.primary_image_url ? (
                  <img
                    src={item.primary_image_url}
                    alt={item.title}
                    className='h-full w-full object-cover'
                  />
                ) : (
                  <div className='flex h-full items-center justify-center'>
                    <ImageIcon className='text-muted-foreground h-8 w-8' />
                  </div>
                )}
              </div>
              <CardContent className='space-y-3 pt-4'>
                <div>
                  <p className='text-muted-foreground text-xs'>
                    #{item.bid_number ?? '—'}
                  </p>
                  <h4 className='line-clamp-2 font-semibold'>{item.title}</h4>
                </div>
                <div className='grid grid-cols-3 gap-2 text-sm'>
                  <Metric
                    label='High Bid'
                    value={fmtCurrency(item.current_bid_amount)}
                  />
                  <Metric label='Bids' value={`${item.bid_count}`} />
                  <Metric label='Bidders' value={`${item.bidder_count}`} />
                </div>
                <CommissionBadges item={item} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className='text-muted-foreground text-xs'>{label}</p>
      <p className='font-medium'>{value}</p>
    </div>
  )
}

function CommissionBadges({
  item,
}: {
  item: {
    has_commission: boolean
    has_bounty: boolean
    commission_percent: number | null
    flat_fee: number | null
    donor_value: number | null
  }
}) {
  const commissionPercent =
    item.commission_percent == null ? null : Number(item.commission_percent)
  const flatFee = item.flat_fee == null ? null : Number(item.flat_fee)
  const saleAmount = item.donor_value == null ? null : Number(item.donor_value)
  const commissionAmount =
    commissionPercent != null && saleAmount != null
      ? (saleAmount * commissionPercent) / 100
      : null

  return (
    <div className='flex flex-wrap gap-1'>
      {item.has_commission ? (
        <Badge variant='secondary'>
          Commission {commissionPercent?.toFixed(0) ?? 0}%{' '}
          {commissionAmount != null ? `(${fmtCurrency(commissionAmount)})` : ''}
        </Badge>
      ) : null}
      {item.has_bounty ? (
        <Badge variant='outline'>Bounty {fmtCurrency(flatFee)}</Badge>
      ) : null}
      {!item.has_commission && !item.has_bounty ? (
        <Badge variant='outline'>No payout</Badge>
      ) : null}
    </div>
  )
}

function BidderTotalsCard({
  title,
  rows,
  highlightLastHero = false,
}: {
  title: string
  rows: Array<{
    bidder: {
      bidder_name: string
      bidder_number: number | null
      table_number: number | null
      profile_picture_url: string | null
    }
    total_amount: number
    donation_count: number
    label_names: string[]
    is_last_hero: boolean
  }>
  highlightLastHero?: boolean
}) {
  const [filterValue, setFilterValue] = useState('')
  const [sortValue, setSortValue] = useState<
    'amount_desc' | 'amount_asc' | 'count_desc' | 'count_asc' | 'bidder_asc'
  >('amount_desc')

  const filteredRows = useMemo(() => {
    const nextRows = [...rows].filter((row) =>
      matchesPaddleRaiseQuery(filterValue, row.bidder, row.label_names)
    )

    nextRows.sort((left, right) => {
      if (sortValue === 'amount_asc') {
        return Number(left.total_amount) - Number(right.total_amount)
      }

      if (sortValue === 'count_desc') {
        return right.donation_count - left.donation_count
      }

      if (sortValue === 'count_asc') {
        return left.donation_count - right.donation_count
      }

      if (sortValue === 'bidder_asc') {
        return left.bidder.bidder_name.localeCompare(right.bidder.bidder_name)
      }

      return Number(right.total_amount) - Number(left.total_amount)
    })

    return nextRows
  }, [filterValue, rows, sortValue])

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
          <Input
            value={filterValue}
            onChange={(event) => setFilterValue(event.target.value)}
            placeholder='Filter by bidder, bidder #, table, or label'
            className='md:max-w-sm'
          />
          <Select
            value={sortValue}
            onValueChange={(value) =>
              setSortValue(
                value as
                | 'amount_desc'
                | 'amount_asc'
                | 'count_desc'
                | 'count_asc'
                | 'bidder_asc'
              )
            }
          >
            <SelectTrigger className='w-full md:w-52'>
              <SelectValue placeholder='Sort bidders' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='amount_desc'>Amount high to low</SelectItem>
              <SelectItem value='amount_asc'>Amount low to high</SelectItem>
              <SelectItem value='count_desc'>Most bids</SelectItem>
              <SelectItem value='count_asc'>Fewest bids</SelectItem>
              <SelectItem value='bidder_asc'>Bidder A-Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className='text-muted-foreground text-sm'>
          Showing {filteredRows.length} of {rows.length} bidders
        </p>
        <div className='space-y-3'>
          {filteredRows.length ? (
            filteredRows.map((row) => (
              <div
                key={`${row.bidder.bidder_number}-${title}`}
                className='flex items-start justify-between gap-3 rounded-md border p-3'
              >
                <BidderIdentity bidder={row.bidder} />
                <div className='text-right'>
                  <p className='font-semibold'>
                    {fmtCurrency(row.total_amount)}
                  </p>
                  <p className='text-muted-foreground text-sm'>
                    {row.donation_count} bids
                  </p>
                  {highlightLastHero || row.is_last_hero ? (
                    <div className='mt-1 flex justify-end gap-1'>
                      {row.label_names.map((label) => (
                        <Badge key={`${title}-${label}`} variant='outline'>
                          {label}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          ) : rows.length ? (
            <p className='text-muted-foreground text-sm'>
              No matching bidders.
            </p>
          ) : (
            <p className='text-muted-foreground text-sm'>No bidders yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function BidderIdentity({
  bidder,
}: {
  bidder: {
    bidder_name: string
    bidder_number: number | null
    table_number: number | null
    profile_picture_url: string | null
  }
}) {
  return (
    <div className='flex items-center gap-3'>
      <BidderAvatar
        name={bidder.bidder_name}
        imageUrl={bidder.profile_picture_url}
        className='size-9'
      />
      <div>
        <p className='font-medium'>{bidder.bidder_name}</p>
        <p className='text-muted-foreground text-sm'>
          #{bidder.bidder_number ?? '—'} · Table {bidder.table_number ?? '—'}
        </p>
      </div>
    </div>
  )
}
