import apiClient from '@/lib/axios'

export interface CancelRegistrationPayload {
  cancellation_reason: 'duplicate' | 'requested' | 'payment_issue' | 'other'
  cancellation_note?: string
}

export const cancelRegistration = async (
  registrationId: string,
  payload: CancelRegistrationPayload
): Promise<void> => {
  await apiClient.delete(`/admin/registrations/${registrationId}/cancel`, {
    data: payload,
  })
}
