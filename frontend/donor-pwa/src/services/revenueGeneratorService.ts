import apiClient from '@/lib/axios'

export interface RevenueGeneratorItemSummary {
  id: string
  name: string
  description: string | null
  price_per_entry: number
  max_entries_per_person: number | null
  total_entries: number
  is_open: boolean
}

export async function getEventRevenueGenerators(
  eventId: string
): Promise<RevenueGeneratorItemSummary[]> {
  const response = await apiClient.get<{
    items: RevenueGeneratorItemSummary[]
  }>(`/donor/events/${eventId}/revenue-generators`)
  return response.data.items
}
