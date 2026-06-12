import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { nudgesApi } from './api'
import type { NudgeItem, NudgesResponse } from './types'

export function useNudges(eventId: string) {
  const queryClient = useQueryClient()
  const queryKey = ['nudges', eventId]

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => nudgesApi.list(eventId),
    refetchInterval: 60_000,
    staleTime: 30_000,
    enabled: !!eventId,
  })

  const dismissMutation = useMutation({
    mutationFn: ({
      nudgeKey,
      action,
    }: {
      nudgeKey: string
      action: 'dismissed' | 'actioned'
    }) => nudgesApi.dismiss(eventId, nudgeKey, action),
    onMutate: async ({ nudgeKey }) => {
      await queryClient.cancelQueries({ queryKey })
      const prev = queryClient.getQueryData(queryKey)
      queryClient.setQueryData(queryKey, (old: NudgesResponse | undefined) => {
        if (!old) return old
        return {
          ...old,
          nudges: old.nudges.filter((n: NudgeItem) => n.nudge_key !== nudgeKey),
          active_count: Math.max(0, old.active_count - 1),
        }
      })
      return { prev }
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(queryKey, context.prev)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  })

  const clearAllMutation = useMutation({
    mutationFn: () => nudgesApi.clearAll(eventId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  return {
    nudges: data?.nudges ?? [],
    activeCount: data?.active_count ?? 0,
    computedAt: data?.computed_at,
    isLoading,
    isError,
    dismiss: (
      nudgeKey: string,
      action: 'dismissed' | 'actioned' = 'dismissed'
    ) => dismissMutation.mutate({ nudgeKey, action }),
    clearAll: () => clearAllMutation.mutate(),
    refresh: refetch,
  }
}
