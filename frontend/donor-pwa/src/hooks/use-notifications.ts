/**
 * React Query hooks for notifications
 * Provides cached data fetching, polling, and mutations
 */
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  notificationService,
  type ListNotificationsOptions,
} from '@/services/notification-service'
import { useNotificationStore } from '@/stores/notification-store'

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
  options?: Omit<ListNotificationsOptions, 'cursor'>
) {
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
    // Always refetch when panel remounts or regains focus so new
    // notifications are visible immediately.
    refetchOnMount: 'always',
    staleTime: 0,
    select: (data) => ({
      ...data,
      notifications: data.pages.flatMap((page) => page.notifications),
    }),
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
    mutationFn: (eventId: string) => notificationService.markAllRead(eventId),
    onSuccess: () => {
      markAllAsRead()
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.all })
    },
  })
}

/**
 * Delete a notification with optimistic removal from React Query cache
 */
export function useDeleteNotification() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      notificationId,
      eventId,
    }: {
      notificationId: string
      eventId?: string
    }) => notificationService.deleteNotification(notificationId, eventId),
    onMutate: async ({ notificationId }) => {
      // Cancel in-flight fetches so they don't overwrite optimistic update
      await queryClient.cancelQueries({ queryKey: NOTIFICATION_KEYS.all })

      // Snapshot previous cache for rollback
      const previousData = queryClient.getQueriesData({
        queryKey: NOTIFICATION_KEYS.all,
      })

      // Optimistically remove from all notification query caches
      queryClient.setQueriesData(
        { queryKey: NOTIFICATION_KEYS.all },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (old: any) => {
          if (!old?.pages) return old
          return {
            ...old,
            pages: old.pages.map(
              (page: { notifications: Array<{ id: string }> }) => ({
                ...page,
                notifications: page.notifications.filter(
                  (n: { id: string }) => n.id !== notificationId
                ),
              })
            ),
          }
        }
      )

      return { previousData }
    },
    onError: (_err, _vars, context) => {
      // Rollback on failure
      if (context?.previousData) {
        for (const [key, data] of context.previousData) {
          queryClient.setQueryData(key, data)
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.all })
    },
  })
}
