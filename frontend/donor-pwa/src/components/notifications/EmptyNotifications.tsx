/**
 * EmptyNotifications — displayed when there are no notifications
 */

import { BellOff } from 'lucide-react'

export function EmptyNotifications() {
  return (
    <div className='flex flex-col items-center justify-center py-16 text-center'>
      <BellOff className='mb-4 h-12 w-12 text-muted-foreground/40' />
      <p className='text-sm font-medium text-muted-foreground'>
        No notifications yet
      </p>
      <p className='mt-1 text-xs text-muted-foreground/70'>
        You&apos;re all caught up!
      </p>
    </div>
  )
}
