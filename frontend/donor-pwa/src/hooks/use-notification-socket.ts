/**
 * useNotificationSocket — Socket.IO hook for real-time notifications
 *
 * Connects to the backend Socket.IO server and listens for new notifications.
 * Manages room joining, reconnection, and store/query cache syncing.
 */

import type { NotificationData } from '@/services/notification-service'
import { useDebugSpoofStore } from '@/stores/debug-spoof-store'
import { useNotificationStore } from '@/stores/notification-store'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'

/** Derive Socket.IO URL from API URL (strip /api/v1 suffix) */
function getSocketUrl(): string {
  const apiUrl =
    import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'
  return apiUrl.replace(/\/api\/v1\/?$/, '')
}

export type SocketStatus = 'connecting' | 'connected' | 'disconnected'

interface UseNotificationSocketOptions {
  enabled?: boolean
}

export function useNotificationSocket(
  eventId: string | undefined,
  options?: UseNotificationSocketOptions,
) {
  const { enabled = true } = options ?? {}
  const [status, setStatus] = useState<SocketStatus>('disconnected')
  const socketRef = useRef<Socket | null>(null)
  const queryClient = useQueryClient()

  const addNotification = useNotificationStore((s) => s.addNotification)
  const incrementUnreadCount = useNotificationStore(
    (s) => s.incrementUnreadCount,
  )
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount)

  // Respect spoofed user ID for debug purposes
  const spoofedUserId = useDebugSpoofStore((s) => s.spoofedUser?.id)

  const getToken = useCallback((): string | null => {
    try {
      const raw = localStorage.getItem('fundrbolt-auth-storage')
      if (!raw) return null
      const parsed = JSON.parse(raw) as {
        state?: { accessToken?: string }
      }
      return parsed?.state?.accessToken ?? null
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    if (!eventId || !enabled) return

    const token = getToken()
    if (!token) return

    const socketUrl = getSocketUrl()

    const socket = io(socketUrl, {
      path: '/ws/socket.io',
      transports: ['websocket', 'polling'],
      auth: { token },
      query: spoofedUserId ? { spoof_user_id: spoofedUserId } : undefined,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
    })

    socketRef.current = socket
    // Status will be updated via event handlers below

    socket.on('connect', () => {
      setStatus('connected')
      // Join the event notification room
      socket.emit('notification:join_event', { event_id: eventId })
    })

    socket.on('disconnect', () => {
      setStatus('disconnected')
    })

    socket.on('reconnect_attempt', () => {
      setStatus('connecting')
    })

    // Handle new notification from server
    socket.on('notification:new', (data: NotificationData) => {
      addNotification(data)
      incrementUnreadCount()
      // Invalidate React Query caches so lists refetch
      void queryClient.invalidateQueries({
        queryKey: ['notifications'],
      })
    })

    // Handle count update from server
    socket.on(
      'notification:count',
      (data: { unread_count: number }) => {
        setUnreadCount(data.unread_count)
      },
    )

    return () => {
      socket.disconnect()
      socketRef.current = null
      setStatus('disconnected')
    }
  }, [
    eventId,
    enabled,
    spoofedUserId,
    getToken,
    addNotification,
    incrementUnreadCount,
    setUnreadCount,
    queryClient,
  ])

  return { status }
}
