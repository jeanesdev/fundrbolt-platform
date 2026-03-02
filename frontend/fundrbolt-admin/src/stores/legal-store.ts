/**
 * Legal documents store
 * Manages legal documents state (Terms of Service, Privacy Policy)
 */

import { legalService } from '@/services/legal-service'
import type { LegalDocumentPublic, LegalDocumentType } from '@/types/legal'
import { create } from 'zustand'

interface LegalState {
  // State
  documents: Record<LegalDocumentType, LegalDocumentPublic | null>
  isLoading: boolean
  error: string | null

  // Actions
  setDocuments: (documents: Record<LegalDocumentType, LegalDocumentPublic | null>) => void
  setDocument: (type: LegalDocumentType, document: LegalDocumentPublic) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void

  // API methods
  fetchAllDocuments: () => Promise<void>
  fetchDocumentByType: (type: LegalDocumentType) => Promise<LegalDocumentPublic>
}

const initialState = {
  documents: {
    terms_of_service: null,
    privacy_policy: null,
  },
  isLoading: false,
  error: null,
}

export const useLegalStore = create<LegalState>((set) => ({
  ...initialState,

  // Actions
  setDocuments: (documents) => set({ documents }),

  setDocument: (type, document) =>
    set((state) => ({
      documents: {
        ...state.documents,
        [type]: document,
      },
    })),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  reset: () => set(initialState),

  // API methods
  fetchAllDocuments: async () => {
    set({ isLoading: true, error: null })

    try {
      const documents = await legalService.fetchAllDocuments()

      // Convert array to record by document_type
      const documentsRecord: Record<LegalDocumentType, LegalDocumentPublic | null> = {
        terms_of_service: null,
        privacy_policy: null,
      }

      documents.forEach((doc) => {
        documentsRecord[doc.document_type] = doc
      })

      set({ documents: documentsRecord, isLoading: false })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch documents'
      set({ error: message, isLoading: false })
      throw error
    }
  },

  fetchDocumentByType: async (type: LegalDocumentType) => {
    set({ isLoading: true, error: null })

    try {
      const document = await legalService.fetchDocumentByType(type)

      set((state) => ({
        documents: {
          ...state.documents,
          [type]: document,
        },
        isLoading: false,
      }))

      return document
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch document'
      set({ error: message, isLoading: false })
      throw error
    }
  },
}))
