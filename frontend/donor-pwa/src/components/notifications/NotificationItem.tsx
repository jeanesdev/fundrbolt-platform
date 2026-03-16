/**
 * NotificationItem — single notification row in the notification center
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
  Trophy,
} from 'lucide-react'
import { useCallback } from 'react'

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

interface NotificationItemProps {
  notification: NotificationData
  onRead: (id: string) => void
  onNavigate?: (deepLink: string) => void
}

export function NotificationItem({
  notification,
  onRead,
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

  return (
    <button
      type='button'
      onClick={handleClick}
      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
        !notification.is_read ? 'bg-primary/5' : ''
      }`}
    >
      {/* Icon */}
      <div className='mt-0.5 flex-shrink-0'>
        <NotificationIcon type={notification.notification_type} />
      </div>

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
  )
}
