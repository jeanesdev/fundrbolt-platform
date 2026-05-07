import type { DonorRunOfShowResponse } from '@/types/run-of-show'
import apiClient from '@/lib/axios'

export const getDonorRunOfShow = async (
  eventId: string
): Promise<DonorRunOfShowResponse> => {
  const { data } = await apiClient.get<DonorRunOfShowResponse>(
    `/donor/events/${eventId}/run-of-show`
  )
  return data
}
