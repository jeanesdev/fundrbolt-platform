/**
 * Invitation Acceptance Page
 * Handles accepting NPO member invitations via JWT token from email
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getErrorMessage, isConsentError } from '@/lib/error-utils'
import { memberApi } from '@/services/npo-service'
import { useAuthStore } from '@/stores/auth-store'
import { useMutation } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle, Mail, Shield, UserPlus, XCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

interface InvitationDetails {
  npo_name: string
  role: string
  inviter_name?: string
  email: string
}

export default function AcceptInvitationPage() {
  const [token, setToken] = useState<string>('')
  const [details, setDetails] = useState<InvitationDetails | null>(null)
  const [validating, setValidating] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Check authentication status and get user info
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)

  // Check if the logged-in user's email matches the invitation email
  const emailMismatch = useMemo(() => {
    if (isAuthenticated && user && details) {
      const userEmail = user.email?.toLowerCase()
      const invitationEmail = details.email?.toLowerCase()
      return Boolean(userEmail && invitationEmail && userEmail !== invitationEmail)
    }
    return false
  }, [isAuthenticated, user, details])

  // Compute the login redirect URL (double-encoded to handle nested query params)
  const loginRedirectUrl = useMemo(() => {
    if (!token) return '/sign-in'
    const encodedToken = encodeURIComponent(token)
    const redirectPath = `/invitations/accept?token=${encodedToken}`
    return `/sign-in?redirect=${encodeURIComponent(redirectPath)}`
  }, [token])

  // Accept invitation mutation
  const acceptMutation = useMutation({
    mutationFn: () => memberApi.acceptInvitation(token),
    onSuccess: (member) => {
      toast.success('Invitation accepted successfully!')
      toast.info(`You are now a ${member.role} of the organization`)
      // Redirect to NPO dashboard or detail page
      window.location.href = `/npos/${member.npo_id}`
    },
    onError: (err: unknown) => {
      const message = getErrorMessage(err, 'Failed to accept invitation')

      // Special handling for consent errors
      if (isConsentError(err)) {
        toast.error('Please accept the Terms of Service and Privacy Policy to continue')
        setError('You must accept the Terms of Service and Privacy Policy before accepting this invitation.')
      } else {
        toast.error(message)
        setError(message)
      }
    },
  })


  // Extract token from URL and validate on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlToken = params.get('token')

    if (!urlToken) {
      // Use queueMicrotask to avoid synchronous setState in effect
      queueMicrotask(() => {
        setError('Invalid invitation link - no token provided')
        setValidating(false)
      })
      return
    }

    // Use queueMicrotask for all state updates
    queueMicrotask(() => {
      setToken(urlToken)

      // Decode JWT token to extract invitation details
      try {
        const payload = JSON.parse(atob(urlToken.split('.')[1]))
        const invitationDetails = {
          npo_name: payload.npo_name || 'Unknown Organization',
          role: payload.role || 'staff',
          inviter_name: payload.inviter_name,
          email: payload.email,
        }
        setDetails(invitationDetails)
        setValidating(false)
      } catch (_err) {
        setError('Invalid invitation token format')
        setValidating(false)
      }
    })
  }, [])

  const handleAccept = () => {
    acceptMutation.mutate()
  }

  const handleRegisterAndAccept = () => {
    // Store token in sessionStorage so it can be used after registration
    sessionStorage.setItem('pending_invitation_token', token)
    // Redirect to registration page with return URL
    // Double encode the redirect path to handle special characters in nested query params
    const encodedToken = encodeURIComponent(token)
    const redirectPath = `/invitations/accept?token=${encodedToken}`
    window.location.href = `/sign-up?redirect=${encodeURIComponent(redirectPath)}`
  }

  const handleDecline = () => {
    toast.info('Invitation declined')
    window.location.href = '/'
  }

  const handleSwitchAccount = async () => {
    // Logout and redirect to sign-in with the invitation redirect
    // Double encode the token to handle special characters in nested query params
    const encodedToken = encodeURIComponent(token)
    const redirectPath = `/invitations/accept?token=${encodedToken}`
    await logout()
    window.location.href = `/sign-in?redirect=${encodeURIComponent(redirectPath)}`
  }

  // Loading state
  if (validating) {
    return (
      <div className="container mx-auto flex min-h-[60vh] items-center justify-center py-12">
        <Card className="w-full max-w-lg">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto flex min-h-[60vh] items-center justify-center py-12">
        <Card className="w-full max-w-lg border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="rounded-full bg-red-100 p-3 dark:bg-red-900/30">
                <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="mb-2 text-lg font-semibold text-red-900 dark:text-red-100">
                  Invalid Invitation
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
              <Button onClick={() => (window.location.href = '/')} variant="outline">
                Return to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Success state - show invitation details
  return (
    <div className="container mx-auto flex min-h-[60vh] items-center justify-center py-12">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="rounded-full bg-blue-100 p-3 dark:bg-blue-900/30">
              <Mail className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <CardTitle className="text-center text-2xl">You've Been Invited!</CardTitle>
          <CardDescription className="text-center">
            Accept this invitation to join the organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Invitation Details */}
          <div className="space-y-4 rounded-lg border bg-muted/50 p-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Organization</p>
              <p className="text-lg font-semibold">{details?.npo_name}</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Your Role</p>
              <Badge className="bg-blue-500 text-white">
                <Shield className="mr-1 h-3 w-3" />
                {details?.role.toUpperCase().replace('_', ' ')}
              </Badge>
            </div>

            {details?.inviter_name && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Invited By</p>
                <p className="text-sm">{details.inviter_name}</p>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <p className="text-sm font-mono">{details?.email}</p>
            </div>
          </div>

          {/* Info Box */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <strong>Note:</strong> By accepting this invitation, you'll be added as a member
              of {details?.npo_name} with {details?.role.replace('_', ' ')} permissions.
            </p>
          </div>

          {/* Action Buttons - Different based on auth status */}
          {isAuthenticated ? (
            emailMismatch ? (
              // Email mismatch warning - user logged in with different email
              <div className="space-y-4">
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                        Email Mismatch
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        You are logged in as <strong className="font-mono">{user?.email}</strong>, but this invitation was sent to <strong className="font-mono">{details?.email}</strong>.
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        Please log in with the correct account to accept this invitation.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={handleSwitchAccount}
                    className="flex-1"
                    size="lg"
                  >
                    Switch Account
                  </Button>
                  <Button
                    onClick={handleDecline}
                    variant="outline"
                    size="lg"
                  >
                    Decline
                  </Button>
                </div>
              </div>
            ) : (
              // Normal accept/decline buttons
              <div className="flex gap-3">
                <Button
                  onClick={handleAccept}
                  disabled={acceptMutation.isPending}
                  className="flex-1"
                  size="lg"
                >
                  {acceptMutation.isPending ? (
                    <>Processing...</>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Accept Invitation
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleDecline}
                  disabled={acceptMutation.isPending}
                  variant="outline"
                  size="lg"
                >
                  Decline
                </Button>
              </div>
            )
          ) : (
            <div className="space-y-3">
              <Button
                onClick={handleRegisterAndAccept}
                className="w-full"
                size="lg"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Register and Accept Invitation
              </Button>
              <div className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <a
                  href={loginRedirectUrl}
                  className="font-medium text-primary hover:underline"
                >
                  Log in to accept
                </a>
              </div>
            </div>
          )}

          {acceptMutation.isError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/20">
              <p className="text-sm text-red-900 dark:text-red-100">
                {error || 'An error occurred while processing your invitation'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
