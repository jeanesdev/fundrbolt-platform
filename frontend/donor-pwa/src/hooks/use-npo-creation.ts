/**
 * useNpoCreation hook
 * Hook for creating and managing NPO creation workflow
 */

import { useNPOStore } from '@/stores/npo-store'
import type { NPOCreateRequest } from '@/types/npo'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

export function useNpoCreation() {
  const { createNPO, nposLoading, nposError } = useNPOStore()
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleCreate = async (data: NPOCreateRequest): Promise<void> => {
    setIsSubmitting(true)
    try {
      const npo = await createNPO(data)

      toast.success('Organization created successfully!', {
        description: `${npo.name} has been created in DRAFT status.`,
      })

      // Navigate to NPO detail page
      navigate({ to: `/npos/${npo.id}` })
    } catch (error: unknown) {
      // Extract error message from API response
      const errorMessage =
        error instanceof Error && 'response' in error && typeof error.response === 'object' && error.response !== null && 'data' in error.response && typeof error.response.data === 'object' && error.response.data !== null && 'detail' in error.response.data
          ? typeof error.response.data.detail === 'object' && error.response.data.detail !== null && 'message' in error.response.data.detail
            ? String(error.response.data.detail.message)
            : typeof error.response.data.detail === 'string'
              ? error.response.data.detail
              : 'Failed to create organization. Please try again.'
          : 'Failed to create organization. Please try again.'

      toast.error('Failed to create organization', {
        description: errorMessage,
      })

      throw error
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    createNPO: handleCreate,
    isLoading: nposLoading || isSubmitting,
    error: nposError,
  }
}
