import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/error-utils'
import * as usersApi from '../api/users-api'

/**
 * Hook to fetch users list with pagination
 */
export function useUsers(params?: {
  page?: number
  page_size?: number
  role?: string
  is_active?: boolean
  npo_id?: string
  search?: string
}) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => usersApi.listUsers(params),
  })
}

/**
 * Hook to fetch a single user by ID
 */
export function useUser(userId: string) {
  return useQuery({
    queryKey: ['users', userId],
    queryFn: () => usersApi.getUser(userId),
    enabled: !!userId,
  })
}

/**
 * Hook to create a new user
 */
export function useCreateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: usersApi.createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User created successfully')
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Failed to create user'))
    },
  })
}

/**
 * Hook to update user information
 */
export function useUpdateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: { id: string } & usersApi.UpdateUserRequest) =>
      usersApi.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User updated successfully')
    },
    onError: (error: unknown) => {
      // Extract error message from Axios error response
      let message = 'Failed to update user'

      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as {
          response?: { data?: { detail?: string } }
        }
        if (axiosError.response?.data?.detail) {
          message = axiosError.response.data.detail
        }
      }

      toast.error(message)
    },
  })
}

/**
 * Hook to update user role
 */
export function useUpdateUserRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      userId,
      data,
    }: {
      userId: string
      data: usersApi.RoleUpdateRequest
    }) => usersApi.updateUserRole(userId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['users', variables.userId] })
      toast.success('User role updated successfully')
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error && 'response' in error
          ? (
              error as {
                response?: { data?: { error?: { message?: string } } }
              }
            ).response?.data?.error?.message
          : 'Failed to update user role'
      toast.error(message || 'Failed to update user role')
    },
  })
}

/**
 * Hook to activate/deactivate a user
 */
export function useActivateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      userId,
      data,
    }: {
      userId: string
      data: usersApi.UserActivateRequest
    }) => usersApi.activateUser(userId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['users', variables.userId] })
      const action = variables.data.is_active ? 'activated' : 'deactivated'
      toast.success(`User ${action} successfully`)
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error && 'response' in error
          ? (
              error as {
                response?: { data?: { error?: { message?: string } } }
              }
            ).response?.data?.error?.message
          : 'Failed to update user status'
      toast.error(message || 'Failed to update user status')
    },
  })
}

/**
 * Hook to verify a user's email
 */
export function useVerifyUserEmail() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId: string) => usersApi.verifyUserEmail(userId),
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['users', userId] })
      toast.success('Email verified successfully')
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error && 'response' in error
          ? (error as { response?: { data?: { detail?: string } } }).response
              ?.data?.detail
          : 'Failed to verify email'
      toast.error(message || 'Failed to verify email')
    },
  })
}

/**
 * Hook to delete a user
 */
export function useDeleteUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: usersApi.deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User deleted successfully')
    },
    onError: (error: unknown) => {
      // Extract error message from Axios error response
      let message = 'Failed to delete user'

      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as {
          response?: { data?: { detail?: string } }
        }
        if (axiosError.response?.data?.detail) {
          message = axiosError.response.data.detail
        }
      }

      toast.error(message)
    },
  })
}
