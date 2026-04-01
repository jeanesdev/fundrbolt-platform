/**
 * Notification store (Zustand)
 * Manages notification UI state: unread count, panel visibility, cached notifications
 */
import type { NotificationData } from '@/services/notification-service'
import { create } from 'zustand'

export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting'

interface NotificationState {
  /** Current unread count */
  unreadCount: number
  /** Whether the notification panel is open */
  isOpen: boolean
  /** Cached notifications for the panel */
  notifications: NotificationData[]
  /** Socket.IO connection status */
  connectionStatus: ConnectionStatus

  // Actions
  setUnreadCount: (count: number) => void
  incrementUnreadCount: () => void
  openPanel: () => void
  closePanel: () => void
  togglePanel: () => void
  addNotification: (notification: NotificationData) => void
  removeNotification: (notificationId: string) => void
  markAsRead: (notificationId: string) => void
  markAllAsRead: () => void
  setNotifications: (notifications: NotificationData[]) => void
  setConnectionStatus: (status: ConnectionStatus) => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,
  isOpen: false,
  notifications: [],
  connectionStatus: 'disconnected',

  setUnreadCount: (count) => set({ unreadCount: count }),
  incrementUnreadCount: () =>
    set((state) => ({ unreadCount: state.unreadCount + 1 })),
  openPanel: () => set({ isOpen: true }),
  closePanel: () => set({ isOpen: false }),
  togglePanel: () => set((state) => ({ isOpen: !state.isOpen })),

  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications],
    })),

  removeNotification: (notificationId) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== notificationId),
    })),

  markAsRead: (notificationId) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === notificationId
          ? { ...n, is_read: true, read_at: new Date().toISOString() }
          : n
      ),
    })),

  markAllAsRead: () =>
    set((state) => ({
      unreadCount: 0,
      notifications: state.notifications.map((n) => ({
        ...n,
        is_read: true,
        read_at: n.read_at ?? new Date().toISOString(),
      })),
    })),

  setNotifications: (notifications) => set({ notifications }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
}))
