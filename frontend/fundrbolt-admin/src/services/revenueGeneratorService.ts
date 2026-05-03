import apiClient from '@/lib/axios'

export interface RGItem {
  id: string
  event_id: string
  name: string
  description: string | null
  price_per_entry: number
  max_entries: number | null
  image_url: string | null
  is_visible: boolean
  is_open_for_entries: boolean
  display_order: number
  total_entries: number
  total_revenue: number
  current_winner_name: string | null
  current_winner_bidder_number: number | null
  created_at: string
  updated_at: string
}

export interface RGItemCreate {
  name: string
  description?: string | null
  price_per_entry: number
  max_entries?: number | null
  display_order?: number
}

export interface RGItemUpdate {
  name?: string
  description?: string | null
  price_per_entry?: number
  max_entries?: number | null
  is_visible?: boolean
  is_open_for_entries?: boolean
  display_order?: number
}

export interface RGWinnerSelection {
  id: string
  item_id: string
  winner_name: string
  bidder_number: number
  selection_method: 'random_draw' | 'manual'
  selected_at: string
  selected_by_user_id: string | null
}

export interface RGEntryRow {
  registration_guest_id: string | null
  bidder_number: number
  donor_name: string
  profile_picture_url: string | null
  table_number: number | null
  entry_count: number
  total_paid: number
  last_purchased_at: string
}

export interface RGEntryListResponse {
  item_id: string
  entries: RGEntryRow[]
  total_entries: number
  total_revenue: number
  page: number
  per_page: number
  total_pages: number
}

const BASE = (eventId: string) => `/admin/events/${eventId}/revenue-generators`

const revenueGeneratorService = {
  async listItems(eventId: string): Promise<RGItem[]> {
    const res = await apiClient.get<{ items: RGItem[] }>(BASE(eventId))
    return res.data.items
  },

  async createItem(eventId: string, data: RGItemCreate): Promise<RGItem> {
    const res = await apiClient.post<RGItem>(BASE(eventId), data)
    return res.data
  },

  async updateItem(
    eventId: string,
    itemId: string,
    data: RGItemUpdate
  ): Promise<RGItem> {
    const res = await apiClient.patch<RGItem>(
      `${BASE(eventId)}/${itemId}`,
      data
    )
    return res.data
  },

  async deleteItem(eventId: string, itemId: string): Promise<void> {
    await apiClient.delete(`${BASE(eventId)}/${itemId}`)
  },

  async listEntries(
    eventId: string,
    itemId: string,
    page = 1,
    perPage = 50
  ): Promise<RGEntryListResponse> {
    const res = await apiClient.get<RGEntryListResponse>(
      `${BASE(eventId)}/${itemId}/entries`,
      { params: { page, per_page: perPage } }
    )
    return res.data
  },

  async drawRandomWinner(
    eventId: string,
    itemId: string
  ): Promise<RGWinnerSelection> {
    const res = await apiClient.post<RGWinnerSelection>(
      `${BASE(eventId)}/${itemId}/draw-winner`
    )
    return res.data
  },

  async getWinnerHistory(
    eventId: string,
    itemId: string
  ): Promise<RGWinnerSelection[]> {
    const res = await apiClient.get<{
      item_id: string
      history: RGWinnerSelection[]
    }>(`${BASE(eventId)}/${itemId}/winner-history`)
    return res.data.history
  },

  async getImageUploadUrl(
    eventId: string,
    itemId: string,
    file: File
  ): Promise<{ upload_url: string; blob_name: string; expires_at: string }> {
    const res = await apiClient.post<{
      upload_url: string
      blob_name: string
      expires_at: string
    }>(`${BASE(eventId)}/${itemId}/image/upload-url`, {
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
    })
    return res.data
  },

  async confirmImageUpload(
    eventId: string,
    itemId: string,
    blobName: string,
    fileName: string
  ): Promise<RGItem> {
    const res = await apiClient.post<RGItem>(
      `${BASE(eventId)}/${itemId}/image/confirm`,
      { blob_name: blobName, file_name: fileName }
    )
    return res.data
  },

  async deleteImage(eventId: string, itemId: string): Promise<void> {
    await apiClient.delete(`${BASE(eventId)}/${itemId}/image`)
  },
}

export default revenueGeneratorService
