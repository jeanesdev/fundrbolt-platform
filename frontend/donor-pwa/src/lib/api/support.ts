import apiClient from '@/lib/axios'

export interface SupportMessageRequest {
  reason:
    | 'bug'
    | 'event-inquiry'
    | 'account'
    | 'feature-request'
    | 'general'
    | 'other'
  subject: string
  message: string
}

export async function sendSupportMessage(
  data: SupportMessageRequest
): Promise<void> {
  await apiClient.post('/support/contact', data)
}
