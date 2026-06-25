import { Button } from '@/components/ui/button'
import { useNavigate } from '@tanstack/react-router'
import { Check, ChevronDown, ChevronUp, ExternalLink, X } from 'lucide-react'
import { useRef, useState } from 'react'
import type { NudgeItem } from './types'

function parseActionUrl(actionUrl: string): {
  pathname: string
  search: Record<string, string>
} {
  const [pathname, query] = actionUrl.split('?')
  const search = query
    ? Object.fromEntries(new URLSearchParams(query).entries())
    : {}
  return { pathname, search }
}

const RANK_STYLES: Record<
  number,
  { border: string; badge: string; bg: string }
> = {
  1: {
    border: 'border-l-red-500',
    badge: 'bg-red-500 text-white',
    bg: 'bg-red-50',
  },
  2: {
    border: 'border-l-amber-500',
    badge: 'bg-amber-500 text-white',
    bg: 'bg-amber-50',
  },
  3: {
    border: 'border-l-blue-500',
    badge: 'bg-blue-500 text-white',
    bg: 'bg-blue-50',
  },
  4: {
    border: 'border-l-slate-400',
    badge: 'bg-slate-400 text-white',
    bg: 'bg-slate-50',
  },
  5: {
    border: 'border-l-slate-300',
    badge: 'bg-slate-300 text-slate-700',
    bg: 'bg-slate-50',
  },
}

interface DetailItem {
  item_id: string
  item_name: string
  item_url?: string
  watchers: string[]
  watcher_count: number
}

interface NoBidItemDetail {
  item_id: string
  item_name: string
  item_url: string
}

interface ParetoDonorDetail {
  donor_name: string
  table_number?: number
  donor_number?: number
  total_amount: number
}

function parseDetailItems(nudge: NudgeItem): DetailItem[] {
  const raw = nudge.metadata.detail_items
  if (!Array.isArray(raw)) {
    return []
  }

  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null
      }

      const record = entry as Record<string, unknown>
      const itemId = record.item_id
      const itemName = record.item_name
      const watchers = record.watchers
      const watcherCount = record.watcher_count
      const itemUrl = record.item_url

      if (typeof itemId !== 'string' || typeof itemName !== 'string') {
        return null
      }

      if (!Array.isArray(watchers)) {
        return null
      }

      const watcherNames = watchers.filter(
        (w): w is string => typeof w === 'string' && w.trim().length > 0
      )
      const resolvedCount =
        typeof watcherCount === 'number' ? watcherCount : watcherNames.length

      const detail: DetailItem = {
        item_id: itemId,
        item_name: itemName,
        watchers: watcherNames,
        watcher_count: resolvedCount,
      }

      if (typeof itemUrl === 'string') {
        detail.item_url = itemUrl
      }

      return detail
    })
    .filter((entry): entry is DetailItem => entry !== null)
}

function parseNoBidItemDetails(nudge: NudgeItem): NoBidItemDetail[] {
  const raw = nudge.metadata.item_details
  if (!Array.isArray(raw)) {
    return []
  }

  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null
      }

      const record = entry as Record<string, unknown>
      const itemId = record.item_id
      const itemName = record.item_name
      const itemUrl = record.item_url

      if (
        typeof itemId !== 'string' ||
        typeof itemName !== 'string' ||
        typeof itemUrl !== 'string'
      ) {
        return null
      }

      return {
        item_id: itemId,
        item_name: itemName,
        item_url: itemUrl,
      }
    })
    .filter((entry): entry is NoBidItemDetail => entry !== null)
}

function parseParetoDonorDetails(nudge: NudgeItem): ParetoDonorDetail[] {
  const raw = nudge.metadata.top_donor_details
  if (!Array.isArray(raw)) {
    return []
  }

  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null
      }

      const record = entry as Record<string, unknown>
      const donorName = record.donor_name
      const tableNumber = record.table_number
      const donorNumber = record.donor_number
      const totalAmount = record.total_amount

      if (typeof donorName !== 'string' || typeof totalAmount !== 'number') {
        return null
      }

      const detail: ParetoDonorDetail = {
        donor_name: donorName,
        total_amount: totalAmount,
      }

      if (typeof tableNumber === 'number') {
        detail.table_number = tableNumber
      }
      if (typeof donorNumber === 'number') {
        detail.donor_number = donorNumber
      }

      return {
        ...detail,
      }
    })
    .filter((entry): entry is ParetoDonorDetail => entry !== null)
}

interface NudgeCardProps {
  nudge: NudgeItem
  onDismiss: () => void
  onAction: () => void
  disableNotifyLinks?: boolean
}

