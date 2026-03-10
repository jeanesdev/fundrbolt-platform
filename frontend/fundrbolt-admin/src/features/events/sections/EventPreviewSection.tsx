import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import apiClient from '@/lib/axios'
import { getErrorMessage } from '@/lib/error-utils'
import { ExternalLink, Eye, Loader2, Smartphone } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { useEventWorkspace } from '../useEventWorkspace'

export function EventPreviewSection() {
  const { currentEvent } = useEventWorkspace()
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false)

  const openPreview = (previewUrl: string) => {
    const isStandaloneDisplay = window.matchMedia(
      '(display-mode: standalone)'
    ).matches
    const isIosStandalone =
      'standalone' in window.navigator &&
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
    const isMobileViewport = window.innerWidth < 768

    if (isStandaloneDisplay || isIosStandalone || isMobileViewport) {
      window.location.assign(previewUrl)
      return 'same-tab' as const
    }

    const popup = window.open(
      previewUrl,
      'donor-preview',
      'width=393,height=852,scrollbars=yes,resizable=yes'
    )

    if (!popup) {
      window.location.assign(previewUrl)
      return 'fallback-same-tab' as const
    }

    popup.focus()
    return 'popup' as const
  }

  const handlePreviewAsDonor = async () => {
    if (!currentEvent?.id) return

    setIsGeneratingPreview(true)
    try {
      const response = await apiClient.post<{ token: string }>(
        `/admin/events/${currentEvent.id}/preview-token`
      )
      const { token } = response.data
      const donorPwaUrl =
        import.meta.env.VITE_DONOR_PWA_URL || 'http://localhost:5174'
      const previewUrl = `${donorPwaUrl}/preview?eventId=${encodeURIComponent(currentEvent.id)}&token=${encodeURIComponent(token)}`
      const openMode = openPreview(previewUrl)

      if (openMode === 'popup') {
        toast.success('Opened donor preview in a new window.')
      } else {
        toast.success('Opening donor preview in this tab.')
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to generate preview'))
    } finally {
      setIsGeneratingPreview(false)
    }
  }

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Eye className='h-5 w-5' />
            Donor PWA Preview
          </CardTitle>
          <CardDescription>
            Open a phone-sized preview of how this event appears in the donor
            PWA. Works for draft, active, and closed events.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='bg-muted/40 flex items-start gap-3 rounded-lg border p-4'>
            <Smartphone className='text-muted-foreground mt-0.5 h-5 w-5 flex-shrink-0' />
            <div className='space-y-1 text-sm'>
              <p className='font-medium'>Preview experience</p>
              <p className='text-muted-foreground'>
                On desktop, the preview opens in a separate phone-sized window.
                On mobile or installed PWAs, it opens in the current tab to
                avoid popup blocking. Interactive donor actions like bidding
                remain disabled.
              </p>
            </div>
          </div>

          <div className='flex flex-col gap-3 sm:flex-row'>
            <Button
              onClick={handlePreviewAsDonor}
              disabled={isGeneratingPreview}
              className='sm:w-auto'
            >
              {isGeneratingPreview ? (
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              ) : (
                <ExternalLink className='mr-2 h-4 w-4' />
              )}
              Open donor preview
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
