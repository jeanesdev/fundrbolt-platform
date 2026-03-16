/**
 * React Query hooks for notifications
 * Provides cached data fetching, polling, and mutations
 */

import {
  notificationService,
  type ListNotificationsOptions,
} from '@/services/notification-service'
import { useNotificationStore } from '@/stores/notification-store'
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

const NOTIFICATION_KEYS = {
  all: ['notifications'] as const,
  list: (eventId: string) => ['notifications', 'list', eventId] as const,
  unreadCount: (eventId: string) =>
    ['notifications', 'unread-count', eventId] as const,
}

/**
 * Fetch paginated notifications with cursor-based infinite scrolling
 */
export function useNotifications(
  eventId: string,
  options?: Omit<ListNotificationsOptions, 'cursor'>,
) {
  const setNotifications = useNotificationStore(
    (state) => state.setNotifications,
  )

  return useInfiniteQuery({
    queryKey: [...NOTIFICATION_KEYS.list(eventId), options] as const,
    queryFn: async ({ pageParam }) => {
      const result = await notificationService.listNotifications(eventId, {
        ...options,
        cursor: pageParam ?? undefined,
      })
      return result
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    enabled: !!eventId,
    select: (data) => {
      const allNotifications = data.pages.flatMap(
        (page) => page.notifications,
      )
      // Sync to store for real-time updates
      setNotifications(allNotifications)
      return {
        ...data,
        notifications: allNotifications,
      }
    },
  })
}

/**
 * Poll unread count every 30 seconds
 */
export function useUnreadCount(eventId: string) {
  const setUnreadCount = useNotificationStore((state) => state.setUnreadCount)

  return useQuery({
    queryKey: NOTIFICATION_KEYS.unreadCount(eventId),
    queryFn: async () => {
      const result = await notificationService.getUnreadCount(eventId)
      setUnreadCount(result.unread_count)
      return result
    },
    enabled: !!eventId,
    refetchInterval: 30_000,
  })
}

/**
 * Mark a single notification as read
 */
export function useMarkRead() {
  const queryClient = useQueryClient()
  const markAsRead = useNotificationStore((state) => state.markAsRead)

  return useMutation({
    mutationFn: (notificationId: string) =>
      notificationService.markRead(notificationId),
    onSuccess: (_data, notificationId) => {
      markAsRead(notificationId)
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.all })
    },
  })
}

/**
 * Mark all notifications as read for an event
 */
export function useMarkAllRead() {
  const queryClient = useQueryClient()
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead)

  return useMutation({
    mutationFn: (eventId: string) =>
      notificationService.markAllRead(eventId),
    onSuccess: () => {
      markAllAsRead()
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.all })
    },
  })
}
