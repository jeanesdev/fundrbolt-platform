/**
 * Notification API service
 * Handles all notification-related API calls
 */

import apiClient from '@/lib/axios'
import { AxiosError } from 'axios'

export interface NotificationData {
  id: string
  event_id: string
  user_id: string
  notification_type: string
  title: string
  body: string
  priority: string
  data: Record<string, unknown> | null
  is_read: boolean
  read_at: string | null
  created_at: string
}

export interface NotificationListResponse {
  notifications: NotificationData[]
  next_cursor: string | null
  unread_count: number
}

export interface UnreadCountResponse {
  unread_count: number
}

export interface MarkAllReadResponse {
  updated_count: number
}

export interface ListNotificationsOptions {
  limit?: number
  cursor?: string | null
  unread_only?: boolean
}

class NotificationService {
  async listNotifications(
    eventId: string,
    options?: ListNotificationsOptions,
  ): Promise<NotificationListResponse> {
    try {
      const response = await apiClient.get<NotificationListResponse>(
        '/notifications',
        {
          params: {
            event_id: eventId,
            limit: options?.limit ?? 20,
            cursor: options?.cursor ?? undefined,
            unread_only: options?.unread_only ?? false,
          },
        },
      )
      return response.data
    } catch (error) {
      if (
        error instanceof AxiosError &&
        [404, 500].includes(error.response?.status ?? 0)
      ) {
        return {
          notifications: [],
          next_cursor: null,
          unread_count: 0,
        }
      }

      throw error
    }
  }

  async getUnreadCount(eventId: string): Promise<UnreadCountResponse> {
    try {
      const response = await apiClient.get<UnreadCountResponse>(
        '/notifications/unread-count',
        { params: { event_id: eventId } },
      )
      return response.data
    } catch (error) {
      if (
        error instanceof AxiosError &&
        [404, 500].includes(error.response?.status ?? 0)
      ) {
        return { unread_count: 0 }
      }

      throw error
    }
  }

  async markRead(notificationId: string): Promise<{ success: boolean }> {
    const response = await apiClient.post<{ success: boolean }>(
      `/notifications/${notificationId}/read`,
    )
    return response.data
  }

  async markAllRead(eventId: string): Promise<MarkAllReadResponse> {
    const response = await apiClient.post<MarkAllReadResponse>(
      '/notifications/read-all',
      { event_id: eventId },
    )
    return response.data
  }
}

export const notificationService = new NotificationService()
