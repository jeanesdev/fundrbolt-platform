import { DonateNowHeroSection } from '@/components/donate-now/DonateNowHeroSection'
import { DonationAmountSelector } from '@/components/donate-now/DonationAmountSelector'
import { DonationConfirmDialog } from '@/components/donate-now/DonationConfirmDialog'
import { DonationSuccessOverlay } from '@/components/donate-now/DonationSuccessOverlay'
import { MonthlyRecurrenceFields } from '@/components/donate-now/MonthlyRecurrenceFields'
import { SupportWall } from '@/components/donate-now/SupportWall'
import { SupportWallMessageForm } from '@/components/donate-now/SupportWallMessageForm'
import { useParams } from '@tanstack/react-router'
import { useDonateNow } from './useDonateNow'

export function DonateNowPage() {
  const { slug } = useParams({ from: '/npo/$slug/donate-now' })
  const state = useDonateNow(slug)
  const { pageData, isLoading, donationSuccess, lastDonation, setDonationSuccess } = state

  if (isLoading) {
    return (
      <div className='flex min-h-screen items-center justify-center'>
        <div className='h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent' />
      </div>
    )
  }

  if (!pageData) {
    return (
      <div className='flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center'>
        <h1 className='text-2xl font-bold'>Donate Now</h1>
        <p className='text-muted-foreground'>
          This donation page is not available. Please check the link and try again.
        </p>
      </div>
    )
  }

  return (
    <div className='min-h-screen bg-background'>
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
        npoName={pageData.npo_name}
        pleaText={pageData.donate_plea_text}
      />

      <div className='mx-auto max-w-2xl space-y-8 px-4 py-8'>
        {/* Donation amount */}
        <DonationAmountSelector state={state} tiers={pageData.tiers} />

        {/* Monthly toggle */}
        <MonthlyRecurrenceFields state={state} />

        {/* Support wall message */}
        <SupportWallMessageForm state={state} />

        {/* NPO info */}
        {pageData.npo_info_text && (
          <section>
            <h2 className='mb-2 text-lg font-semibold'>About {pageData.npo_name}</h2>
            <p className='text-sm text-muted-foreground whitespace-pre-line'>{pageData.npo_info_text}</p>
          </section>
        )}

        {/* Support wall */}
        <SupportWall npoSlug={slug} />
      </div>
    </div>
  )
}
