/**
 * useLegalDocuments hook
 * Hook for fetching and managing legal documents
 */

import { useLegalStore } from '@/stores/legal-store'
import type { LegalDocumentType } from '@/types/legal'
import { useEffect } from 'react'

export function useLegalDocuments() {
  const {
    documents,
    isLoading,
    error,
    fetchAllDocuments,
    fetchDocumentByType,
  } = useLegalStore()

  // Auto-fetch all documents on mount if not already loaded
  useEffect(() => {
    if (!documents.terms_of_service && !documents.privacy_policy && !isLoading) {
      fetchAllDocuments().catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Failed to fetch legal documents:', err)
      })
    }
  }, [documents, isLoading, fetchAllDocuments])

  const refetch = () => {
    return fetchAllDocuments()
  }

  const fetchByType = (type: LegalDocumentType) => {
    return fetchDocumentByType(type)
  }

  return {
    documents,
    termsOfService: documents.terms_of_service,
    privacyPolicy: documents.privacy_policy,
    isLoading,
    error,
    refetch,
    fetchByType,
  }
}
