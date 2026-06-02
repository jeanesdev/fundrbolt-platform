/**
 * Dedicated survey page — renders the attendee profile survey as a full-page
 * experience and navigates back to the event home when complete or skipped.
 *
 * Deep-linked from the survey_invitation notification:
 *   /events/{slug}/survey
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { getEventBySlug } from '@/lib/api/events'
import { getDonorSurveyStatus, submitDonorSurvey } from '@/lib/api/survey'
import { useEventBranding } from '@/hooks/use-event-branding'
import { AttendeeSurveyModal } from '@/features/survey/AttendeeSurveyModal'

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

  const submitSurveyMutation = useMutation({
    mutationFn: (payload: Parameters<typeof submitDonorSurvey>[1]) =>
      submitDonorSurvey(event!.id, payload),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({
        queryKey: ['donor-survey-status', event?.id],
      })
      if (response.status === 'completed') {
        toast.success('Thanks for sharing your preferences!')
      } else {
        toast.success('You can always come back to share your preferences.')
      }
      navigate({ to: '/events/$slug', params: { slug } })
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

  // Survey already completed or unavailable — navigate back to event home
  if (
    surveyStatusQuery.isFetched &&
    (!surveyStatusQuery.data?.should_show || !surveyStatusQuery.data?.survey)
  ) {
    return (
      <div className='flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center'>
        <p className='text-muted-foreground text-lg'>
          {surveyStatusQuery.isError
            ? 'Survey is not available.'
            : 'You have already completed this survey. Thank you!'}
        </p>
        <button
          className='text-primary text-sm underline'
          onClick={() =>
            navigate({ to: '/events/$slug', params: { slug } })
          }
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
    <AttendeeSurveyModal
      open
      survey={surveyStatusQuery.data.survey}
      isSubmitting={submitSurveyMutation.isPending}
      onSkip={() => submitSurveyMutation.mutate({ action: 'skip' })}
      onComplete={(answers) =>
        submitSurveyMutation.mutate({ action: 'complete', answers })
      }
    />
  )
}
