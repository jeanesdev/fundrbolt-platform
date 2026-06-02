import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as donorLabelsApi from '../api/donor-labels-api'

export function useDonorLabels(
  npoId: string | null,
  params?: { system_defaults_only?: boolean }
) {
  return useQuery({
    queryKey: ['donor-labels', npoId, params],
    queryFn: () => donorLabelsApi.listDonorLabels(npoId!, params),
    enabled: !!npoId,
  })
}

export function useCreateDonorLabel(npoId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: donorLabelsApi.CreateDonorLabelRequest) =>
      donorLabelsApi.createDonorLabel(npoId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donor-labels', npoId] })
      toast.success('Label created')
    },
    onError: () => {
      toast.error('Failed to create label')
    },
  })
}

export function useDeleteDonorLabel(npoId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (labelId: string) =>
      donorLabelsApi.deleteDonorLabel(npoId!, labelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donor-labels', npoId] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Label deleted')
    },
    onError: () => {
      toast.error('Failed to delete label')
    },
  })
}

export function useUserDonorLabels(
  npoId: string | null,
  userId: string | null
) {
  return useQuery({
    queryKey: ['user-donor-labels', npoId, userId],
    queryFn: () => donorLabelsApi.getUserDonorLabels(npoId!, userId!),
    enabled: !!npoId && !!userId,
  })
}

export function useSetUserDonorLabels(npoId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      userId,
      labelIds,
    }: {
      userId: string
      labelIds: string[]
    }) => donorLabelsApi.setUserDonorLabels(npoId!, userId, labelIds),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['user-donor-labels', npoId, variables.userId],
      })
      queryClient.invalidateQueries({
        queryKey: ['donor-dashboard', 'profile', variables.userId],
      })
      queryClient.invalidateQueries({
        queryKey: ['donor-dashboard', 'leaderboard'],
      })
      queryClient.invalidateQueries({ queryKey: ['users', variables.userId] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['event-attendees'] })
      toast.success('Labels updated')
    },
    onError: () => {
      toast.error('Failed to update labels')
    },
  })
}

export function useConfirmSuggestedDonorLabel(npoId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, labelId }: { userId: string; labelId: string }) =>
      donorLabelsApi.confirmSuggestedDonorLabel(npoId!, userId, labelId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['user-donor-labels', npoId, variables.userId],
      })
      queryClient.invalidateQueries({
        queryKey: ['donor-dashboard', 'profile', variables.userId],
      })
      queryClient.invalidateQueries({
        queryKey: ['donor-dashboard', 'leaderboard'],
      })
      toast.success('Suggested label confirmed')
    },
    onError: () => {
      toast.error('Failed to confirm suggested label')
    },
  })
}

export function useDismissSuggestedDonorLabel(npoId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, labelId }: { userId: string; labelId: string }) =>
      donorLabelsApi.dismissSuggestedDonorLabel(npoId!, userId, labelId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['user-donor-labels', npoId, variables.userId],
      })
      queryClient.invalidateQueries({
        queryKey: ['donor-dashboard', 'profile', variables.userId],
      })
      queryClient.invalidateQueries({
        queryKey: ['donor-dashboard', 'leaderboard'],
      })
      toast.success('Suggested label dismissed')
    },
    onError: () => {
      toast.error('Failed to dismiss suggested label')
    },
  })
}

export function useConfirmAllSuggestedDonorLabels(npoId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId: string) =>
      donorLabelsApi.confirmAllSuggestedDonorLabels(npoId!, userId),
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({
        queryKey: ['user-donor-labels', npoId, userId],
      })
      queryClient.invalidateQueries({
        queryKey: ['donor-dashboard', 'profile', userId],
      })
      queryClient.invalidateQueries({
        queryKey: ['donor-dashboard', 'leaderboard'],
      })
      toast.success('All suggested labels confirmed')
    },
    onError: () => {
      toast.error('Failed to confirm suggested labels')
    },
  })
}
