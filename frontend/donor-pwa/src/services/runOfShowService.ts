import apiClient from '@/lib/axios'
import type { DonorRunOfShowResponse } from '@/types/run-of-show'

export const getDonorRunOfShow = async (
  eventId: string
): Promise<DonorRunOfShowResponse> => {
  const { data } = await apiClient.get<DonorRunOfShowResponse>(
    `/events/${eventId}/run-of-show`
  )
  return data
}
