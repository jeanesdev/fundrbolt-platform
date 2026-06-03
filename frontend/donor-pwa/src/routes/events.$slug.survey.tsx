/**
 * Dedicated survey page — renders the attendee profile survey as a full-page
 * experience and navigates back to the event home when complete or skipped.
 *
 * Deep-linked from the survey_invitation notification:
 *   /events/{slug}/survey
 */
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { getEventBySlug } from '@/lib/api/events'
import {
  getDonorSurveyStatus,
  markSurveyDonateBack,
  submitDonorSurvey,
} from '@/lib/api/survey'
import { useEventBranding } from '@/hooks/use-event-branding'
import { AttendeeSurveyModal } from '@/features/survey/AttendeeSurveyModal'
import { SurveyThankYouPopup } from '@/features/survey/SurveyThankYouPopup'

export const Route = createFileRoute('/events/$slug/survey')({
  component: RouteComponent,
})

function RouteComponent() {
  const { slug } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const { applyBranding } = useEventBranding()

  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ['event', slug],
    queryFn: () => getEventBySlug(slug),
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (event) applyBranding(event)
  }, [event, applyBranding])

  const surveyStatusQuery = useQuery({
    queryKey: ['donor-survey-status', event?.id],
    queryFn: () => getDonorSurveyStatus(event!.id),
    enabled: isAuthenticated && Boolean(event?.id),
    staleTime: 60_000,
    retry: false,
  })

  // Dismiss the overlay on the event home page so it never auto-pops again.
  const dismissOnEventHome = () => {
    localStorage.setItem(`survey_dismissed_${slug}`, 'true')
  }

  const [thankYouData, setThankYouData] = useState<{
    discountCents: number
    npoName: string | null
  } | null>(null)

  const submitSurveyMutation = useMutation({
    mutationFn: (payload: Parameters<typeof submitDonorSurvey>[1]) =>
      submitDonorSurvey(event!.id, payload),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({
        queryKey: ['donor-survey-status', event?.id],
      })
      dismissOnEventHome()
      if (
        response.status === 'completed' &&
        response.discount_cents_applied > 0
      ) {
        setThankYouData({
          discountCents: response.discount_cents_applied,
          npoName:
            (event as { npo_name?: string | null } | undefined)?.npo_name ??
            null,
        })
      } else if (response.status === 'completed') {
        toast.success('Thanks for sharing your preferences!')
        navigate({ to: '/events/$slug', params: { slug } })
      } else {
        toast.success('You can always come back to share your preferences.')
        navigate({ to: '/events/$slug', params: { slug } })
      }
    },
    onError: () => {
      toast.error('Unable to save your survey response. Please try again.')
    },
  })

  // Redirect unauthenticated users to the event home
  useEffect(() => {
    if (!isAuthenticated && !eventLoading) {
      navigate({ to: '/events/$slug', params: { slug } })
    }
  }, [isAuthenticated, eventLoading, navigate, slug])

  if (eventLoading || surveyStatusQuery.isLoading) {
    return (
      <div className='flex min-h-screen items-center justify-center'>
        <Loader2 className='text-primary h-8 w-8 animate-spin' />
      </div>
    )
  }

  // Survey config not found — redirect back to event home.
  // Note: we intentionally do NOT check `should_show` here — users should
  // always be able to retake the survey from the dedicated route.
  if (surveyStatusQuery.isFetched && !surveyStatusQuery.data?.survey) {
    return (
      <div className='flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center'>
        <p className='text-muted-foreground text-lg'>
          This survey is not currently available.
        </p>
        <button
          className='text-primary text-sm underline'
          onClick={() => navigate({ to: '/events/$slug', params: { slug } })}
        >
          Back to event
        </button>
      </div>
    )
  }

  if (!surveyStatusQuery.data?.survey) {
    return null
  }

  return (
    <>
      <AttendeeSurveyModal
        open
        survey={surveyStatusQuery.data.survey}
        isSubmitting={submitSurveyMutation.isPending}
        onClose={() => {
          dismissOnEventHome()
          navigate({ to: '/events/$slug', params: { slug } })
        }}
        onSkip={() => submitSurveyMutation.mutate({ action: 'skip' })}
        onComplete={(answers) =>
          submitSurveyMutation.mutate({ action: 'complete', answers })
        }
      />
      <SurveyThankYouPopup
        key={thankYouData !== null ? 'popup-open' : 'popup-closed'}
        open={thankYouData !== null}
        discountCents={thankYouData?.discountCents ?? 0}
        npoName={thankYouData?.npoName ?? null}
        onDonateBack={() => {
          if (event?.id) markSurveyDonateBack(event.id).catch(() => null)
        }}
        onApply={() => {
          setThankYouData(null)
          navigate({ to: '/events/$slug', params: { slug } })
        }}
      />
    </>
  )
}
