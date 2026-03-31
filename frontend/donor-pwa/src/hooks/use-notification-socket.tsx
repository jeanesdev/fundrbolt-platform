/**
 * useNotificationSocket — Socket.IO hook for real-time notifications
 *
 * Connects to the backend Socket.IO server and listens for new notifications.
 * Manages room joining, reconnection, and store/query cache syncing.
 */
import { NotificationToast } from '@/components/notifications/NotificationToast'
import type { NotificationData } from '@/services/notification-service'
import { useAuthStore } from '@/stores/auth-store'
import { useDebugSpoofStore } from '@/stores/debug-spoof-store'
import { useNotificationStore } from '@/stores/notification-store'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { toast } from 'sonner'

/** Derive Socket.IO URL from API URL (strip /api/v1 suffix) */
function getSocketUrl(): string {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'
  return apiUrl.replace(/\/api\/v1\/?$/, '')
}

export type SocketStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'

interface UseNotificationSocketOptions {
  enabled?: boolean
}

export function useNotificationSocket(
  eventId: string | undefined,
  options?: UseNotificationSocketOptions
) {
  const { enabled = true } = options ?? {}
  const [status, setStatus] = useState<SocketStatus>('disconnected')
  const socketRef = useRef<Socket | null>(null)
  const queryClient = useQueryClient()
  const lastSeenRef = useRef<string | null>(null)

  const addNotification = useNotificationStore((s) => s.addNotification)
  const incrementUnreadCount = useNotificationStore(
    (s) => s.incrementUnreadCount
  )
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount)
  const setConnectionStatus = useNotificationStore((s) => s.setConnectionStatus)
  const isOpen = useNotificationStore((s) => s.isOpen)

  // Respect spoofed user ID for debug purposes
  const spoofedUserId = useDebugSpoofStore((s) => s.spoofedUser?.id)

  // Subscribe to accessToken so the effect re-runs when auth completes
  const accessToken = useAuthStore((s) => s.accessToken)

  useEffect(() => {
    if (!eventId || !enabled) return
    if (!accessToken) return

    const socketUrl = getSocketUrl()

    const socket = io(socketUrl, {
      path: '/ws/socket.io',
      transports: ['websocket', 'polling'],
      auth: { token: accessToken },
      query: spoofedUserId ? { spoof_user_id: spoofedUserId } : undefined,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      setStatus('connected')
      setConnectionStatus('connected')
      // Join the event notification room with last_seen_at for catch-up
      socket.emit('notification:join_event', {
        event_id: eventId,
        last_seen_at: lastSeenRef.current ?? undefined,
      })
      // Invalidate React Query caches on reconnect
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    })

    socket.on('disconnect', () => {
      setStatus('disconnected')
      setConnectionStatus('disconnected')
    })

    socket.on('reconnect_attempt', () => {
      setStatus('reconnecting')
      setConnectionStatus('reconnecting')
    })

    // Handle new notification from server
    socket.on('notification:new', (data: NotificationData) => {
      addNotification(data)
      incrementUnreadCount()
      // Track latest notification timestamp for catch-up on reconnect
      if (data.created_at) {
        lastSeenRef.current = data.created_at
      }
      // Invalidate React Query caches so lists refetch
      void queryClient.invalidateQueries({
        queryKey: ['notifications'],
      })

      // Show toast if notification center is not open
      if (!useNotificationStore.getState().isOpen) {
        toast.custom(
          (t) => (
            <NotificationToast
              notification={data}
              onDismiss={() => toast.dismiss(t)}
            />
          ),
          { duration: 5000 }
        )
      }
    })

    // Handle count update from server
    socket.on('notification:count', (data: { unread_count: number }) => {
      setUnreadCount(data.unread_count)
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
      setStatus('disconnected')
      setConnectionStatus('disconnected')
    }
  }, [
    eventId,
    enabled,
    accessToken,
    spoofedUserId,
    addNotification,
    incrementUnreadCount,
    setUnreadCount,
    setConnectionStatus,
    isOpen,
    queryClient,
  ])

  return { status }
}
