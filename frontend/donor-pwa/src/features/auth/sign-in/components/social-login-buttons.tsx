import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { donorSocialAuthApi } from '@/lib/axios'
import { AppleIcon, FacebookIcon, GoogleIcon, MicrosoftIcon } from '@fundrbolt/shared'
import type { SocialAuthProvider } from '@fundrbolt/shared/types'
import { Loader2 } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
import { useCallback, useState } from 'react'

const DEFAULT_PROVIDERS: { provider: SocialAuthProvider; display_name: string }[] = [
  { provider: 'google', display_name: 'Google' },
  { provider: 'apple', display_name: 'Apple' },
  { provider: 'facebook', display_name: 'Facebook' },
  { provider: 'microsoft', display_name: 'Microsoft' },
]

const providerIcons: Record<SocialAuthProvider, ComponentType<SVGProps<SVGSVGElement>>> = {
  google: GoogleIcon,
  apple: AppleIcon,
  facebook: FacebookIcon,
  microsoft: MicrosoftIcon,
}

export function SocialLoginButtons({ redirectTo: _redirectTo }: { redirectTo?: string }) {
  const [activeProvider, setActiveProvider] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSocialLogin = useCallback(
    async (provider: SocialAuthProvider) => {
      setActiveProvider(provider)
      setError(null)
      try {
        const callbackUrl = `${window.location.origin}/social-callback`
        const result = await donorSocialAuthApi.start(provider, {
          app_context: 'donor_pwa',
          redirect_uri: callbackUrl,
        })
        if (result.authorization_url) {
          sessionStorage.setItem(
            'social_auth_pending',
            JSON.stringify({ provider, attempt_id: result.attempt_id }),
          )
          window.location.href = result.authorization_url
        }
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { detail?: { message?: string } } } })
            ?.response?.data?.detail?.message || 'Social sign-in is not available right now'
        setError(message)
        setActiveProvider(null)
      }
    },
    []
  )

  return (
    <div className='mt-4 space-y-3'>
      <div className='relative'>
        <div className='absolute inset-0 flex items-center'>
          <Separator />
        </div>
        <div className='relative flex justify-center text-xs uppercase'>
          <span className='bg-card text-muted-foreground px-2'>
            Or continue with
          </span>
        </div>
      </div>

      <div className='grid grid-cols-2 gap-2'>
        {DEFAULT_PROVIDERS.map((provider) => {
          const Icon = providerIcons[provider.provider]
          return (
            <Button
              key={provider.provider}
              variant='outline'
              type='button'
              disabled={activeProvider !== null}
              onClick={() => handleSocialLogin(provider.provider)}
              className='w-full'
            >
              {activeProvider === provider.provider ? (
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              ) : (
                <Icon className='mr-2' />
              )}
              {provider.display_name}
            </Button>
          )
        })}
      </div>

      {error && (
        <p className='text-destructive text-center text-sm'>{error}</p>
      )}

      <p className='text-muted-foreground text-center text-xs'>
        By using social sign-in, you agree to our processing of your identity
        information as described in our{' '}
        <a
          href='/privacy'
          className='hover:text-primary underline underline-offset-4'
        >
          Privacy Policy
        </a>
        .
      </p>
    </div>
  )
}
