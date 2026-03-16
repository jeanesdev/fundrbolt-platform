/**
 * NotificationCenter — slide-out panel showing all notifications
 * Uses Radix Sheet (right-anchored)
 */

import { EmptyNotifications } from '@/components/notifications/EmptyNotifications'
import { NotificationItem } from '@/components/notifications/NotificationItem'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  useMarkAllRead,
  useMarkRead,
  useNotifications,
} from '@/hooks/use-notifications'
import { useNotificationStore } from '@/stores/notification-store'
import { CheckCheck, Loader2 } from 'lucide-react'
import { useCallback } from 'react'

interface NotificationCenterProps {
  eventId: string
}

export function NotificationCenter({ eventId }: NotificationCenterProps) {
  const isOpen = useNotificationStore((s) => s.isOpen)
  const closePanel = useNotificationStore((s) => s.closePanel)
  const unreadCount = useNotificationStore((s) => s.unreadCount)

  const {
    data,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useNotifications(eventId)

  const markReadMutation = useMarkRead()
  const markAllReadMutation = useMarkAllRead()

  const notifications = data?.notifications ?? []

  const handleMarkRead = useCallback(
    (id: string) => {
      markReadMutation.mutate(id)
    },
    [markReadMutation],
  )

  const handleMarkAllRead = useCallback(() => {
    markAllReadMutation.mutate(eventId)
  }, [markAllReadMutation, eventId])

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closePanel()}>
      <SheetContent side='right' className='flex w-full flex-col p-0 sm:max-w-md'>
        <SheetHeader className='flex-row items-center justify-between border-b px-4 py-3'>
          <SheetTitle className='text-base'>Notifications</SheetTitle>
          {unreadCount > 0 && (
            <Button
              variant='ghost'
              size='sm'
              onClick={handleMarkAllRead}
              disabled={markAllReadMutation.isPending}
              className='h-8 gap-1.5 text-xs'
            >
              <CheckCheck className='h-3.5 w-3.5' />
              Mark all as read
            </Button>
          )}
        </SheetHeader>

        {/* Scrollable notification list */}
        <div className='flex-1 overflow-y-auto'>
          {isLoading ? (
            <div className='flex items-center justify-center py-16'>
              <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
            </div>
          ) : notifications.length === 0 ? (
            <EmptyNotifications />
          ) : (
            <div className='divide-y'>
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onRead={handleMarkRead}
                />
              ))}

              {/* Load more */}
              {hasNextPage && (
                <div className='p-4 text-center'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                  >
                    {isFetchingNextPage ? (
                      <Loader2 className='mr-2 h-3.5 w-3.5 animate-spin' />
                    ) : null}
                    Load more
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
