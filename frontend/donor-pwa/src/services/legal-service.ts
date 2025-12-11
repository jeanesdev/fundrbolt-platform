/**
 * Legal document service
 * API client for fetching legal documents (Terms of Service, Privacy Policy)
 */

import apiClient from '@/lib/axios'
import type {
  LegalDocumentPublic,
  LegalDocumentType,
} from '@/types/legal'

export const legalService = {
  /**
   * Fetch all currently published legal documents
   */
  async fetchAllDocuments(): Promise<LegalDocumentPublic[]> {
    const response = await apiClient.get<LegalDocumentPublic[]>('/legal/documents')
    return response.data
  },

  /**
   * Fetch a specific legal document by type
   * @param type - 'terms_of_service' or 'privacy_policy'
   */
  async fetchDocumentByType(type: LegalDocumentType): Promise<LegalDocumentPublic> {
    const response = await apiClient.get<LegalDocumentPublic>(
      `/legal/documents/${type}`
    )
    return response.data
  },

  /**
   * Fetch a specific version of a legal document
   * @param type - 'terms_of_service' or 'privacy_policy'
   * @param version - Semantic version (e.g., "1.0", "2.1")
   */
  async fetchDocumentVersion(
    type: LegalDocumentType,
    version: string
  ): Promise<LegalDocumentPublic> {
    const response = await apiClient.get<LegalDocumentPublic>(
      `/legal/documents/${type}/version/${version}`
    )
    return response.data
  },
}
