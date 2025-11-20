/**
 * useNpoContext Hook
 * Manages NPO context state with query invalidation and role-based NPO selection
 *
 * Business Rules:
 * - SuperAdmin: Can select any NPO or "Augeo Platform" (shows all NPOs)
 * - NPO Admin: Auto-select their assigned NPO, disable selector
 * - Event Coordinator: Show NPOs they're registered with
 * - Staff: Auto-select their assigned NPO, disable selector
 * - Changes to NPO selection invalidate TanStack Query cache
 */

import { useNPOContextStore, type NPOContextOption } from '@/stores/npo-context-store'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect } from 'react'
import { useAuth } from './use-auth'

export interface UseNpoContextReturn {
  selectedNpoId: string | null
  selectedNpoName: string
  availableNpos: NPOContextOption[]
  isLoading: boolean
  error: string | null

  // Actions
  selectNpo: (npoId: string | null, npoName: string) => void
  setAvailableNpos: (npos: NPOContextOption[]) => void

  // Helpers
  isAugeoPlatformView: boolean
  isSingleNpoUser: boolean // True if user has only one NPO (disable selector)
  canChangeNpo: boolean // True if user can change NPO selection
}

export function useNpoContext(): UseNpoContextReturn {
  const queryClient = useQueryClient()
  const { npoId: userNpoId, isNpoAdmin, isStaff } = useAuth()

  const {
    selectedNpoId,
    selectedNpoName,
    availableNpos,
    isLoading,
    error,
    setSelectedNpo,
    setAvailableNpos: storeSetAvailableNpos,
    isAugeoPlatformView: isAugeoView,
  } = useNPOContextStore()

  const isAugeoPlatformView = isAugeoView()

  // Single NPO users (NPO Admin and Staff) should have only their NPO
  const isSingleNpoUser = (isNpoAdmin || isStaff) && userNpoId !== null

  // Only SuperAdmin and Event Coordinator can change NPO selection
  // (NPO Admin and Staff are locked to their NPO)
  const canChangeNpo = !isSingleNpoUser && availableNpos.length > 1

  // Auto-select NPO for single-NPO users on mount
  useEffect(() => {
    if (isSingleNpoUser && userNpoId && selectedNpoId !== userNpoId) {
      // Find NPO name from available NPOs or use placeholder
      const npoName = availableNpos.find(npo => npo.id === userNpoId)?.name || 'My NPO'
      setSelectedNpo(userNpoId, npoName)
    }
  }, [isSingleNpoUser, userNpoId, selectedNpoId, availableNpos, setSelectedNpo])

  // Invalidate queries when NPO selection changes
  const selectNpo = (npoId: string | null, npoName: string) => {
    // Update store
    setSelectedNpo(npoId, npoName)

    // Invalidate all queries to refetch with new NPO context
    // This ensures all data is filtered by the newly selected NPO
    queryClient.invalidateQueries()
  }

  const setAvailableNpos = useCallback((npos: NPOContextOption[]) => {
    storeSetAvailableNpos(npos)

    // For single-NPO users, auto-select their NPO
    if (isSingleNpoUser && npos.length === 1 && npos[0].id) {
      setSelectedNpo(npos[0].id, npos[0].name)
    }
  }, [isSingleNpoUser, setSelectedNpo, storeSetAvailableNpos])

  return {
    selectedNpoId,
    selectedNpoName,
    availableNpos,
    isLoading,
    error,
    selectNpo,
    setAvailableNpos,
    isAugeoPlatformView,
    isSingleNpoUser,
    canChangeNpo,
  }
}
