import { useEffect } from 'react'
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { ArrowRight, CalendarDays, MapPin } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import {
  getContrastingTextColor,
  getContrastingTextColors,
  hexToRgbTuple,
} from '@/lib/color-utils'
import { DonateNowHeroSection } from '@/components/donate-now/DonateNowHeroSection'
import { DonationAmountSelector } from '@/components/donate-now/DonationAmountSelector'
import { DonationConfirmDialog } from '@/components/donate-now/DonationConfirmDialog'
import { DonationSuccessOverlay } from '@/components/donate-now/DonationSuccessOverlay'
import { SupportWall } from '@/components/donate-now/SupportWall'
import { useDonateNow } from './useDonateNow'

const DEFAULT_PRIMARY_RGB = '59, 130, 246'
const DEFAULT_SECONDARY_RGB = '147, 51, 234'
const DEFAULT_BACKGROUND_RGB = '255, 255, 255'
const DEFAULT_ACCENT_RGB = '248, 113, 113'

export function DonateNowPage() {
  const { slug } = useParams({ from: '/npo/$slug/donate-now' })
  const { donateResume } = useSearch({ from: '/npo/$slug/donate-now' })
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const state = useDonateNow(slug)
  const {
    pageData,
    isLoading,
    donationSuccess,
    lastDonation,
    setDonationSuccess,
    completePendingDonation,
  } = state

  useEffect(() => {
    const resumeToken = String(donateResume ?? '').replace(/"/g, '')
    if (resumeToken !== '1' || !isAuthenticated) {
      return
    }

    const resumed = completePendingDonation()
    if (resumed) {
      void navigate({
        to: '/npo/$slug/donate-now',
        params: { slug },
        search: {},
        replace: true,
      })
    }
  }, [completePendingDonation, donateResume, isAuthenticated, navigate, slug])

  useEffect(() => {
    if (!pageData) return

    const root = document.documentElement

    const previous = {
      eventPrimary: root.style.getPropertyValue('--event-primary'),
      eventSecondary: root.style.getPropertyValue('--event-secondary'),
      eventBackground: root.style.getPropertyValue('--event-background'),
      eventAccent: root.style.getPropertyValue('--event-accent'),
      textOnPrimary: root.style.getPropertyValue('--event-text-on-primary'),
      textOnSecondary: root.style.getPropertyValue('--event-text-on-secondary'),
      textOnBackground: root.style.getPropertyValue(
        '--event-text-on-background'
      ),
      textMutedOnBackground: root.style.getPropertyValue(
        '--event-text-muted-on-background'
      ),
      cardBg: root.style.getPropertyValue('--event-card-bg'),
      cardText: root.style.getPropertyValue('--event-card-text'),
      cardTextMuted: root.style.getPropertyValue('--event-card-text-muted'),
    }
    const previousBodyBackground = document.body.style.backgroundColor

    if (pageData.effective_color_primary) {
      root.style.setProperty(
        '--event-primary',
        hexToRgbTuple(pageData.effective_color_primary)
      )
      root.style.setProperty(
        '--event-text-on-primary',
        getContrastingTextColor(pageData.effective_color_primary)
      )
    }

    if (pageData.effective_color_secondary) {
      root.style.setProperty(
        '--event-secondary',
        hexToRgbTuple(pageData.effective_color_secondary)
      )
      root.style.setProperty(
        '--event-text-on-secondary',
        getContrastingTextColor(pageData.effective_color_secondary)
      )
      root.style.setProperty(
        '--event-card-bg',
        hexToRgbTuple(pageData.effective_color_secondary)
      )
      root.style.setProperty(
        '--event-card-text',
        getContrastingTextColor(pageData.effective_color_secondary)
      )
      root.style.setProperty(
        '--event-card-text-muted',
        getContrastingTextColors(pageData.effective_color_secondary).muted
      )
    }

    const backgroundHex = pageData.effective_color_background ?? '#FFFFFF'
    root.style.setProperty('--event-background', hexToRgbTuple(backgroundHex))
    root.style.setProperty(
      '--event-text-on-background',
      getContrastingTextColor(backgroundHex)
    )
    root.style.setProperty(
      '--event-text-muted-on-background',
      getContrastingTextColors(backgroundHex).muted
    )

    const accentHex = pageData.effective_color_accent ?? '#F87171'
    root.style.setProperty('--event-accent', hexToRgbTuple(accentHex))

    document.body.style.backgroundColor = `rgb(${hexToRgbTuple(backgroundHex)})`

    return () => {
      root.style.setProperty(
        '--event-primary',
        previous.eventPrimary || DEFAULT_PRIMARY_RGB
      )
      root.style.setProperty(
        '--event-secondary',
        previous.eventSecondary || DEFAULT_SECONDARY_RGB
      )
      root.style.setProperty(
        '--event-background',
        previous.eventBackground || DEFAULT_BACKGROUND_RGB
      )
      root.style.setProperty(
        '--event-accent',
        previous.eventAccent || DEFAULT_ACCENT_RGB
      )
      if (previous.textOnPrimary)
        root.style.setProperty(
          '--event-text-on-primary',
          previous.textOnPrimary
        )
      else root.style.removeProperty('--event-text-on-primary')
      if (previous.textOnSecondary)
        root.style.setProperty(
          '--event-text-on-secondary',
          previous.textOnSecondary
        )
      else root.style.removeProperty('--event-text-on-secondary')
      if (previous.textOnBackground)
        root.style.setProperty(
          '--event-text-on-background',
          previous.textOnBackground
        )
      else root.style.removeProperty('--event-text-on-background')
      if (previous.textMutedOnBackground)
        root.style.setProperty(
          '--event-text-muted-on-background',
          previous.textMutedOnBackground
        )
      else root.style.removeProperty('--event-text-muted-on-background')
      if (previous.cardBg)
        root.style.setProperty('--event-card-bg', previous.cardBg)
      else root.style.removeProperty('--event-card-bg')
      if (previous.cardText)
        root.style.setProperty('--event-card-text', previous.cardText)
      else root.style.removeProperty('--event-card-text')
      if (previous.cardTextMuted)
        root.style.setProperty(
          '--event-card-text-muted',
          previous.cardTextMuted
        )
      else root.style.removeProperty('--event-card-text-muted')
      document.body.style.backgroundColor = previousBodyBackground
    }
  }, [pageData])

  if (isLoading) {
    return (
      <div className='flex min-h-screen items-center justify-center'>
        <div className='border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent' />
      </div>
    )
  }

  if (!pageData) {
    return (
      <div className='flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center'>
        <h1 className='text-2xl font-bold'>Donate Now</h1>
        <p className='text-muted-foreground'>
          This donation page is not available. Please check the link and try
          again.
        </p>
      </div>
    )
  }

  return (
    <div
      className='min-h-screen'
      style={{
        backgroundColor: 'rgb(var(--event-background, 255, 255, 255))',
        color: 'var(--event-text-on-background, #000000)',
      }}
    >
      {donationSuccess && lastDonation && (
        <DonationSuccessOverlay
          donation={lastDonation}
          npoName={pageData.npo_name}
          onClose={() => setDonationSuccess(false)}
        />
      )}

      <DonationConfirmDialog state={state} npoName={pageData.npo_name} />

      {/* Hero */}
      <DonateNowHeroSection
        heroMediaUrl={pageData.hero_media_url}
        mediaItems={pageData.media_items ?? []}
        transitionStyle={pageData.hero_transition_style}
        pageLogoUrl={pageData.page_logo_url}
        npoName={pageData.npo_name}
      />

      {pageData.donate_plea_text && (
        <section className='mx-auto max-w-2xl px-4 pt-6'>
          <p
            className='text-sm leading-relaxed whitespace-pre-line sm:text-base'
            style={{ color: 'var(--event-text-muted-on-background, #4B5563)' }}
          >
            {pageData.donate_plea_text}
          </p>
        </section>
      )}

      {pageData.upcoming_event && (
        <section className='mx-auto max-w-2xl px-4 pt-6'>
          <Link
            to='/events/$slug'
            params={{ slug: pageData.upcoming_event.slug }}
            className='block rounded-xl border p-4 transition hover:shadow-sm'
            style={{
              borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.28)',
              backgroundColor: 'rgb(var(--event-background, 255, 255, 255))',
            }}
          >
            <div className='flex items-start gap-3'>
              <div className='h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-black/10 bg-white/80'>
                {pageData.upcoming_event.logo_url ? (
                  <img
                    src={pageData.upcoming_event.logo_url}
                    alt={`${pageData.upcoming_event.name} logo`}
                    className='h-full w-full object-cover'
                  />
                ) : (
                  <div className='text-muted-foreground flex h-full w-full items-center justify-center text-[10px] font-semibold'>
                    EVENT
                  </div>
                )}
              </div>

              <div className='min-w-0 flex-1'>
                <p className='text-muted-foreground text-xs font-semibold tracking-wide uppercase'>
                  Upcoming Event
                </p>
                <h3 className='truncate text-base font-semibold'>
                  {pageData.upcoming_event.name}
                </h3>

                <div className='text-muted-foreground mt-1 space-y-1 text-sm'>
                  <div className='flex items-center gap-1.5'>
                    <CalendarDays className='h-4 w-4 shrink-0' />
                    <span>
                      {pageData.upcoming_event.start_date
                        ? new Date(
                            pageData.upcoming_event.start_date
                          ).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : 'Date coming soon'}
                    </span>
                  </div>
                  <div className='flex items-center gap-1.5'>
                    <MapPin className='h-4 w-4 shrink-0' />
                    <span>
                      {pageData.upcoming_event.location ||
                        'Location coming soon'}
                    </span>
                  </div>
                </div>
              </div>

              <ArrowRight className='text-muted-foreground mt-1 h-5 w-5 shrink-0' />
            </div>
          </Link>
        </section>
      )}

      <div className='mx-auto max-w-2xl space-y-8 px-4 py-8'>
        {/* Donation amount */}
        <DonationAmountSelector state={state} tiers={pageData.tiers} />

        {/* Support wall */}
        <SupportWall npoSlug={slug} />
      </div>
    </div>
  )
}
