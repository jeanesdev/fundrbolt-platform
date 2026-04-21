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

export interface DonateNowConfigResponse {
  id: string
  npo_id: string
  is_enabled: boolean
  donate_plea_text?: string | null
  hero_media_url?: string | null
  hero_transition_style?: string
  processing_fee_pct: string
  npo_info_text?: string | null
}

export interface DonateNowConfigUpdate {
  is_enabled?: boolean
  donate_plea_text?: string | null
  hero_media_url?: string | null
  hero_transition_style?: string
  processing_fee_pct?: string
  npo_info_text?: string | null
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

export const donateNowAdminApi = {
  getConfig: (npoId: string) =>
    apiClient.get<DonateNowConfigResponse>(`/admin/npos/${npoId}/donate-now/config`),

  updateConfig: (npoId: string, data: DonateNowConfigUpdate) =>
    apiClient.put<DonateNowConfigResponse>(`/admin/npos/${npoId}/donate-now/config`, data),

  getTiers: (npoId: string) =>
    apiClient.get<DonationTierResponse[]>(`/admin/npos/${npoId}/donate-now/tiers`),

  updateTiers: (npoId: string, tiers: DonationTierInput[]) =>
    apiClient.put<DonationTierResponse[]>(`/admin/npos/${npoId}/donate-now/tiers`, tiers),

  getHeroUploadUrl: (npoId: string, filename: string, contentType: string) =>
    apiClient.post<{ upload_url: string; blob_url: string }>(
      `/admin/npos/${npoId}/donate-now/hero-upload-url`,
      null,
      { params: { filename, content_type: contentType } }
    ),

  getSupportWall: (npoId: string, params?: { page?: number; page_size?: number; include_hidden?: boolean }) =>
    apiClient.get<AdminSupportWallPage>(`/admin/npos/${npoId}/donate-now/support-wall`, { params }),

  hideEntry: (npoId: string, entryId: string) =>
    apiClient.post(`/admin/npos/${npoId}/donate-now/support-wall/${entryId}/hide`),

  restoreEntry: (npoId: string, entryId: string) =>
    apiClient.post(`/admin/npos/${npoId}/donate-now/support-wall/${entryId}/restore`),
}
