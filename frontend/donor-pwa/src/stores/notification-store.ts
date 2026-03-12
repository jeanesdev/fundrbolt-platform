/**
 * Notification store (Zustand)
 * Manages notification UI state: unread count, panel visibility, cached notifications
 */

import type { NotificationData } from '@/services/notification-service'
import { create } from 'zustand'

interface NotificationState {
  /** Current unread count */
  unreadCount: number
  /** Whether the notification panel is open */
  isOpen: boolean
  /** Cached notifications for the panel */
  notifications: NotificationData[]

  // Actions
  setUnreadCount: (count: number) => void
  incrementUnreadCount: () => void
  openPanel: () => void
  closePanel: () => void
  togglePanel: () => void
  addNotification: (notification: NotificationData) => void
  markAsRead: (notificationId: string) => void
  markAllAsRead: () => void
  setNotifications: (notifications: NotificationData[]) => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,
  isOpen: false,
  notifications: [],

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

  markAsRead: (notificationId) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === notificationId
          ? { ...n, is_read: true, read_at: new Date().toISOString() }
          : n,
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
}))
