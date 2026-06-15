import { useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Check, ExternalLink, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

interface NudgeCardProps {
  nudge: NudgeItem
  onDismiss: () => void
  onAction: () => void
}

export function NudgeCard({ nudge, onDismiss, onAction }: NudgeCardProps) {
  const navigate = useNavigate()
  const styles = RANK_STYLES[nudge.rank] ?? RANK_STYLES[5]
  const [swipeX, setSwipeX] = useState(0)
  const [swiping, setSwiping] = useState(false)
  const startX = useRef<number | null>(null)
  const THRESHOLD = 80

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!nudge.is_dismissible) return
    startX.current = e.clientX
    setSwiping(true)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
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

  const swipeHint =
    swipeX < -THRESHOLD / 2
      ? 'bg-red-100'
      : swipeX > THRESHOLD / 2
        ? 'bg-green-100'
        : ''

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
              {nudge.action_url && (
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
                  title='Mark done'
                  onClick={onAction}
                >
                  <Check className='h-4 w-4' />
                </Button>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-7 w-7 text-slate-600 hover:text-slate-800'
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
