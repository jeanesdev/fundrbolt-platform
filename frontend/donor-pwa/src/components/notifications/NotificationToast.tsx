/**
 * NotificationToast — styled toast for incoming notifications
 *
 * Uses Sonner's toast.custom() for display.
 * Styled per notification type (outbid → amber, item_won → green, default → neutral).
 */
import { useNavigate } from '@tanstack/react-router'
import type { NotificationData } from '@/services/notification-service'
import { Gavel, Trophy, Bell } from 'lucide-react'

function getToastStyle(type: string) {
  switch (type) {
    case 'outbid':
      return {
        className:
          'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800',
        icon: <Gavel className='h-5 w-5 text-amber-600 dark:text-amber-400' />,
      }
    case 'item_won':
      return {
        className:
          'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800',
        icon: <Trophy className='h-5 w-5 text-green-600 dark:text-green-400' />,
      }
    default:
      return {
        className: 'bg-background border-border',
        icon: <Bell className='text-muted-foreground h-5 w-5' />,
      }
  }
}

interface NotificationToastProps {
  notification: NotificationData
  onDismiss: () => void
}

export function NotificationToast({
  notification,
  onDismiss,
}: NotificationToastProps) {
  const navigate = useNavigate()
  const { className, icon } = getToastStyle(notification.notification_type)

  const deepLink = notification.data?.deep_link as string | undefined

  const handleClick = () => {
    onDismiss()
    if (deepLink) {
      void navigate({ to: deepLink })
    }
  }

  return (
    <button
      type='button'
      onClick={handleClick}
      className={`flex w-full items-start gap-3 rounded-lg border p-4 shadow-lg transition-colors hover:opacity-90 ${className}`}
    >
      <div className='mt-0.5 flex-shrink-0'>{icon}</div>
      <div className='min-w-0 flex-1 text-left'>
        <p className='text-foreground text-sm font-semibold'>
          {notification.title}
        </p>
        <p className='text-muted-foreground mt-0.5 line-clamp-2 text-xs'>
          {notification.body}
        </p>
      </div>
    </button>
  )
}
