/**
 * Tests for AcceptInvitationPage component
 * Focus: Email mismatch detection and UI display
 */

import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AcceptInvitationPage from '@/pages/invitations/accept-invitation'
import { useAuthStore } from '@/stores/auth-store'

// Create a mock JWT token with email
const createMockToken = (email: string) => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({
    email,
    npo_name: 'Test NPO',
    role: 'staff',
    inviter_name: 'John Doe',
  }))
  const signature = 'mock-signature'
  return `${header}.${payload}.${signature}`
}

// Create query client for tests
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
})

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  )
}

describe('AcceptInvitationPage - Email Mismatch Detection', () => {
  const originalLocation = window.location

  beforeEach(() => {
    // Reset auth store state
    useAuthStore.setState({
      isAuthenticated: false,
      user: null,
      accessToken: '',
      refreshToken: '',
      isLoading: false,
      error: null,
    })

    // Mock window.location
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, search: '' },
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    })
    vi.restoreAllMocks()
  })

  it('shows email mismatch warning when logged-in user email differs from invitation email', async () => {
    // Set up authenticated user with different email
    useAuthStore.setState({
      isAuthenticated: true,
      user: {
        id: 'user-123',
        email: 'different@example.com',
        first_name: 'Different',
        last_name: 'User',
        role: 'donor',
        npo_id: null,
      },
    })

    // Set up URL with token
    const token = createMockToken('invited@example.com')
    window.location.search = `?token=${encodeURIComponent(token)}`

    renderWithProviders(<AcceptInvitationPage />)

    // Wait for the component to process the token
    await waitFor(() => {
      expect(screen.getByText('Email Mismatch')).toBeInTheDocument()
    }, { timeout: 3000 })

    // Check warning message content
    expect(screen.getAllByText(/different@example.com/)[0]).toBeInTheDocument()
    expect(screen.getAllByText(/invited@example.com/)[0]).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /switch account/i })).toBeInTheDocument()
  })

  it('shows accept button when logged-in user email matches invitation email', async () => {
    // Set up authenticated user with same email (case insensitive)
    useAuthStore.setState({
      isAuthenticated: true,
      user: {
        id: 'user-123',
        email: 'INVITED@example.com', // Different case
        first_name: 'Invited',
        last_name: 'User',
        role: 'donor',
        npo_id: null,
      },
    })

    // Set up URL with token
    const token = createMockToken('invited@example.com')
    window.location.search = `?token=${encodeURIComponent(token)}`

    renderWithProviders(<AcceptInvitationPage />)

    // Wait for the component to process the token
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /accept invitation/i })).toBeInTheDocument()
    }, { timeout: 3000 })

    // Should not show email mismatch warning
    expect(screen.queryByText('Email Mismatch')).not.toBeInTheDocument()
  })

  it('shows register/login options when user is not authenticated', async () => {
    // User is not authenticated
    useAuthStore.setState({
      isAuthenticated: false,
      user: null,
    })

    // Set up URL with token
    const token = createMockToken('invited@example.com')
    window.location.search = `?token=${encodeURIComponent(token)}`

    renderWithProviders(<AcceptInvitationPage />)

    // Wait for the component to process the token
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /register and accept/i })).toBeInTheDocument()
    }, { timeout: 3000 })

    // Should show login link
    expect(screen.getByText(/log in to accept/i)).toBeInTheDocument()
  })

  it('shows error when no token is provided', async () => {
    // No token in URL
    window.location.search = ''

    renderWithProviders(<AcceptInvitationPage />)

    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText(/no token provided/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('displays invitation details correctly', async () => {
    // Set up authenticated user
    useAuthStore.setState({
      isAuthenticated: true,
      user: {
        id: 'user-123',
        email: 'invited@example.com',
        first_name: 'Invited',
        last_name: 'User',
        role: 'donor',
        npo_id: null,
      },
    })

    // Set up URL with token
    const token = createMockToken('invited@example.com')
    window.location.search = `?token=${encodeURIComponent(token)}`

    renderWithProviders(<AcceptInvitationPage />)

    // Wait for the component to process the token
    await waitFor(() => {
      expect(screen.getByText('Test NPO')).toBeInTheDocument()
    }, { timeout: 3000 })

    // Check other invitation details
    expect(screen.getByText('STAFF')).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getAllByText(/invited@example.com/)[0]).toBeInTheDocument()
  })
})
