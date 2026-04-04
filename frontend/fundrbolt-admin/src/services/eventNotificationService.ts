import apiClient from '@/lib/axios'

export interface RecipientCriteria {
  type:
    | 'all_attendees'
    | 'all_bidders'
    | 'specific_table'
    | 'individual'
    | 'item_watchers'
  table_number?: number
  user_ids?: string[]
  item_id?: string
}

export interface SendNotificationRequest {
  message: string
  recipient_criteria: RecipientCriteria
  channels: string[]
}

export interface Campaign {
  id: string
  message: string
  recipient_criteria: Record<string, unknown>
  channels: string[]
  recipient_count: number
  delivered_count: number
  failed_count: number
  status: string
  sent_at: string | null
  created_at: string
  sender_id: string
}

export interface CampaignListResponse {
  campaigns: Campaign[]
  total: number
  page: number
  per_page: number
}

class EventNotificationService {
  async sendNotification(
    eventId: string,
    data: SendNotificationRequest
  ): Promise<{ campaign_id: string }> {
    const response = await apiClient.post<{ campaign_id: string }>(
      `/admin/events/${eventId}/notifications`,
      data
    )
    return response.data
  }

  async listCampaigns(
    eventId: string,
    page?: number,
    perPage?: number
  ): Promise<CampaignListResponse> {
    const response = await apiClient.get<CampaignListResponse>(
      `/admin/events/${eventId}/notifications`,
      {
        params: {
          page: page ?? 1,
          per_page: perPage ?? 10,
        },
      }
    )
    return response.data
  }
}

export const eventNotificationService = new EventNotificationService()
export default eventNotificationService
