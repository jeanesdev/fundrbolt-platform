/**
 * Event Registration Route
 *
 * Multi-step registration wizard for event registration with guest and meal selection.
 */

import { GuestForm, type GuestFormData } from '@/components/GuestForm'
import { MealSelectionForm, type MealSelectionFormData } from '@/components/MealSelectionForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { useEventBranding } from '@/hooks/use-event-branding'
import { getEventBySlug } from '@/lib/api/events'
import { addGuest } from '@/lib/api/guests'
import { createMealSelection } from '@/lib/api/meal-selections'
import { createRegistration } from '@/lib/api/registrations'
import { useAuthStore } from '@/stores/auth-store'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

export const Route = createFileRoute('/events/$slug/register')({
  component: EventRegistration,
})

type RegistrationStep = 'guest-count' | 'guest-details' | 'meal-selections' | 'complete'

interface GuestData extends GuestFormData {
  index: number
}

function EventRegistration() {
  const { slug } = Route.useParams()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const { applyBranding } = useEventBranding()

  const [step, setStep] = useState<RegistrationStep>('guest-count')
  const [guestCount, setGuestCount] = useState(1)
  const [guests, setGuests] = useState<GuestData[]>([])
  const [currentGuestIndex, setCurrentGuestIndex] = useState(0)
  const [mealSelections, setMealSelections] = useState<Record<string, string>>({})
  const [currentMealIndex, setCurrentMealIndex] = useState(0)
  const [registrationId, setRegistrationId] = useState<string | null>(null)
  const [guestIds, setGuestIds] = useState<string[]>([])

  // Fetch event data
  const { data: event, isLoading: isLoadingEvent } = useQuery({
    queryKey: ['event', slug],
    queryFn: () => getEventBySlug(slug),
  })

  // Apply event branding
  if (event) {
    applyBranding({
      primary_color: event.primary_color,
      secondary_color: event.secondary_color,
      logo_url: event.logo_url,
      banner_url: event.banner_url,
    })
  }

  // Create registration mutation
  const createRegistrationMutation = useMutation({
    mutationFn: createRegistration,
    onSuccess: (data) => {
      setRegistrationId(data.id)
      toast.success('Registration created successfully!')

      // Move to guest details if more than 1 guest, otherwise meal selections
      if (guestCount > 1) {
        setStep('guest-details')
      } else if (event?.food_options && event.food_options.length > 0) {
        setStep('meal-selections')
      } else {
        setStep('complete')
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create registration')
    },
  })

  // Add guest mutation
  const addGuestMutation = useMutation({
    mutationFn: ({ registrationId, guestData }: { registrationId: string; guestData: GuestFormData }) =>
      addGuest(registrationId, guestData),
    onSuccess: (data, variables) => {
      const newGuests = [...guests, { ...variables.guestData, index: currentGuestIndex }]
      setGuests(newGuests)
      setGuestIds([...guestIds, data.id])
      toast.success(`Guest ${currentGuestIndex + 1} added!`)

      // Move to next guest or meal selections
      if (currentGuestIndex < guestCount - 2) {
        setCurrentGuestIndex(currentGuestIndex + 1)
      } else if (event?.food_options && event.food_options.length > 0) {
        setStep('meal-selections')
        setCurrentMealIndex(0)
      } else {
        setStep('complete')
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to add guest')
    },
  })

  // Create meal selection mutation
  const createMealMutation = useMutation({
    mutationFn: ({
      registrationId,
      guestId,
      foodOptionId,
    }: {
      registrationId: string
      guestId: string | null
      foodOptionId: string
    }) =>
      createMealSelection(registrationId, {
        guest_id: guestId,
        food_option_id: foodOptionId,
      }),
    onSuccess: (_, variables) => {
      const key = variables.guestId || 'registrant'
      setMealSelections({ ...mealSelections, [key]: variables.foodOptionId })
      toast.success('Meal selection saved!')

      // Move to next meal selection or complete
      const totalMealSelections = guestCount // registrant + all guests
      if (currentMealIndex < totalMealSelections - 1) {
        setCurrentMealIndex(currentMealIndex + 1)
      } else {
        setStep('complete')
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to save meal selection')
    },
  })

  // Step handlers
  const handleGuestCountSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!user) {
      toast.error('Please sign in to register')
      return
    }

    if (guestCount < 1) {
      toast.error('Guest count must be at least 1')
      return
    }

    // Create registration
    createRegistrationMutation.mutate({
      event_id: event!.id,
      number_of_guests: guestCount,
    })
  }

  const handleGuestSubmit = (data: GuestFormData) => {
    if (!registrationId) return

    addGuestMutation.mutate({
      registrationId,
      guestData: data,
    })
  }

  const handleGuestSkip = () => {
    if (currentGuestIndex < guestCount - 2) {
      setCurrentGuestIndex(currentGuestIndex + 1)
    } else if (event?.food_options && event.food_options.length > 0) {
      setStep('meal-selections')
      setCurrentMealIndex(0)
    } else {
      setStep('complete')
    }
  }

  const handleMealSubmit = (data: MealSelectionFormData) => {
    if (!registrationId) return

    const guestId = currentMealIndex === 0 ? null : guestIds[currentMealIndex - 1]

    createMealMutation.mutate({
      registrationId,
      guestId,
      foodOptionId: data.food_option_id,
    })
  }

  // Loading state
  if (isLoadingEvent) {
    return (
      <div className="container max-w-2xl mx-auto py-12">
        <div className="text-center">Loading event...</div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="container max-w-2xl mx-auto py-12">
        <Card>
          <CardHeader>
            <CardTitle>Event Not Found</CardTitle>
            <CardDescription>The event you're looking for doesn't exist.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate({ to: '/events' })}>
              Back to Events
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Calculate progress
  const getProgress = () => {
    const steps = ['guest-count', 'guest-details', 'meal-selections', 'complete']
    const currentIndex = steps.indexOf(step)
    return ((currentIndex + 1) / steps.length) * 100
  }

  const getCurrentAttendeeName = () => {
    if (currentMealIndex === 0) {
      return `${user?.first_name} ${user?.last_name} (You)`
    }
    const guestIndex = currentMealIndex - 1
    return guests[guestIndex]?.name || `Guest ${guestIndex + 1}`
  }

  return (
    <div className="container max-w-2xl mx-auto py-12">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => navigate({ to: '/' })}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>
        <h1 className="text-3xl font-bold mb-2">Event Registration</h1>
        <p className="text-muted-foreground">{event.name}</p>
        <Progress value={getProgress()} className="mt-4" />
      </div>

      {/* Step 1: Guest Count */}
      {step === 'guest-count' && (
        <Card>
          <CardHeader>
            <CardTitle>How many people are attending?</CardTitle>
            <CardDescription>
              Include yourself and any guests you're bringing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleGuestCountSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="guestCount">Number of Attendees *</Label>
                <Input
                  id="guestCount"
                  type="number"
                  min="1"
                  value={guestCount}
                  onChange={(e) => setGuestCount(parseInt(e.target.value) || 1)}
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={createRegistrationMutation.isPending}
              >
                {createRegistrationMutation.isPending ? 'Creating...' : 'Continue'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Guest Details */}
      {step === 'guest-details' && (
        <Card>
          <CardHeader>
            <CardTitle>Guest {currentGuestIndex + 1} Details</CardTitle>
            <CardDescription>
              Please provide information for guest {currentGuestIndex + 1} of {guestCount - 1}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GuestForm
              guestNumber={currentGuestIndex + 1}
              onSubmit={handleGuestSubmit}
              onSkip={handleGuestSkip}
              showSkipButton
              isLoading={addGuestMutation.isPending}
            />
          </CardContent>
        </Card>
      )}

      {/* Step 3: Meal Selections */}
      {step === 'meal-selections' && event.food_options && event.food_options.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Meal Selection</CardTitle>
            <CardDescription>
              Selection {currentMealIndex + 1} of {guestCount}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MealSelectionForm
              attendeeName={getCurrentAttendeeName()}
              foodOptions={event.food_options}
              onSubmit={handleMealSubmit}
              isLoading={createMealMutation.isPending}
              submitButtonText={
                currentMealIndex < guestCount - 1 ? 'Next Attendee' : 'Complete Registration'
              }
            />
          </CardContent>
        </Card>
      )}

      {/* Step 4: Complete */}
      {step === 'complete' && (
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle className="text-2xl">Registration Complete!</CardTitle>
            <CardDescription>
              You're all set for {event.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-sm text-muted-foreground">
              We've sent a confirmation email with event details and your registration information.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => navigate({ to: '/_authenticated/registrations' })}
                className="flex-1"
              >
                View My Registrations
              </Button>
              <Button
                onClick={() => navigate({ to: '/' })}
                className="flex-1"
              >
                Back to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
