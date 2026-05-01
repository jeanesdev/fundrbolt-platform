import { useEffect, useMemo, useState } from 'react'
import {
  MediaType,
  SlidePresentationLayout,
  type AuctionItemDetail,
} from '@/types/auction-item'
import { sanitizeHtmlFragment } from '@fundrbolt/shared/utils'
import { toast } from 'sonner'
import { useAuctionItemStore } from '@/stores/auctionItemStore'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
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
import { BidderAvatar } from '@/components/bidder-avatar'
import { useEventWorkspace } from '@/features/events/useEventWorkspace'
import { useAuctioneerItemDetail } from '../hooks/useAuctioneerData'

const fmtCurrency = (value: number | null | undefined) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value ?? 0)

const layoutOptions: Array<{
  value: SlidePresentationLayout
  label: string
}> = [
  { value: SlidePresentationLayout.ON_IMAGE, label: 'On image' },
  { value: SlidePresentationLayout.LEFT_OF_IMAGE, label: 'Left of image' },
  { value: SlidePresentationLayout.RIGHT_OF_IMAGE, label: 'Right of image' },
  { value: SlidePresentationLayout.BELOW_IMAGE, label: 'Below image' },
]

export function AuctioneerDetailPanel({ item }: { item: AuctionItemDetail }) {
  const { currentEvent } = useEventWorkspace()
  const { updateAuctionItem } = useAuctionItemStore()
  const { data, isLoading, error } = useAuctioneerItemDetail(
    currentEvent.id,
    item.id
  )
  const [slideHtml, setSlideHtml] = useState(item.slide_presentation_html ?? '')
  const [slideLayout, setSlideLayout] = useState<SlidePresentationLayout>(
    item.slide_presentation_layout ?? SlidePresentationLayout.BELOW_IMAGE
  )
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setSlideHtml(item.slide_presentation_html ?? '')
    setSlideLayout(
      item.slide_presentation_layout ?? SlidePresentationLayout.BELOW_IMAGE
    )
  }, [item.id, item.slide_presentation_html, item.slide_presentation_layout])

  const previewHtml = useMemo(
    () => sanitizeHtmlFragment(slideHtml),
    [slideHtml]
  )
  const previewImage = useMemo(
    () =>
      item.media.find((media) => media.media_type === MediaType.IMAGE)
        ?.file_path,
    [item.media]
  )

  const saveSlidePresentation = async () => {
    setIsSaving(true)
    try {
      await updateAuctionItem(currentEvent.id, item.id, {
        slide_presentation_html: slideHtml || null,
        slide_presentation_layout: slideLayout,
      })
      toast.success('Slide presentation saved')
    } catch (saveError) {
      toast.error(
        saveError instanceof Error
          ? saveError.message
          : 'Failed to save slide presentation'
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle>Auctioneer Live Details</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          {isLoading ? (
            <p className='text-muted-foreground text-sm'>
              Loading bid activity...
            </p>
          ) : error || !data ? (
            <p className='text-destructive text-sm'>
              Failed to load auctioneer bid details.
            </p>
          ) : (
            <>
              <div className='grid gap-3 sm:grid-cols-3'>
                <MetricCard
                  label='Current High Bid'
                  value={fmtCurrency(data.current_high_bid)}
                />
                <MetricCard
                  label='Total Bids'
                  value={data.item.bid_count.toString()}
                />
                <MetricCard
                  label='Bidders'
                  value={data.item.bidder_count.toString()}
                />
              </div>

              {data.high_bidder ? (
                <div className='rounded-lg border p-4'>
                  <p className='text-muted-foreground mb-2 text-xs font-medium uppercase'>
                    Current High Bidder
                  </p>
                  <BidderIdentity bidder={data.high_bidder} />
                </div>
              ) : null}

              <div className='grid gap-4 xl:grid-cols-2'>
                <Card>
                  <CardHeader>
                    <CardTitle className='text-base'>Bidder Totals</CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-3'>
                    {data.bidder_summaries.length ? (
                      data.bidder_summaries.map((summary) => (
                        <div
                          key={`${summary.bidder.bidder_number}-${summary.latest_bid_at}`}
                          className='flex items-start justify-between gap-3 rounded-md border p-3'
                        >
                          <BidderIdentity bidder={summary.bidder} />
                          <div className='text-right'>
                            <p className='font-semibold'>
                              {fmtCurrency(summary.highest_bid_amount)}
                            </p>
                            <p className='text-muted-foreground text-sm'>
                              {summary.bid_count} bids ·{' '}
                              {fmtCurrency(summary.total_bid_amount)} total
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className='text-muted-foreground text-sm'>
                        No bids yet.
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className='text-base'>Bid Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {data.bids.length ? (
                      <div className='max-h-[420px] overflow-auto'>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Bidder</TableHead>
                              <TableHead className='text-right'>
                                Amount
                              </TableHead>
                              <TableHead>Source</TableHead>
                              <TableHead>Placed</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.bids.map((bid) => (
                              <TableRow key={bid.id}>
                                <TableCell>
                                  <BidderIdentity bidder={bid.bidder} compact />
                                </TableCell>
                                <TableCell className='text-right font-semibold'>
                                  {fmtCurrency(bid.bid_amount)}
                                </TableCell>
                                <TableCell>
                                  <div className='flex flex-wrap gap-1'>
                                    <Badge variant='outline'>
                                      {bid.bid_source}
                                    </Badge>
                                    {bid.label_names.map((label) => (
                                      <Badge
                                        key={`${bid.id}-${label}`}
                                        variant='secondary'
                                      >
                                        {label}
                                      </Badge>
                                    ))}
                                  </div>
                                </TableCell>
                                <TableCell className='text-muted-foreground text-sm'>
                                  {new Date(bid.placed_at).toLocaleString()}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p className='text-muted-foreground text-sm'>
                        No bids yet.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Slide Presentation</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid gap-4 xl:grid-cols-[1.1fr_0.9fr]'>
            <div className='space-y-4'>
              <div className='space-y-2'>
                <p className='text-sm font-medium'>Slide Text Placement</p>
                <Select
                  value={slideLayout}
                  onValueChange={(value) =>
                    setSlideLayout(value as SlidePresentationLayout)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {layoutOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <p className='text-sm font-medium'>Presentation Copy</p>
                <RichTextEditor
                  value={slideHtml}
                  onChange={setSlideHtml}
                  placeholder='Add rich text that should appear on the auction slide...'
                />
              </div>

              <div className='flex justify-end'>
                <Button onClick={saveSlidePresentation} disabled={isSaving}>
                  {isSaving ? 'Saving…' : 'Save Slide Presentation'}
                </Button>
              </div>
            </div>

            <div className='space-y-2'>
              <p className='text-sm font-medium'>Slide Preview</p>
              <SlidePreview
                imageUrl={previewImage}
                html={previewHtml}
                layout={slideLayout}
                title={item.title}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-lg border p-4'>
      <p className='text-muted-foreground text-xs'>{label}</p>
      <p className='text-lg font-semibold'>{value}</p>
    </div>
  )
}

function BidderIdentity({
  bidder,
  compact = false,
}: {
  bidder: {
    bidder_name: string
    bidder_number: number | null
    table_number: number | null
    profile_picture_url: string | null
  }
  compact?: boolean
}) {
  return (
    <div className='flex items-center gap-3'>
      <BidderAvatar
        name={bidder.bidder_name}
        imageUrl={bidder.profile_picture_url}
        className={compact ? 'size-8' : 'size-10'}
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

function SlidePreview({
  imageUrl,
  html,
  layout,
  title,
}: {
  imageUrl?: string | null
  html: string
  layout: SlidePresentationLayout
  title: string
}) {
  const textBlock = (
    <div className='bg-background/90 rounded-lg border px-4 py-3 shadow-sm'>
      <h4 className='mb-2 font-semibold'>{title}</h4>
      <div
        className='prose prose-sm dark:prose-invert max-w-none'
        dangerouslySetInnerHTML={{
          __html:
            html ||
            '<p class="text-muted-foreground">No slide text added yet.</p>',
        }}
      />
    </div>
  )

  const imageBlock = (
    <div className='bg-muted/40 flex min-h-[220px] items-center justify-center overflow-hidden rounded-lg border'>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={title}
          className='h-full w-full object-cover'
        />
      ) : (
        <p className='text-muted-foreground text-sm'>No image uploaded</p>
      )}
    </div>
  )

  if (layout === SlidePresentationLayout.ON_IMAGE) {
    return (
      <div className='bg-card relative aspect-video overflow-hidden rounded-xl border p-3'>
        {imageBlock}
        <div className='absolute inset-x-8 bottom-8'>{textBlock}</div>
      </div>
    )
  }

  if (layout === SlidePresentationLayout.LEFT_OF_IMAGE) {
    return (
      <div className='bg-card grid aspect-video grid-cols-[0.95fr_1.05fr] gap-3 rounded-xl border p-3'>
        {textBlock}
        {imageBlock}
      </div>
    )
  }

  if (layout === SlidePresentationLayout.RIGHT_OF_IMAGE) {
    return (
      <div className='bg-card grid aspect-video grid-cols-[1.05fr_0.95fr] gap-3 rounded-xl border p-3'>
        {imageBlock}
        {textBlock}
      </div>
    )
  }

  return (
    <div className='bg-card grid aspect-video grid-rows-[1fr_auto] gap-3 rounded-xl border p-3'>
      {imageBlock}
      {textBlock}
    </div>
  )
}
