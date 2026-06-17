import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import apiClient from '@/lib/axios'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

function getDonorPreviewBaseUrl() {
  const configured = import.meta.env.VITE_DONOR_PWA_URL?.replace(/\/+$/, '')

  if (
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1'].includes(window.location.hostname)
  ) {
    return 'http://localhost:5174'
  }

  return (
    configured ||
    (import.meta.env.DEV
      ? 'http://localhost:5174'
      : 'https://app.fundrbolt.com')
  )
}

export function CauseSectionsPreview({
  eventId,
  previewKey,
}: {
  eventId: string
  previewKey?: string
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewToken, setPreviewToken] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadPreviewToken = async () => {
      setPreviewToken(null)
      setPreviewUrl(null)
      setError(null)

      try {
        const response = await apiClient.post<{ token: string }>(
          `/admin/events/${eventId}/preview-token`
        )

        if (cancelled) return

        setPreviewToken(response.data.token)
      } catch (previewError) {
        if (cancelled) return

        setError(
          previewError instanceof Error
            ? previewError.message
            : 'Unable to load donor preview.'
        )
      }
    }

    void loadPreviewToken()

    return () => {
      cancelled = true
    }
  }, [eventId])

  useEffect(() => {
    if (!previewToken) return

    const searchParams = new URLSearchParams({
      eventId,
      token: previewToken,
    })

    if (previewKey) {
      searchParams.set('previewKey', previewKey)
    }

    setPreviewUrl(
      `${getDonorPreviewBaseUrl()}/preview?${searchParams.toString()}`
    )
  }, [eventId, previewKey, previewToken])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Donor Preview</CardTitle>
        <CardDescription>
          Live render of the donor page using the same preview route as the
          published experience.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className='overflow-hidden rounded-2xl border bg-slate-950'>
          {!previewUrl && !error ? (
            <div className='flex min-h-[760px] items-center justify-center p-6'>
              <div className='flex items-center gap-3 text-sm text-slate-300'>
                <Loader2 className='h-4 w-4 animate-spin' />
                Loading donor preview
              </div>
            </div>
          ) : error ? (
            <div className='flex min-h-[760px] items-center justify-center p-6'>
              <div className='max-w-md rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700'>
                <p className='font-semibold'>Preview unavailable</p>
                <p className='mt-1'>{error}</p>
              </div>
            </div>
          ) : (
            <iframe
              title='Donor preview'
              src={previewUrl ?? undefined}
              className='h-[760px] w-full bg-white'
              referrerPolicy='no-referrer'
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}
