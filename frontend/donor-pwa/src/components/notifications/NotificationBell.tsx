/**
 * NotificationBell — bell icon button with unread badge
 * Opens/closes the NotificationCenter panel
 */
import { Bell } from 'lucide-react'
import { useNotificationStore } from '@/stores/notification-store'

interface NotificationBellProps {
  /** 'hero' for transparent hero overlay (white text), 'header' for sticky headers (dark text) */
  variant?: 'hero' | 'header'
}

export function NotificationBell({ variant = 'hero' }: NotificationBellProps) {
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const togglePanel = useNotificationStore((s) => s.togglePanel)

  const displayCount = unreadCount > 9 ? '9+' : String(unreadCount)

  const colorClasses =
    variant === 'hero'
      ? 'text-white/90 hover:bg-white/10 hover:text-white'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground'

  return (
    <button
      type='button'
      onClick={togglePanel}
      className={`relative inline-flex items-center justify-center rounded-lg p-2 transition-colors ${colorClasses}`}
      aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
    >
      <Bell className='h-5 w-5' />
      {unreadCount > 0 && (
        <span className='absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] leading-none font-bold text-white'>
          {displayCount}
        </span>
      )}
    </button>
  )
}
