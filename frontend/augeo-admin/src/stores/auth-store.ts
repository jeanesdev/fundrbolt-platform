import apiClient from '@/lib/axios'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthUser {
  id: string
  email: string
  first_name: string
  last_name: string
  role: string
  npo_id: string | null
  profile_picture_url?: string | null
}

interface LoginRequest {
  email: string
  password: string
}

interface RegisterRequest {
  email: string
  password: string
  first_name: string
  last_name: string
  phone?: string
}

interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  user: AuthUser
}

interface RegisterResponse {
  user: {
    id: string
    email: string
    first_name: string
    last_name: string
    phone: string | null
    email_verified: boolean
    is_active: boolean
    role: string
    created_at: string
  }
  message: string
}

interface AuthState {
  user: AuthUser | null
  accessToken: string
  refreshToken: string
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  // Actions
  setUser: (user: AuthUser | null) => void
  setAccessToken: (accessToken: string) => void
  setRefreshToken: (refreshToken: string) => void
  setError: (error: string | null) => void
  setLoading: (loading: boolean) => void
  reset: () => void

  // API methods
  login: (credentials: LoginRequest) => Promise<LoginResponse>
  register: (data: RegisterRequest) => Promise<RegisterResponse>
  logout: () => Promise<void>
  getUser: () => AuthUser | null
  updateUser: (userData: Partial<AuthUser>) => void
  getProfilePictureUrl: () => string | null
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: '',
      refreshToken: '',
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Setters
      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
        }),

      setAccessToken: (accessToken) => set({ accessToken }),

      setRefreshToken: (refreshToken) => set({ refreshToken }),

      setError: (error) => set({ error }),

      setLoading: (loading) => set({ isLoading: loading }),

      reset: () =>
        set({
          user: null,
          accessToken: '',
          refreshToken: '',
          isAuthenticated: false,
          error: null,
        }),

      // API methods
      login: async (credentials: LoginRequest): Promise<LoginResponse> => {
        set({ isLoading: true, error: null })

        try {
          const response = await apiClient.post<LoginResponse>(
            '/auth/login',
            credentials
          )

          const { access_token, refresh_token, user } = response.data

          // Update store
          set({
            accessToken: access_token,
            refreshToken: refresh_token,
            user,
            isAuthenticated: true,
            isLoading: false,
          })

          return response.data
        } catch (error: unknown) {
          const errorMessage =
            (
              error as {
                response?: { data?: { error?: { message?: string } } }
                message?: string
              }
            ).response?.data?.error?.message ||
            (error as { message?: string }).message ||
            'Login failed'
          set({ error: errorMessage, isLoading: false })
          throw error
        }
      },

      register: async (data: RegisterRequest): Promise<RegisterResponse> => {
        set({ isLoading: true, error: null })

        try {
          const response = await apiClient.post<RegisterResponse>(
            '/auth/register',
            data
          )

          set({ isLoading: false })
          return response.data
        } catch (error: unknown) {
          const errorMessage =
            (
              error as {
                response?: { data?: { error?: { message?: string } } }
                message?: string
              }
            ).response?.data?.error?.message ||
            (error as { message?: string }).message ||
            'Registration failed'
          set({ error: errorMessage, isLoading: false })
          throw error
        }
      },

      logout: async (): Promise<void> => {
        const { accessToken, refreshToken, reset } = get()

        try {
          // Call logout endpoint if tokens exist
          if (accessToken && refreshToken) {
            await apiClient.post('/auth/logout', {
              refresh_token: refreshToken,
            })
          }
        } catch (_error) {
          // Silently fail - we still want to clear local state
          // Error is expected if token is already invalid
        } finally {
          // Always clear local state
          reset()

          // T070: Clear NPO selection from localStorage on logout
          const { useNPOContextStore } = await import('./npo-context-store')
          useNPOContextStore.getState().reset()
        }
      },

      getUser: (): AuthUser | null => {
        return get().user
      },

      updateUser: (userData: Partial<AuthUser>): void => {
        const currentUser = get().user
        if (currentUser) {
          set({ user: { ...currentUser, ...userData } })
        }
      },

      getProfilePictureUrl: (): string | null => {
        const user = get().user
        if (!user?.profile_picture_url) return null

        const pictureUrl = user.profile_picture_url
        if (pictureUrl.startsWith('http://') || pictureUrl.startsWith('https://')) {
          return pictureUrl
        }

        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'
        const baseUrl = apiUrl.replace(/\/api\/v1$/, '')
        return `${baseUrl}${pictureUrl}`
      },
    }),
    {
      name: 'augeo-auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
