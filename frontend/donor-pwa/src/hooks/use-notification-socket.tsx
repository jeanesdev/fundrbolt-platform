/**
 * useNotificationSocket — Socket.IO hook for real-time notifications
 *
 * Connects to the backend Socket.IO server and listens for new notifications.
 * Manages room joining, reconnection, and store/query cache syncing.
 */
import { triggerNotificationToast } from '@/components/notifications/NotificationToastOverlay'
import type { NotificationData } from '@/services/notification-service'
import { useAuthStore } from '@/stores/auth-store'
import { useDebugSpoofStore } from '@/stores/debug-spoof-store'
import { useNotificationStore } from '@/stores/notification-store'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'

/** Derive Socket.IO URL.
 *  In development the Vite proxy forwards /ws to the backend on the same
 *  origin, avoiding cross-tunnel WebSocket failures through ngrok.
 *  In production Socket.IO connects directly to the backend origin.
 */
function getSocketUrl(): string {
  if (import.meta.env.DEV) {
    // Same origin — Vite proxy handles /ws → backend
    return ''
  }
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'
  return apiUrl.replace(/\/api\/v1\/?$/, '')
}

const LAST_SEEN_KEY = 'fundrbolt_notification_last_seen'

function loadLastSeen(): string | null {
  try {
    return localStorage.getItem(LAST_SEEN_KEY)
  } catch {
    return null
  }
}

function saveLastSeen(ts: string): void {
  try {
    localStorage.setItem(LAST_SEEN_KEY, ts)
  } catch {
    // Ignore storage failures.
  }
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
  const lastSeenRef = useRef<string | null>(loadLastSeen())

  const addNotification = useNotificationStore((s) => s.addNotification)
  const incrementUnreadCount = useNotificationStore(
    (s) => s.incrementUnreadCount
  )
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount)
  const setConnectionStatus = useNotificationStore((s) => s.setConnectionStatus)

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
      transports: ['polling', 'websocket'],
      auth: { token: accessToken },
      query: spoofedUserId ? { spoof_user_id: spoofedUserId } : undefined,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
    })

    socketRef.current = socket

      // Expose for debugging
      ; (window as unknown as Record<string, unknown>).__debugSocket = socket

    socket.on('connect', () => {
      console.log('[SIO] connected, id=', socket.id)
      setStatus('connected')
      setConnectionStatus('connected')
      // Join the event notification room with last_seen_at for catch-up
      console.log('[SIO] joining event room', eventId)
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
      console.log('[SIO] notification:new received', data)
      addNotification(data)
      incrementUnreadCount()
      // Track latest notification timestamp for catch-up on reconnect
      if (data.created_at) {
        lastSeenRef.current = data.created_at
        saveLastSeen(data.created_at)
      }
      // Invalidate React Query caches so lists refetch
      void queryClient.invalidateQueries({
        queryKey: ['notifications'],
      })

      // Bid-related notifications should refresh auction item data
      if (
        data.notification_type === 'outbid' ||
        data.notification_type === 'bid_confirmed' ||
        data.notification_type === 'item_won'
      ) {
        void queryClient.invalidateQueries({ queryKey: ['auction-items'] })
        void queryClient.invalidateQueries({ queryKey: ['auction-item-detail'] })
        void queryClient.invalidateQueries({ queryKey: ['auction-item-bids'] })
      }

      // Show toast if notification center is not open
      const isOpen = useNotificationStore.getState().isOpen
      if (!isOpen) {
        triggerNotificationToast(data)
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
    queryClient,
  ])

  return { status }
}
