/**
 * Axios HTTP client for donor PWA API requests.
 * Handles authentication tokens and token refresh automatically.
 */

import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { useAuthStore } from '@/stores/auth-store';
import { useDebugSpoofStore } from '@/stores/debug-spoof-store';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds
});

// Flag to prevent multiple simultaneous refresh requests
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

// Add subscriber to queue waiting for token refresh
const subscribeTokenRefresh = (callback: (token: string) => void) => {
  refreshSubscribers.push(callback);
};

// Notify all subscribers when token is refreshed
const onTokenRefreshed = (token: string) => {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
};

// Request interceptor to add Authorization header
apiClient.interceptors.request.use(
  (config) => {
    // Get access token from auth store
    const token = useAuthStore.getState().accessToken;
    const spoofedUser = useDebugSpoofStore.getState().spoofedUser;
    const spoofedNowIso = useDebugSpoofStore.getState().getEffectiveNowIso();

    // Add Authorization header if token exists
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (spoofedUser?.id) {
      config.headers['X-Spoof-User-Id'] = spoofedUser.id;
    }

    if (spoofedNowIso) {
      config.headers['X-Debug-Now'] = spoofedNowIso;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor to handle errors and token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Handle 401 Unauthorized - token expired or invalid
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      // Don't retry refresh endpoint to avoid infinite loops
      if (originalRequest.url?.includes('/auth/refresh')) {
        // Refresh token itself is invalid, logout user
        useAuthStore.getState().reset();
        if (!window.location.pathname.startsWith('/sign-in')) {
          window.location.href = '/sign-in';
        }
        return Promise.reject(error);
      }

      const refreshToken = useAuthStore.getState().refreshToken;

      if (!refreshToken) {
        // No refresh token, logout user
        useAuthStore.getState().reset();
        if (!window.location.pathname.startsWith('/sign-in')) {
          window.location.href = '/sign-in';
        }
        return Promise.reject(error);
      }

      // Mark this request as retried
      originalRequest._retry = true;

      if (!isRefreshing) {
        // Start refresh process
        isRefreshing = true;

        try {
          // Call refresh endpoint
          const response = await axios.post(
            `${apiClient.defaults.baseURL}/auth/refresh`,
            { refresh_token: refreshToken },
            {
              headers: {
                'Content-Type': 'application/json',
              },
            },
          );

          const { access_token } = response.data;

          // Update token in store
          useAuthStore.getState().setAccessToken(access_token);

          // Notify all queued requests
          onTokenRefreshed(access_token);

          isRefreshing = false;

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return apiClient(originalRequest);
        } catch (refreshError) {
          // Refresh failed, logout user
          isRefreshing = false;
          refreshSubscribers = [];
          useAuthStore.getState().reset();

          if (!window.location.pathname.startsWith('/sign-in')) {
            window.location.href = '/sign-in';
          }

          return Promise.reject(refreshError);
        }
      } else {
        // Another request is already refreshing, queue this request
        return new Promise((resolve) => {
          subscribeTokenRefresh((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(apiClient(originalRequest));
          });
        });
      }
    }

    // Handle 429 Too Many Requests - extract retry-after if available
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      if (retryAfter) {
        (error as AxiosError & { retryAfter?: number }).retryAfter = parseInt(retryAfter, 10);
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
