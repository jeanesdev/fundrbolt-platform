import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AuthLayout } from '@/features/auth/auth-layout'
import { adminSocialAuthApi } from '@/lib/axios'
import { useAuthStore } from '@/stores/auth-store'
import type { SocialAuthProvider } from '@fundrbolt/shared/types'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

type PendingInfo = {
  reason: string
  message: string
}

export function SocialCallback() {
  const {
    code,
    state,
    error: urlError,
  } = useSearch({ from: '/(auth)/social-callback' })
  const navigate = useNavigate()
  const { handleSocialAuthSuccess } = useAuthStore()
  const [error, setError] = useState<string | null>(urlError || null)
  const [pending, setPending] = useState<PendingInfo | null>(null)
  const [processing, setProcessing] = useState(!urlError)
  const processedRef = useRef(false)

  useEffect(() => {
    if (processedRef.current || !code || !state) return
    processedRef.current = true

    const handleCallback = async () => {
      try {
        // First, look up which app initiated this OAuth attempt by the state token.
        // Since Google only allows localhost:5173 as the redirect URI, donor PWA flows
        // always land here — we need to forward them to the correct app.
        let attemptContext: { app_context: string; redirect_uri: string | null } | null = null
        try {
          attemptContext = await adminSocialAuthApi.getAttemptContext(state)
        } catch {
          // If we can't look up the attempt, fall through to the normal admin flow
          // (will likely fail gracefully with a "state not found" error from the callback)
        }

        if (attemptContext?.app_context === 'donor_pwa' && attemptContext.redirect_uri) {
          // This attempt was started from the donor PWA — redirect there with the same query params
          const donorCallbackUrl = new URL(attemptContext.redirect_uri)
          donorCallbackUrl.search = window.location.search
          window.location.href = donorCallbackUrl.toString()
          return
        }

        const provider = state.split(':')[0] as SocialAuthProvider
        const result = await adminSocialAuthApi.callback(provider, {
          code,
          state,
        })

        if (result.status === 'authenticated') {
          handleSocialAuthSuccess({
            access_token: result.access_token,
            refresh_token: result.refresh_token,
            user_id: result.user_id,
            app_context: 'admin',
          })
          navigate({ to: '/' })
        } else if (result.status === 'pending_verification') {
          setPending({
            reason: result.reason,
            message: result.message || 'Additional verification required.',
          })
          setProcessing(false)
        } else {
          setError('Social sign-in failed. Please try again.')
          setProcessing(false)
        }
      } catch (err: unknown) {
        const detail = (
          err as {
            response?: { data?: { detail?: string | { message?: string } } }
          }
        )?.response?.data?.detail
        const message =
          typeof detail === 'string'
            ? detail
            : detail?.message || 'Social sign-in failed'
        // Check for admin pre-provisioning denial
        if (
          message.includes('not provisioned') ||
          message.includes('No pre-provisioned')
        ) {
          setError(
            'Your account has not been provisioned for admin access. Please contact your organization administrator.'
          )
        } else {
          setError(message)
        }
        setProcessing(false)
      }
    }

    handleCallback()
  }, [code, state, handleSocialAuthSuccess, navigate])

  if (processing) {
    return (
      <AuthLayout>
        <Card className='gap-4'>
          <CardContent className='flex flex-col items-center justify-center py-8'>
            <Loader2 className='h-8 w-8 animate-spin' />
            <p className='text-muted-foreground mt-4 text-sm'>
              Completing sign-in...
            </p>
          </CardContent>
        </Card>
      </AuthLayout>
    )
  }

  if (pending) {
    return (
      <AuthLayout>
        <Card className='gap-4'>
          <CardHeader>
            <CardTitle className='text-lg tracking-tight'>
              Verification Required
            </CardTitle>
            <CardDescription>{pending.message}</CardDescription>
          </CardHeader>
          <CardContent className='space-y-3'>
            {pending.reason === 'admin_step_up_required' && (
              <p className='text-muted-foreground text-sm'>
                Admin accounts require additional identity verification. Please
                confirm your password to complete sign-in.
              </p>
            )}
            {pending.reason === 'link_confirmation_required' && (
              <p className='text-muted-foreground text-sm'>
                An account with this email already exists. Please sign in with
                your email and password to link your social account.
              </p>
            )}
            <Button
              className='w-full'
              onClick={() =>
                navigate({ to: '/sign-in', search: { redirect: undefined } })
              }
            >
              Back to Sign In
            </Button>
          </CardContent>
        </Card>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <Card className='gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>
            Sign-in Failed
          </CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className='w-full'
            onClick={() =>
              navigate({ to: '/sign-in', search: { redirect: undefined } })
            }
          >
            Back to Sign In
          </Button>
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
