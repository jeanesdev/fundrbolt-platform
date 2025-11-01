/**
 * NPO (Non-Profit Organization) API service
 * Handles all NPO-related API calls including NPO CRUD, applications, members, and branding
 */

import apiClient from '@/lib/axios'
import type {
  ApplicationListParams,
  ApplicationListResponse,
  ApplicationReviewRequest,
  BrandingCreateRequest,
  BrandingUpdateRequest,
  LogoUploadRequest,
  LogoUploadResponse,
  MemberAddRequest,
  MemberInviteRequest,
  MemberInviteResponse,
  MemberListParams,
  MemberListResponse,
  MemberRoleUpdateRequest,
  MemberStatusUpdateRequest,
  NPO,
  NPOApplication,
  NPOBranding,
  NPOCreateRequest,
  NPODetail,
  NPOListParams,
  NPOListResponse,
  NPOMember,
  NPOUpdateRequest,
} from '@/types/npo'

// ============================================
// NPO Management
// ============================================

export const npoApi = {
  /**
   * Fetch list of NPOs with optional filters
   */
  async listNPOs(params?: NPOListParams): Promise<NPOListResponse> {
    const response = await apiClient.get<NPOListResponse>('/npos', { params })
    return response.data
  },

  /**
   * Fetch single NPO by ID
   */
  async getNPO(npoId: string): Promise<NPODetail> {
    const response = await apiClient.get<NPODetail>(`/npos/${npoId}`)
    return response.data
  },

  /**
   * Create a new NPO
   */
  async createNPO(data: NPOCreateRequest): Promise<NPO> {
    const response = await apiClient.post<{ npo: NPO }>('/npos', data)
    return response.data.npo
  },

  /**
   * Update NPO details
   */
  async updateNPO(npoId: string, data: NPOUpdateRequest): Promise<NPO> {
    const response = await apiClient.patch<{ npo: NPO }>(`/npos/${npoId}`, data)
    return response.data.npo
  },

  /**
   * Update NPO status (admin only)
   */
  async updateNPOStatus(
    npoId: string,
    status: string,
    notes?: string
  ): Promise<NPO> {
    const response = await apiClient.patch<{ npo: NPO }>(
      `/npos/${npoId}/status`,
      { status, notes }
    )
    return response.data.npo
  },

  /**
   * Delete NPO (soft delete)
   */
  async deleteNPO(npoId: string): Promise<void> {
    await apiClient.delete(`/npos/${npoId}`)
  },
}

// ============================================
// NPO Applications
// ============================================

export const applicationApi = {
  /**
   * Submit NPO application for approval
   */
  async submitApplication(npoId: string): Promise<NPOApplication> {
    const response = await apiClient.post<{ application: NPOApplication }>(
      '/applications',
      { npo_id: npoId }
    )
    return response.data.application
  },

  /**
   * List applications with filters (admin only)
   */
  async listApplications(
    params?: ApplicationListParams
  ): Promise<ApplicationListResponse> {
    const response = await apiClient.get<ApplicationListResponse>('/applications', {
      params,
    })
    return response.data
  },

  /**
   * Get application by ID
   */
  async getApplication(applicationId: string): Promise<NPOApplication> {
    const response = await apiClient.get<NPOApplication>(
      `/applications/${applicationId}`
    )
    return response.data
  },

  /**
   * Review application (approve/reject) - admin only
   */
  async reviewApplication(
    applicationId: string,
    data: ApplicationReviewRequest
  ): Promise<NPOApplication> {
    const response = await apiClient.post<{ application: NPOApplication }>(
      `/applications/${applicationId}/review`,
      data
    )
    return response.data.application
  },
}

// ============================================
// NPO Members
// ============================================

export const memberApi = {
  /**
   * List NPO members with filters
   */
  async listMembers(params?: MemberListParams): Promise<MemberListResponse> {
    const response = await apiClient.get<MemberListResponse>('/npo-members', {
      params,
    })
    return response.data
  },

  /**
   * Get member by ID
   */
  async getMember(memberId: string): Promise<NPOMember> {
    const response = await apiClient.get<NPOMember>(`/npo-members/${memberId}`)
    return response.data
  },

  /**
   * Invite user to join NPO
   */
  async inviteMember(
    npoId: string,
    data: MemberInviteRequest
  ): Promise<MemberInviteResponse> {
    const response = await apiClient.post<MemberInviteResponse>(
      `/npos/${npoId}/members/invite`,
      data
    )
    return response.data
  },

  /**
   * Add existing user to NPO directly
   */
  async addMember(npoId: string, data: MemberAddRequest): Promise<NPOMember> {
    const response = await apiClient.post<{ member: NPOMember }>(
      `/npos/${npoId}/members`,
      data
    )
    return response.data.member
  },

  /**
   * Update member role
   */
  async updateMemberRole(
    memberId: string,
    data: MemberRoleUpdateRequest
  ): Promise<NPOMember> {
    const response = await apiClient.patch<{ member: NPOMember }>(
      `/npo-members/${memberId}/role`,
      data
    )
    return response.data.member
  },

  /**
   * Update member status
   */
  async updateMemberStatus(
    memberId: string,
    data: MemberStatusUpdateRequest
  ): Promise<NPOMember> {
    const response = await apiClient.patch<{ member: NPOMember }>(
      `/npo-members/${memberId}/status`,
      data
    )
    return response.data.member
  },

  /**
   * Remove member from NPO
   */
  async removeMember(memberId: string, reason?: string): Promise<void> {
    await apiClient.delete(`/npo-members/${memberId}`, {
      data: { reason },
    })
  },
}

// ============================================
// NPO Branding
// ============================================

export const brandingApi = {
  /**
   * Get NPO branding
   */
  async getBranding(npoId: string): Promise<NPOBranding> {
    const response = await apiClient.get<NPOBranding>(`/npos/${npoId}/branding`)
    return response.data
  },

  /**
   * Create NPO branding
   */
  async createBranding(
    npoId: string,
    data: BrandingCreateRequest
  ): Promise<NPOBranding> {
    const response = await apiClient.post<{ branding: NPOBranding }>(
      `/npos/${npoId}/branding`,
      data
    )
    return response.data.branding
  },

  /**
   * Update NPO branding
   */
  async updateBranding(
    npoId: string,
    data: BrandingUpdateRequest
  ): Promise<NPOBranding> {
    const response = await apiClient.patch<{ branding: NPOBranding }>(
      `/npos/${npoId}/branding`,
      data
    )
    return response.data.branding
  },

  /**
   * Request logo upload URL (generates pre-signed SAS URL)
   */
  async requestLogoUpload(
    npoId: string,
    data: LogoUploadRequest
  ): Promise<LogoUploadResponse> {
    const response = await apiClient.post<LogoUploadResponse>(
      `/npos/${npoId}/branding/logo-upload`,
      data
    )
    return response.data
  },

  /**
   * Upload logo file to Azure Blob Storage using SAS URL
   */
  async uploadLogoFile(uploadUrl: string, file: File): Promise<void> {
    // Direct PUT to Azure Blob Storage (not through our API)
    await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'x-ms-blob-type': 'BlockBlob',
        'Content-Type': file.type,
      },
    })
  },

  /**
   * Delete logo
   */
  async deleteLogo(npoId: string): Promise<void> {
    await apiClient.delete(`/npos/${npoId}/branding/logo`)
  },
}

// Export unified API object
export const npoService = {
  ...npoApi,
  application: applicationApi,
  member: memberApi,
  branding: brandingApi,
}

export default npoService
