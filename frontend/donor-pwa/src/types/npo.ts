/**
 * NPO (Non-Profit Organization) types
 * Type definitions for NPO management, applications, members, and branding
 */

// ============================================
// Enums
// ============================================

export type NPOStatus = 'draft' | 'pending_approval' | 'approved' | 'suspended' | 'rejected'

export type ApplicationStatus = 'submitted' | 'under_review' | 'approved' | 'rejected'

export type MemberRole = 'admin' | 'co_admin' | 'staff'

export type MemberStatus = 'active' | 'invited' | 'suspended' | 'removed'

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked'

// ============================================
// NPO Types
// ============================================

export interface NPO {
  id: string
  name: string
  tagline: string | null
  description: string | null
  mission_statement: string | null
  tax_id: string | null
  website_url: string | null
  phone: string | null
  email: string
  address: {
    street?: string
    street2?: string
    city?: string
    state?: string
    postal_code?: string
    country?: string
  } | null
  registration_number: string | null
  status: NPOStatus
  created_by_user_id: string
  created_at: string
  updated_at: string
  member_count?: number
  active_member_count?: number
}

export interface NPODetail extends NPO {
  branding?: NPOBranding
  application?: NPOApplication
}

export interface NPOCreateRequest {
  name: string
  tagline?: string
  description?: string
  mission_statement?: string
  tax_id?: string
  website_url?: string
  phone?: string
  email: string
  address?: {
    street?: string
    street2?: string
    city?: string
    state?: string
    postal_code?: string
    country?: string
  }
  registration_number?: string
}

export interface NPOUpdateRequest {
  name?: string
  tagline?: string
  description?: string
  mission_statement?: string
  tax_id?: string
  website_url?: string
  phone?: string
  email?: string
  address?: {
    street?: string
    street2?: string
    city?: string
    state?: string
    postal_code?: string
    country?: string
  }
  registration_number?: string
}

export interface NPOListParams {
  status?: NPOStatus
  search?: string
  created_by_user_id?: string
  page?: number
  page_size?: number
}

export interface NPOListResponse {
  items: NPO[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

// ============================================
// NPO Application Types
// ============================================

export interface NPOApplication {
  id: string
  npo_id: string
  status: ApplicationStatus
  review_notes: Record<string, string> | null
  reviewed_by_user_id: string | null
  submitted_at: string
  reviewed_at: string | null
  created_at: string
  updated_at: string
  npo_name?: string
  npo_email?: string
}

export interface ApplicationReviewRequest {
  status: ApplicationStatus
  review_notes?: Record<string, string>
}

export interface ApplicationListParams {
  status?: ApplicationStatus
  npo_id?: string
  page?: number
  page_size?: number
}

export interface ApplicationListResponse {
  items: NPOApplication[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

// ============================================
// NPO Member Types
// ============================================

export interface NPOMember {
  id: string
  npo_id: string
  user_id: string
  role: MemberRole
  status: MemberStatus
  joined_at: string | null
  invited_by_user_id: string | null
  created_at: string
  updated_at: string
  user_email?: string
  user_first_name?: string
  user_last_name?: string
  user_full_name?: string
  invited_by_name?: string
}

export interface MemberInviteRequest {
  email: string
  role: MemberRole
  first_name?: string
  last_name?: string
}

export interface MemberAddRequest {
  user_id: string
  role: MemberRole
}

export interface MemberRoleUpdateRequest {
  role: MemberRole
}

export interface MemberStatusUpdateRequest {
  status: MemberStatus
  notes?: string
}

export interface MemberListParams {
  npo_id?: string
  status?: MemberStatus
  role?: MemberRole
  search?: string
  page?: number
  page_size?: number
}

export interface MemberListResponse {
  items: NPOMember[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface MemberInviteResponse {
  invitation_id: string
  email: string
  role: MemberRole
  expires_at: string
  message: string
}

export interface PendingInvitation {
  id: string
  email: string
  role: MemberRole
  expires_at: string
  created_at: string
}

// ============================================
// NPO Branding Types
// ============================================

export interface NPOBranding {
  id: string
  npo_id: string
  primary_color: string | null
  secondary_color: string | null
  background_color: string | null
  accent_color: string | null
  logo_url: string | null
  social_media_links: {
    facebook?: string
    twitter?: string
    instagram?: string
    linkedin?: string
  } | null
  custom_css_properties: Record<string, string> | null
  created_at: string
  updated_at: string
  npo_name?: string
}

export interface BrandingCreateRequest {
  primary_color?: string
  secondary_color?: string
  background_color?: string
  accent_color?: string
  logo_url?: string
  social_media_links?: {
    facebook?: string
    twitter?: string
    instagram?: string
    linkedin?: string
  }
  custom_css_properties?: Record<string, string>
}

export interface BrandingUpdateRequest {
  primary_color?: string
  secondary_color?: string
  background_color?: string
  accent_color?: string
  logo_url?: string
  social_media_links?: {
    facebook?: string
    twitter?: string
    instagram?: string
    linkedin?: string
  }
  custom_css_properties?: Record<string, string>
}

export interface LogoUploadRequest {
  file_name: string
  file_size: number
  content_type: string
}

export interface LogoUploadResponse {
  upload_url: string
  logo_url: string
  expires_in: number
  message: string
}
