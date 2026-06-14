import apiClient from '@/lib/axios'
import type {
  DismissNudgeRequest,
  DismissNudgeResponse,
  NudgesResponse,
} from './types'

export const nudgesApi = {
  list: async (
    eventId: string,
    includeDismissed = false
  ): Promise<NudgesResponse> => {
    const params = includeDismissed ? { include_dismissed: true } : {}
    const { data } = await apiClient.get<NudgesResponse>(
      `/admin/events/${eventId}/nudges`,
      { params }
    )
    return data
  },

  dismiss: async (
    eventId: string,
    nudgeKey: string,
    action: DismissNudgeRequest['action']
  ): Promise<DismissNudgeResponse> => {
    const { data } = await apiClient.post<DismissNudgeResponse>(
      `/admin/events/${eventId}/nudges/${encodeURIComponent(nudgeKey)}/dismiss`,
      { action }
    )
    return data
  },

  clearAll: async (eventId: string): Promise<void> => {
    await apiClient.delete(`/admin/events/${eventId}/nudges/dismissals`)
  },
}
