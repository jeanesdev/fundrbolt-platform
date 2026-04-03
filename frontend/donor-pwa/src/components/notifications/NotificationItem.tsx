/**
 * NotificationItem — single notification row with swipe-to-reveal delete
 */

import type { NotificationData } from '@/services/notification-service'
import {
  Bell,
  CheckCircle2,
  Clock,
  Gavel,
  Gift,
  Heart,
  Megaphone,
  Timer,
  Trash2,
  Trophy,
} from 'lucide-react'
import { useCallback, useRef, useState } from 'react'

/**
 * Render the appropriate icon for a notification type
 */
function NotificationIcon({ type }: { type: string }) {
  const className = 'h-5 w-5 text-muted-foreground'
  switch (type) {
    case 'outbid':
    case 'admin_bid_placed':
    case 'proxy_bid_triggered':
      return <Gavel className={className} />
    case 'item_won':
      return <Trophy className={className} />
    case 'auction_closing_soon':
      return <Timer className={className} />
    case 'auction_opened':
      return <Megaphone className={className} />
    case 'auction_closed':
    case 'bid_confirmation':
      return <CheckCircle2 className={className} />
    case 'paddle_raise':
      return <Heart className={className} />
    case 'checkout_reminder':
      return <Clock className={className} />
    case 'welcome':
      return <Gift className={className} />
    default:
      return <Bell className={className} />
  }
}

/** Simple relative time formatting */
function relativeTime(dateString: string): string {
  const now = Date.now()
  const then = new Date(dateString).getTime()
  const diffSeconds = Math.floor((now - then) / 1000)

  if (diffSeconds < 60) return 'Just now'
  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return new Date(dateString).toLocaleDateString()
}

/** Threshold in pixels to reveal the delete action */
const SWIPE_THRESHOLD = 60
/** Width of the revealed delete button area */
const DELETE_WIDTH = 72

interface NotificationItemProps {
  notification: NotificationData
  onRead: (id: string) => void
  onDelete: (id: string) => void
  onNavigate?: (deepLink: string) => void
}

export function NotificationItem({
  notification,
  onRead,
  onDelete,
  onNavigate,
}: NotificationItemProps) {
  const handleClick = useCallback(() => {
    if (!notification.is_read) {
      onRead(notification.id)
    }
    const deepLink = notification.data?.deep_link as string | undefined
    if (deepLink && onNavigate) {
      onNavigate(deepLink)
    }
  }, [notification, onRead, onNavigate])

  // Swipe state
  const [offsetX, setOffsetX] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [animating, setAnimating] = useState(true)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const swiping = useRef(false)

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      touchStartX.current = e.touches[0].clientX
      touchStartY.current = e.touches[0].clientY
      swiping.current = false
      setAnimating(false)
    },
    [],
  )

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const dx = e.touches[0].clientX - touchStartX.current
      const dy = Math.abs(e.touches[0].clientY - touchStartY.current)

      // Only treat as swipe if horizontal movement dominates
      if (!swiping.current && Math.abs(dx) > 10 && Math.abs(dx) > dy) {
        swiping.current = true
      }

      if (!swiping.current) return

      if (revealed) {
        // Already revealed — allow swiping back right
        const newOffset = Math.min(0, Math.max(-DELETE_WIDTH, dx - DELETE_WIDTH))
        setOffsetX(newOffset)
      } else {
        // Clamp to only allow leftward swipe
        const newOffset = Math.min(0, Math.max(-DELETE_WIDTH - 20, dx))
        setOffsetX(newOffset)
      }
    },
    [revealed],
  )

  const onTouchEnd = useCallback(() => {
    if (!swiping.current) {
      return
    }

    setAnimating(true)
    if (Math.abs(offsetX) >= SWIPE_THRESHOLD) {
      // Snap open
      setOffsetX(-DELETE_WIDTH)
      setRevealed(true)
    } else {
      // Snap closed
      setOffsetX(0)
      setRevealed(false)
    }
  }, [offsetX])

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onDelete(notification.id)
    },
    [notification.id, onDelete],
  )

  return (
    <div className='relative overflow-hidden'>
      {/* Delete action behind the item */}
      <div className='absolute inset-y-0 right-0 flex w-[72px] items-center justify-center bg-destructive'>
        <button
          type='button'
          onClick={handleDelete}
          className='flex h-full w-full items-center justify-center text-destructive-foreground'
          aria-label='Delete notification'
        >
          <Trash2 className='h-5 w-5' />
        </button>
      </div>

      {/* Sliding content */}
      <div
        className='relative bg-background transition-transform duration-150 ease-out'
        style={{
          transform: `translateX(${offsetX}px)`,
          transitionDuration: animating ? '150ms' : '0ms',
          touchAction: swiping.current ? 'none' : 'pan-y',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <button
          type='button'
          onClick={handleClick}
          className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${!notification.is_read ? 'bg-primary/5' : ''
            }`}
        >
          {/* Leading visual: thumbnail or icon */}
          {notification.data?.image_url ? (
            <img
              src={notification.data.image_url as string}
              alt={(notification.data?.item_title as string) || 'Item'}
              className='mt-0.5 h-10 w-10 flex-shrink-0 rounded-lg object-cover'
            />
          ) : (
            <div className='mt-0.5 flex-shrink-0'>
              <NotificationIcon type={notification.notification_type} />
            </div>
          )}

          {/* Content */}
          <div className='min-w-0 flex-1'>
            <div className='flex items-start justify-between gap-2'>
              <p
                className={`text-sm ${!notification.is_read ? 'font-semibold' : 'font-medium'}`}
              >
                {notification.title}
              </p>
              {/* Unread indicator */}
              {!notification.is_read && (
                <span className='mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500' />
              )}
            </div>
            <p className='line-clamp-2 text-xs text-muted-foreground'>
              {notification.body}
            </p>
            <p className='mt-1 text-xs text-muted-foreground/70'>
              {relativeTime(notification.created_at)}
            </p>
          </div>
        </button>
      </div>
    </div>
  )
}
