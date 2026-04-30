import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import type { SocialAuthProvider } from '@fundrbolt/shared/types'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { donorSocialAuthApi } from '@/lib/axios'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AuthLayout } from '@/features/auth/auth-layout'

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
        const pending = JSON.parse(
          sessionStorage.getItem('social_auth_pending') ?? 'null'
        ) as { provider: SocialAuthProvider; attempt_id: string } | null
        sessionStorage.removeItem('social_auth_pending')

        if (!pending?.provider) {
          setError('Sign-in session expired or invalid. Please try again.')
          setProcessing(false)
          return
        }

        const result = await donorSocialAuthApi.callback(pending.provider, {
          code,
          state,
          attempt_id: pending.attempt_id,
        })

        if (result.status === 'authenticated') {
          handleSocialAuthSuccess({
            access_token: result.access_token,
            refresh_token: result.refresh_token,
            user_id: result.user_id,
            app_context: 'donor',
          })
          if (result.is_new_account) {
            toast.success(
              'Welcome to FundrBolt! Your account has been created.'
            )
            navigate({ to: '/complete-profile', search: { redirect: '/home' } })
          } else {
            navigate({ to: '/' })
          }
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
        const message =
          (err as { response?: { data?: { detail?: { message?: string } } } })
            ?.response?.data?.detail?.message || 'Social sign-in failed'
        setError(message)
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
            {pending.reason === 'link_confirmation_required' && (
              <p className='text-muted-foreground text-sm'>
                An account with this email already exists. Please sign in with
                your email and password to link your social account.
              </p>
            )}
            {pending.reason === 'email_verification_required' && (
              <p className='text-muted-foreground text-sm'>
                Please verify your email address to complete sign-in. Check your
                inbox for a verification link.
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
