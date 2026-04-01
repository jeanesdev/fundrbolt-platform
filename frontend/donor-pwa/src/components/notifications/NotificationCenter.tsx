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
  useDeleteNotification,
  useMarkAllRead,
  useMarkRead,
  useNotifications,
} from '@/hooks/use-notifications'
import { useNotificationStore } from '@/stores/notification-store'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCheck, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'

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

  const queryClient = useQueryClient()
  const markReadMutation = useMarkRead()
  const markAllReadMutation = useMarkAllRead()
  const deleteNotificationMutation = useDeleteNotification()

  const notifications = data?.notifications ?? []

  // Refetch notifications every time the panel opens
  useEffect(() => {
    if (isOpen) {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }
  }, [isOpen, queryClient])

  const handleMarkRead = useCallback(
    (id: string) => {
      markReadMutation.mutate(id)
    },
    [markReadMutation],
  )

  const handleMarkAllRead = useCallback(() => {
    markAllReadMutation.mutate(eventId)
  }, [markAllReadMutation, eventId])

  const handleDelete = useCallback(
    (notificationId: string) => {
      deleteNotificationMutation.mutate({ notificationId, eventId })
    },
    [deleteNotificationMutation, eventId],
  )

  // Swipe-right-to-close
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }, [])

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const dx = e.changedTouches[0].clientX - touchStartX.current
      const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current)
      // Close if horizontal swipe right > 80px and mostly horizontal
      if (dx > 80 && dy < dx) {
        closePanel()
      }
    },
    [closePanel],
  )

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closePanel()}>
      <SheetContent
        side='right'
        className='flex w-full flex-col p-0 sm:max-w-md'
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <SheetHeader className='flex-row items-center justify-between border-b px-4 py-3 pr-14'>
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
                  onDelete={handleDelete}
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
