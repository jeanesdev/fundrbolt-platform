import { isRetryableError, retryWithBackoff } from '@/lib/retry'
import { useAuthStore } from '@/stores/auth-store'
import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

// Global flag to track if consent modal is already shown
let consentModalShown = false

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds
})

// Flag to prevent multiple simultaneous refresh requests
let isRefreshing = false
let refreshSubscribers: Array<(token: string) => void> = []

// Add subscriber to queue waiting for token refresh
const subscribeTokenRefresh = (callback: (token: string) => void) => {
  refreshSubscribers.push(callback)
}

// Notify all subscribers when token is refreshed
const onTokenRefreshed = (token: string) => {
  refreshSubscribers.forEach((callback) => callback(token))
  refreshSubscribers = []
}

// Request interceptor to add Authorization header
apiClient.interceptors.request.use(
  (config) => {
    // Get access token from auth store
    const token = useAuthStore.getState().accessToken

    // Add Authorization header if token exists
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle errors and token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean
      _retryCount?: number
    }

    // Skip retry for auth endpoints to avoid infinite loops
    const isAuthEndpoint = originalRequest.url?.includes('/auth/')

    // Don't retry if already retried
    if (originalRequest._retryCount) {
      // Already retried via retryWithBackoff, process error normally
    } else if (!isAuthEndpoint && isRetryableError(error, { maxRetries: 3, initialDelayMs: 1000, maxDelayMs: 10000, backoffMultiplier: 2, retryableStatusCodes: [408, 429, 500, 502, 503, 504] })) {
      // Mark that we're attempting retry
      originalRequest._retryCount = 0

      try {
        // Retry the request with exponential backoff
        return await retryWithBackoff(
          () => apiClient(originalRequest),
          {
            maxRetries: 3,
            initialDelayMs: 1000,
            maxDelayMs: 10000,
            backoffMultiplier: 2,
            retryableStatusCodes: [408, 429, 500, 502, 503, 504],
          }
        )
      } catch (retryError) {
        // Retry exhausted, process error below
        return Promise.reject(retryError)
      }
    }

    // Handle 401 Unauthorized - token expired or invalid
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry
    ) {
      // Don't retry refresh endpoint to avoid infinite loops
      if (originalRequest.url?.includes('/auth/refresh')) {
        // Refresh token itself is invalid, logout user
        useAuthStore.getState().reset()
        if (!window.location.pathname.startsWith('/sign-in')) {
          window.location.href = '/sign-in'
        }
        return Promise.reject(error)
      }

      const refreshToken = useAuthStore.getState().refreshToken

      if (!refreshToken) {
        // No refresh token, logout user
        useAuthStore.getState().reset()
        if (!window.location.pathname.startsWith('/sign-in')) {
          window.location.href = '/sign-in'
        }
        return Promise.reject(error)
      }

      // Mark this request as retried
      originalRequest._retry = true

      if (!isRefreshing) {
        // Start refresh process
        isRefreshing = true

        try {
          // Call refresh endpoint
          const response = await axios.post(
            `${apiClient.defaults.baseURL}/auth/refresh`,
            { refresh_token: refreshToken },
            {
              headers: {
                'Content-Type': 'application/json',
              },
            }
          )

          const { access_token } = response.data

          // Update token in store
          useAuthStore.getState().setAccessToken(access_token)

          // Notify all queued requests
          onTokenRefreshed(access_token)

          isRefreshing = false

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${access_token}`
          return apiClient(originalRequest)
        } catch (refreshError) {
          // Refresh failed, logout user
          isRefreshing = false
          refreshSubscribers = []
          useAuthStore.getState().reset()

          if (!window.location.pathname.startsWith('/sign-in')) {
            window.location.href = '/sign-in'
          }

          return Promise.reject(refreshError)
        }
      } else {
        // Another request is already refreshing, queue this request
        return new Promise((resolve) => {
          subscribeTokenRefresh((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            resolve(apiClient(originalRequest))
          })
        })
      }
    }

    // Handle 409 Conflict - consent required
    if (error.response?.status === 409) {
      const errorData = error.response.data as { error?: { code?: string } }

      // Check if this is a consent_required error
      if (errorData?.error?.code === 'consent_required') {
        // Only show modal once to prevent spam
        if (!consentModalShown) {
          consentModalShown = true

          // Show a notification to the user
          // Note: In a real implementation, you'd trigger a global modal here
          // For now, we'll redirect to a consent update page
          // eslint-disable-next-line no-console
          console.error('Consent required: User must accept updated legal documents')

          // Reset flag after a delay to allow future consent checks
          setTimeout(() => {
            consentModalShown = false
          }, 5000)
        }
      }
    }    // Handle 429 Too Many Requests - extract retry-after if available
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after']
      if (retryAfter) {
        ; (error as AxiosError & { retryAfter?: number }).retryAfter = parseInt(
          retryAfter,
          10
        )
      }
    }

    return Promise.reject(error)
  }
)

export default apiClient