export function NudgeCard({
  nudge,
  onDismiss,
  onAction,
  disableNotifyLinks = false,
}: NudgeCardProps) {
  const navigate = useNavigate()
  const styles = RANK_STYLES[nudge.rank] ?? RANK_STYLES[5]
  const detailItems = parseDetailItems(nudge)
  const noBidItemDetails = parseNoBidItemDetails(nudge)
  const paretoDonorDetails = parseParetoDonorDetails(nudge)
  const canExpand = detailItems.length > 0
  const canExpandNoBidItems =
    nudge.nudge_type === 'items_no_bids' && noBidItemDetails.length > 0
  const canExpandParetoDonors =
    nudge.nudge_type === 'pareto_donors' && paretoDonorDetails.length > 0
  const isNotifyAction =
    (nudge.action_label ?? '').toLowerCase().includes('notify') ||
    (nudge.action_url ?? '').includes('/notifications')
  const actionLinkHidden = disableNotifyLinks && isNotifyAction
  const [detailsExpanded, setDetailsExpanded] = useState(false)
  const [noBidItemsExpanded, setNoBidItemsExpanded] = useState(false)
  const [paretoDonorsExpanded, setParetoDonorsExpanded] = useState(false)
  const [swipeX, setSwipeX] = useState(0)
  const [swiping, setSwiping] = useState(false)
  const startX = useRef<number | null>(null)
  const THRESHOLD = 80

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!nudge.is_dismissible) return
    startX.current = e.clientX
    setSwiping(true)
      ; (e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!swiping || startX.current === null) return
    setSwipeX(e.clientX - startX.current)
  }

  const handlePointerUp = () => {
    if (!swiping) return
    setSwiping(false)
    if (swipeX < -THRESHOLD) {
      onDismiss()
    } else if (swipeX > THRESHOLD) {
      onAction()
    }
    setSwipeX(0)
    startX.current = null
  }

  const handleActionClick = () => {
    if (nudge.action_url) {
      const { pathname, search } = parseActionUrl(nudge.action_url)
      void navigate({ to: pathname, search })
    }
  }

  const handleNoBidItemClick = (itemUrl: string) => {
    const { pathname, search } = parseActionUrl(itemUrl)
    void navigate({ to: pathname, search })
  }

  const swipeHint =
    swipeX < -THRESHOLD / 2
      ? 'bg-red-100'
      : swipeX > THRESHOLD / 2
        ? 'bg-green-100'
        : ''

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)

  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-l-4 ${styles.border} ${swipeHint} transition-colors`}
      style={{
        transform: swiping ? `translateX(${swipeX}px)` : 'translateX(0)',
        transition: swiping ? 'none' : 'transform 0.2s ease',
        touchAction: 'pan-y',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div className={`p-4 ${styles.bg}`}>
        <div className='flex items-start justify-between gap-3'>
          <div className='flex flex-1 items-start gap-3'>
            <span
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${styles.badge}`}
            >
              {nudge.rank}
            </span>
            <div className='min-w-0 flex-1'>
              <div className='flex flex-wrap items-center gap-2'>
                <p className='text-sm font-semibold text-slate-900'>
                  {nudge.title}
                </p>
              </div>
              <p className='mt-1 text-xs text-slate-700'>{nudge.description}</p>
              {canExpand && (
                <Button
                  variant='ghost'
                  size='sm'
                  className='mt-1 h-6 px-1 text-xs text-slate-700 hover:text-slate-900'
                  onClick={(e) => {
                    e.stopPropagation()
                    setDetailsExpanded((prev) => !prev)
                  }}
                  aria-expanded={detailsExpanded}
                >
                  {detailsExpanded ? (
                    <ChevronUp className='mr-1 h-3 w-3' />
                  ) : (
                    <ChevronDown className='mr-1 h-3 w-3' />
                  )}
                  {detailsExpanded ? 'Hide details' : 'Show details'}
                </Button>
              )}
              {canExpandNoBidItems && (
                <Button
                  variant='ghost'
                  size='sm'
                  className='mt-1 h-6 px-1 text-xs text-slate-700 hover:text-slate-900'
                  onClick={(e) => {
                    e.stopPropagation()
                    setNoBidItemsExpanded((prev) => !prev)
                  }}
                  aria-expanded={noBidItemsExpanded}
                >
                  {noBidItemsExpanded ? (
                    <ChevronUp className='mr-1 h-3 w-3' />
                  ) : (
                    <ChevronDown className='mr-1 h-3 w-3' />
                  )}
                  {noBidItemsExpanded ? 'Hide items' : 'Show items'}
                </Button>
              )}
              {canExpandParetoDonors && (
                <Button
                  variant='ghost'
                  size='sm'
                  className='mt-1 h-6 px-1 text-xs text-slate-700 hover:text-slate-900'
                  onClick={(e) => {
                    e.stopPropagation()
                    setParetoDonorsExpanded((prev) => !prev)
                  }}
                  aria-expanded={paretoDonorsExpanded}
                >
                  {paretoDonorsExpanded ? (
                    <ChevronUp className='mr-1 h-3 w-3' />
                  ) : (
                    <ChevronDown className='mr-1 h-3 w-3' />
                  )}
                  {paretoDonorsExpanded ? 'Hide top donors' : 'Show top donors'}
                </Button>
              )}
              {detailsExpanded && canExpand && (
                <div className='mt-2 rounded-md border border-slate-200 bg-white/70 p-2'>
                  <div className='space-y-2'>
                    {detailItems.map((item) => (
                      <div key={`${nudge.nudge_key}:${item.item_id}`}>
                        {item.item_url ? (
                          <Button
                            variant='link'
                            size='sm'
                            className='h-auto p-0 text-left text-xs font-semibold text-slate-800'
                            onClick={() => {
                              if (item.item_url) {
                                handleNoBidItemClick(item.item_url)
                              }
                            }}
                          >
                            <ExternalLink className='mr-1 h-3 w-3' />
                            {item.item_name}{' '}
                            <span className='font-normal text-slate-600'>
                              ({item.watcher_count})
                            </span>
                          </Button>
                        ) : (
                          <p className='text-xs font-semibold text-slate-800'>
                            {item.item_name}{' '}
                            <span className='font-normal text-slate-600'>
                              ({item.watcher_count})
                            </span>
                          </p>
                        )}
                        {item.watchers.length > 0 ? (
                          <p className='mt-0.5 text-xs text-slate-700'>
                            {item.watchers.join(', ')}
                          </p>
                        ) : (
                          <p className='mt-0.5 text-xs text-slate-500'>
                            No watcher names available
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {noBidItemsExpanded && canExpandNoBidItems && (
                <div className='mt-2 rounded-md border border-slate-200 bg-white/70 p-2'>
                  <div className='space-y-1.5'>
                    {noBidItemDetails.map((item) => (
                      <Button
                        key={`${nudge.nudge_key}:${item.item_id}`}
                        variant='link'
                        size='sm'
                        className='h-auto p-0 text-left text-xs text-slate-900'
                        onClick={() => handleNoBidItemClick(item.item_url)}
                      >
                        <ExternalLink className='mr-1 h-3 w-3' />
                        {item.item_name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              {paretoDonorsExpanded && canExpandParetoDonors && (
                <div className='mt-2 rounded-md border border-slate-200 bg-white/70 p-2'>
                  <div className='space-y-1.5'>
                    {paretoDonorDetails.map((donor, index) => (
                      <p key={`${nudge.nudge_key}:${index}`} className='text-xs text-slate-800'>
                        <span className='font-medium'>
                          {donor.donor_name}
                          {(donor.table_number || donor.donor_number) && (
                            <span className='font-normal text-slate-600'>
                              {' '}
                              (
                              {donor.table_number ? `Table ${donor.table_number}` : ''}
                              {donor.table_number && donor.donor_number ? ', ' : ''}
                              {donor.donor_number ? `Donor ${donor.donor_number}` : ''})
                            </span>
                          )}
                        </span>{' '}
                        <span className='text-slate-600'>
                          ({formatCurrency(donor.total_amount)})
                        </span>
                      </p>
                    ))}
                  </div>
                </div>
              )}
              {nudge.action_url && !actionLinkHidden && (
                <Button
                  variant='link'
                  size='sm'
                  className='mt-1 h-auto p-0 text-xs text-slate-900'
                  onClick={handleActionClick}
                >
                  <ExternalLink className='mr-1 h-3 w-3' />
                  {nudge.action_label ?? 'View'}
                </Button>
              )}
            </div>
          </div>
          <div className='flex shrink-0 items-center gap-1'>
            {nudge.is_dismissible && (
              <>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-7 w-7 text-green-600 hover:text-green-700'
                  aria-label='Mark nudge done'
                  title='Mark done'
                  onClick={onAction}
                >
                  <Check className='h-4 w-4' />
                </Button>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-7 w-7 text-slate-600 hover:text-slate-800'
                  aria-label='Dismiss nudge'
                  title='Dismiss'
                  onClick={onDismiss}
                >
                  <X className='h-4 w-4' />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
