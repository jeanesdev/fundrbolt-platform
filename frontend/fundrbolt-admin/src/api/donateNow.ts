import apiClient from '@/lib/axios'

export interface DonationTierInput {
  amount_cents: number
  impact_statement?: string
  display_order?: number
}

export interface DonationTierResponse extends DonationTierInput {
  id: string
  config_id: string
}

export interface DonateNowMediaItem {
  id: string
  config_id: string
  media_type: 'image' | 'video'
  file_url: string
  file_name: string
  file_type: string
  mime_type: string
  file_size: number
  display_order: number
  created_at: string
}

export interface DonateNowConfigResponse {
  id: string
  npo_id: string
  is_enabled: boolean
  donate_plea_text?: string | null
  hero_media_url?: string | null
  hero_transition_style?: string
  processing_fee_pct: string
  npo_info_text?: string | null
  page_logo_url?: string | null
  brand_color_primary?: string | null
  brand_color_secondary?: string | null
  npo_brand_color_primary?: string | null
  npo_brand_color_secondary?: string | null
  npo_brand_logo_url?: string | null
  media_items: DonateNowMediaItem[]
}

export interface DonateNowConfigUpdate {
  is_enabled?: boolean
  donate_plea_text?: string | null
  hero_media_url?: string | null
  hero_transition_style?: string
  processing_fee_pct?: string
  npo_info_text?: string | null
  page_logo_url?: string | null
  brand_color_primary?: string | null
  brand_color_secondary?: string | null
}

export interface AdminSupportWallEntry {
  id: string
  donation_id: string
  npo_id: string
  display_name?: string
  is_anonymous: boolean
  show_amount: boolean
  message?: string
  is_hidden: boolean
  created_at: string
}

export interface AdminSupportWallPage {
  items: AdminSupportWallEntry[]
  total: number
  page: number
  page_size: number
}

export interface RecentDonationItem {
  id: string
  amount_cents: number
  is_monthly: boolean
  status: string
  donor_name: string
  event_id?: string | null
  created_at: string
}

export interface DonationsDashboardResponse {
  total_count: number
  total_amount_cents: number
  one_time_count: number
  one_time_amount_cents: number
  monthly_count: number
  monthly_amount_cents: number
  recent: RecentDonationItem[]
}

export const donateNowAdminApi = {
  getConfig: (npoId: string) =>
    apiClient.get<DonateNowConfigResponse>(
      `/admin/npos/${npoId}/donate-now/config`
    ),

  updateConfig: (npoId: string, data: DonateNowConfigUpdate) =>
    apiClient.put<DonateNowConfigResponse>(
      `/admin/npos/${npoId}/donate-now/config`,
      data
    ),

  getTiers: (npoId: string) =>
    apiClient.get<DonationTierResponse[]>(
      `/admin/npos/${npoId}/donate-now/tiers`
    ),

  updateTiers: (npoId: string, tiers: DonationTierInput[]) =>
    apiClient.put<DonationTierResponse[]>(
      `/admin/npos/${npoId}/donate-now/tiers`,
      tiers
    ),

  getHeroUploadUrl: (npoId: string, filename: string, contentType: string) =>
    apiClient.post<{ upload_url: string; blob_url: string }>(
      `/admin/npos/${npoId}/donate-now/hero-upload-url`,
      null,
      { params: { filename, content_type: contentType } }
    ),

  getSupportWall: (
    npoId: string,
    params?: { page?: number; page_size?: number; include_hidden?: boolean }
  ) =>
    apiClient.get<AdminSupportWallPage>(
      `/admin/npos/${npoId}/donate-now/support-wall`,
      { params }
    ),

  hideEntry: (npoId: string, entryId: string) =>
    apiClient.post(
      `/admin/npos/${npoId}/donate-now/support-wall/${entryId}/hide`
    ),

  restoreEntry: (npoId: string, entryId: string) =>
    apiClient.post(
      `/admin/npos/${npoId}/donate-now/support-wall/${entryId}/restore`
    ),

  getStats: (npoId: string) =>
    apiClient.get<DonationsDashboardResponse>(
      `/admin/npos/${npoId}/donate-now/stats`
    ),

  uploadHeroMedia: (npoId: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return apiClient.post<DonateNowMediaItem>(
      `/admin/npos/${npoId}/donate-now/media/upload`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
  },

  deleteHeroMedia: (npoId: string, mediaId: string) =>
    apiClient.delete(`/admin/npos/${npoId}/donate-now/media/${mediaId}`),

  uploadPageLogo: (npoId: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return apiClient.post<DonateNowConfigResponse>(
      `/admin/npos/${npoId}/donate-now/page-logo`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
  },
}
