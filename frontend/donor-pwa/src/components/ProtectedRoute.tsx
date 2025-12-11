/**
 * Protected Route Component
 *
 * Redirects unauthenticated users to sign-in page.
 * Used to protect routes that require authentication.
 */

import { hasValidRefreshToken } from '@/lib/storage/tokens'
import { useAuthStore } from '@/stores/auth-store'
import { Navigate, Outlet, useLocation } from '@tanstack/react-router'
import { useEffect } from 'react'

export function ProtectedRoute() {
  const { isAuthenticated, accessToken } = useAuthStore()
  const location = useLocation()

  // Check if user has a valid refresh token in localStorage
  const hasRefreshToken = hasValidRefreshToken()

  // Allow access if:
  // 1. User is authenticated in store (has access token)
  // 2. OR user has a valid refresh token (auto-login will restore session)
  const isAuthorized = isAuthenticated || (accessToken && hasRefreshToken)

  useEffect(() => {
    // If user has refresh token but not authenticated, trigger auto-login
    if (!isAuthenticated && hasRefreshToken) {
      // Auto-login will be handled by main.tsx on app initialization
      // This useEffect is for routes accessed directly via URL
    }
  }, [isAuthenticated, hasRefreshToken])

  if (!isAuthorized) {
    // Redirect to sign-in, preserving the intended destination
    const redirect = location.pathname + location.search
    return <Navigate to="/sign-in" search={{ redirect }} />
  }

  // Render child routes
  return <Outlet />
}
