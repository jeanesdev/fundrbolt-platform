/**
 * EmptyNotifications — displayed when there are no notifications
 */
import { BellOff } from 'lucide-react'

export function EmptyNotifications() {
  return (
    <div className='flex flex-col items-center justify-center py-16 text-center'>
      <BellOff className='text-muted-foreground/40 mb-4 h-12 w-12' />
      <p className='text-muted-foreground text-sm font-medium'>
        No notifications yet
      </p>
      <p className='text-muted-foreground/70 mt-1 text-xs'>
        You&apos;re all caught up!
      </p>
    </div>
  )
}
