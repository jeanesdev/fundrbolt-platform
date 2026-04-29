import apiClient from '@/lib/axios'

export interface DonateNowHeroMediaItem {
  id: string
  media_type: 'image' | 'video'
  file_url: string
  file_name: string
  display_order: number
}

export interface DonationTier {
  id: string
  amount_cents: number
  impact_statement: string | null
  display_order: number
}

export interface DonateNowPageData {
  npo_id: string
  npo_name: string
  npo_slug: string
  is_enabled: boolean
  donate_plea_text: string | null
  hero_media_url: string | null
  hero_transition_style: string
  processing_fee_pct: string
  npo_info_text: string | null
  page_logo_url: string | null
  effective_color_primary: string | null
  effective_color_secondary: string | null
  effective_color_background: string | null
  effective_color_accent: string | null
  tiers: DonationTier[]
  media_items: DonateNowHeroMediaItem[]
  social_links: { platform: string; url: string }[]
  upcoming_event: {
    id: string
    name: string
    slug: string
    start_date: string | null
    location: string | null
    logo_url: string | null
  } | null
}

export interface DonationCreateRequest {
  amount_cents: number
  donor_name?: string
  covers_processing_fee?: boolean
  is_monthly?: boolean
  recurrence_start?: string
  recurrence_end?: string
  support_wall_message?: string
  is_anonymous?: boolean
  show_amount?: boolean
  idempotency_key?: string
}

export interface DonationResponse {
  id: string
  npo_id: string
  amount_cents: number
  covers_processing_fee: boolean
  processing_fee_cents: number
  total_charged_cents: number
  is_monthly: boolean
  recurrence_start: string | null
  recurrence_end: string | null
  recurrence_status: string | null
  next_charge_date: string | null
  status: 'pending' | 'captured' | 'declined' | 'cancelled'
  created_at: string
}

export interface SupportWallEntry {
  id: string
  display_name: string | null
  is_anonymous: boolean
  show_amount: boolean
  amount_cents: number | null
  tier_label: string | null
  message: string | null
  created_at: string
}

export interface SupportWallPage {
  entries: SupportWallEntry[]
  total: number
  page: number
  per_page: number
  pages: number
}

export const donateNowApi = {
  getPage: (npoSlug: string) =>
    apiClient.get<DonateNowPageData>(`/npos/${npoSlug}/donate-now`),

  createDonation: (npoSlug: string, data: DonationCreateRequest) =>
    apiClient.post<DonationResponse>(
      `/npos/${npoSlug}/donate-now/donations`,
      data
    ),

  getSupportWall: (npoSlug: string, page = 1, pageSize = 20) =>
    apiClient.get<SupportWallPage>(`/npos/${npoSlug}/donate-now/support-wall`, {
      params: { page, page_size: pageSize },
    }),
}
