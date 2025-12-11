/**
 * Consent service
 * API client for managing user consent (accept, status, history, data rights)
 */

import apiClient from '@/lib/axios'
import type {
  ConsentAcceptRequest,
  ConsentHistoryResponse,
  ConsentResponse,
  ConsentStatusResponse,
  DataDeletionRequest,
  DataExportRequest,
} from '@/types/consent'

export const consentService = {
  /**
   * Accept Terms of Service and Privacy Policy
   * @param request - Document IDs to accept
   */
  async acceptConsent(request: ConsentAcceptRequest): Promise<ConsentResponse> {
    const response = await apiClient.post<ConsentResponse>('/consent/accept', request)
    return response.data
  },

  /**
   * Get current consent status for authenticated user
   */
  async getConsentStatus(): Promise<ConsentStatusResponse> {
    const response = await apiClient.get<ConsentStatusResponse>('/consent/status')
    return response.data
  },

  /**
   * Get consent history for authenticated user
   * @param page - Page number (1-indexed)
   * @param pageSize - Number of items per page
   */
  async getConsentHistory(
    page = 1,
    pageSize = 10
  ): Promise<ConsentHistoryResponse> {
    const response = await apiClient.get<ConsentHistoryResponse>('/consent/history', {
      params: { page, page_size: pageSize },
    })
    return response.data
  },

  /**
   * Request GDPR data export
   * @param request - Optional email override
   */
  async requestDataExport(request?: DataExportRequest): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>(
      '/consent/data-export',
      request || {}
    )
    return response.data
  },

  /**
   * Request GDPR account deletion
   * @param request - Confirmation flag (must be true)
   */
  async requestDataDeletion(
    request: DataDeletionRequest
  ): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>(
      '/consent/data-deletion',
      request
    )
    return response.data
  },

  /**
   * Withdraw consent (requires follow-up action from user)
   */
  async withdrawConsent(): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>('/consent/withdraw')
    return response.data
  },
}
