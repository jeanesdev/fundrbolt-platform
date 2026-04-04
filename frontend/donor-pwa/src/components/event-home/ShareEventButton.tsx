/**
 * ShareEventButton Component
 *
 * Provides sharing options for the event:
 * - Native Web Share API (mobile devices)
 * - Fallback dropdown with: Facebook, X/Twitter, LinkedIn, Email, SMS, Copy Link
 * - Includes event hashtag in social share text when available
 */
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Check,
  Copy,
  Facebook,
  Link2,
  Mail,
  MessageCircle,
  Share2,
  Twitter,
} from 'lucide-react'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'

export interface ShareEventButtonProps {
  eventName: string
  eventSlug: string
  hashtag?: string | null
  className?: string
}

function buildShareUrl(slug: string): string {
  return `${window.location.origin}/events/${slug}`
}

function buildShareText(eventName: string, hashtag?: string | null): string {
  const parts = [`Check out ${eventName}!`]
  if (hashtag) {
    parts.push(hashtag)
  }
  return parts.join(' ')
}

export function ShareEventButton({
  eventName,
  eventSlug,
  hashtag,
  className,
}: ShareEventButtonProps) {
  const [copied, setCopied] = useState(false)
  const shareUrl = buildShareUrl(eventSlug)
  const shareText = buildShareText(eventName, hashtag)

  const handleNativeShare = useCallback(async () => {
    try {
      await navigator.share({
        title: eventName,
        text: shareText,
        url: shareUrl,
      })
    } catch {
      // User cancelled or share failed silently
    }
  }, [eventName, shareText, shareUrl])

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast.success('Link copied!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy link')
    }
  }, [shareUrl])

  const handleShareFacebook = useCallback(() => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`
    window.open(url, '_blank', 'width=600,height=400')
  }, [shareUrl, shareText])

  const handleShareTwitter = useCallback(() => {
    const params = new URLSearchParams({
      text: shareText,
      url: shareUrl,
    })
    if (hashtag) {
      // Twitter hashtags param expects without the # prefix
      params.set('hashtags', hashtag.replace(/^#/, ''))
    }
    window.open(
      `https://twitter.com/intent/tweet?${params.toString()}`,
      '_blank',
      'width=600,height=400'
    )
  }, [shareText, shareUrl, hashtag])

  const handleShareLinkedIn = useCallback(() => {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`
    window.open(url, '_blank', 'width=600,height=400')
  }, [shareUrl])

  const handleShareEmail = useCallback(() => {
    const subject = encodeURIComponent(`Join me at ${eventName}!`)
    const body = encodeURIComponent(`${shareText}\n\n${shareUrl}`)
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }, [eventName, shareText, shareUrl])

  const handleShareSMS = useCallback(() => {
    const body = encodeURIComponent(`${shareText} ${shareUrl}`)
    // Use ; for iOS, ? for Android — the ; works on both
    window.location.href = `sms:?&body=${body}`
  }, [shareText, shareUrl])

  // If native Web Share API is available, use a simple button
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleNativeShare}
        className={className}
        style={{
          borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.3)',
          color: 'rgb(var(--event-primary, 59, 130, 246))',
        }}
      >
        <Share2 className="mr-2 h-4 w-4" />
        Share Event
      </Button>
    )
  }

  // Fallback: dropdown menu with share options
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={className}
          style={{
            borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.3)',
            color: 'rgb(var(--event-primary, 59, 130, 246))',
          }}
        >
          <Share2 className="mr-2 h-4 w-4" />
          Share Event
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleShareFacebook}>
          <Facebook className="mr-2 h-4 w-4" />
          Facebook
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleShareTwitter}>
          <Twitter className="mr-2 h-4 w-4" />
          X / Twitter
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleShareLinkedIn}>
          <Link2 className="mr-2 h-4 w-4" />
          LinkedIn
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleShareEmail}>
          <Mail className="mr-2 h-4 w-4" />
          Email
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleShareSMS}>
          <MessageCircle className="mr-2 h-4 w-4" />
          Text Message
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCopyLink}>
          {copied ? (
            <Check className="mr-2 h-4 w-4" />
          ) : (
            <Copy className="mr-2 h-4 w-4" />
          )}
          {copied ? 'Copied!' : 'Copy Link'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
