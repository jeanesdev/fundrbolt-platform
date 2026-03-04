import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { donorSocialAuthApi } from '@/lib/axios'
import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { SocialAuthProvider, SocialAuthProviderItem } from '@fundrbolt/shared/types'

const providerIcons: Record<SocialAuthProvider, string> = {
  google: '🔵',
  apple: '🍎',
  facebook: '📘',
  microsoft: '🟦',
}

export function SocialLoginButtons({ redirectTo: _redirectTo }: { redirectTo?: string }) {
  const [providers, setProviders] = useState<SocialAuthProviderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeProvider, setActiveProvider] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    donorSocialAuthApi
      .getProviders()
      .then((data) => {
        setProviders(data.providers.filter((p) => p.enabled))
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }, [])

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
          window.location.href = result.authorization_url
        }
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { detail?: { message?: string } } } })
            ?.response?.data?.detail?.message || 'Social sign-in failed'
        setError(message)
        setActiveProvider(null)
      }
    },
    []
  )

  if (loading) {
    return null
  }

  if (providers.length === 0) {
    return null
  }

  return (
    <div className='space-y-3'>
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

      <div className='grid gap-2'>
        {providers.map((provider) => (
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
              <span className='mr-2'>
                {providerIcons[provider.provider]}
              </span>
            )}
            {provider.display_name}
          </Button>
        ))}
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
