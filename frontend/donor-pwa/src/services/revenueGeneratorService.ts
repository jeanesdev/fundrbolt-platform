import apiClient from '@/lib/axios'

export interface RevenueGeneratorItemSummary {
  id: string
  name: string
  description: string | null
  price_per_entry: number
  my_entry_count: number
  is_open_for_entries: boolean
  current_winner_name: string | null
  is_visible: boolean
  display_order: number
}

export async function getEventRevenueGenerators(
  eventId: string
): Promise<RevenueGeneratorItemSummary[]> {
  const response = await apiClient.get<{
    items: RevenueGeneratorItemSummary[]
  }>(`/donor/events/${eventId}/revenue-generators`)
  return response.data.items
}

export async function purchaseEntry(
  eventId: string,
  itemId: string
): Promise<{ my_entry_count: number }> {
  const response = await apiClient.post<{ my_entry_count: number }>(
    `/donor/events/${eventId}/revenue-generators/${itemId}/entries`
  )
  return response.data
}
