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
import { createMealSelection, getRegistrationMealSelections } from '@/lib/api/meal-selections'
import { createRegistration, getUserRegistrations } from '@/lib/api/registrations'
import { useAuthStore } from '@/stores/auth-store'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useLocation, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

export const Route = createFileRoute('/events/$slug/register')({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      guest: (search.guest as string) || undefined,
    }
  },
  component: EventRegistration,
})

type RegistrationStep = 'guest-count' | 'guest-details' | 'meal-selections' | 'complete'

interface GuestData extends GuestFormData {
  index: number
}

function EventRegistration() {
  const { slug } = Route.useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const restoreUserFromRefreshToken = useAuthStore((state) => state.restoreUserFromRefreshToken)
  const { applyBranding } = useEventBranding()

  const [step, setStep] = useState<RegistrationStep>('guest-count')
  const [guestCount, setGuestCount] = useState(1)
  const [guests, setGuests] = useState<GuestData[]>([])
  const [currentGuestIndex, setCurrentGuestIndex] = useState(0)
  const [mealSelections, setMealSelections] = useState<Record<string, string>>({})
  const [currentMealIndex, setCurrentMealIndex] = useState(0)
  const [registrationId, setRegistrationId] = useState<string | null>(null)
  const [guestIds, setGuestIds] = useState<string[]>([])
  const [isRestoring, setIsRestoring] = useState(true)
  const [isCheckingRegistration, setIsCheckingRegistration] = useState(true)

  // Fetch event data - always fetch, not dependent on auth
  const { data: event, isLoading: isLoadingEvent } = useQuery({
    queryKey: ['event', slug],
    queryFn: () => getEventBySlug(slug),
  })

  // Fetch user's existing registrations for this event (only when authenticated)
  const { data: userRegistrations } = useQuery({
    queryKey: ['userRegistrations'],
    queryFn: () => getUserRegistrations(),
    enabled: !isRestoring && !!event && isAuthenticated, // Only fetch when authenticated
  })

  // Get existing meal selections if user has a registration
  const { data: existingMealSelections } = useQuery({
    queryKey: ['mealSelections', registrationId],
    queryFn: () => getRegistrationMealSelections(registrationId!),
    enabled: !!registrationId,
  })

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
      const detail = error.response?.data?.detail
      let errorMessage = 'Failed to create registration'

      if (typeof detail === 'string') {
        errorMessage = detail
      } else if (detail?.message) {
        errorMessage = detail.message
      }

      toast.error(errorMessage)
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
      const totalMealSelections = guestCount // Total attendees (registrant + guests)
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

  // Restore user from refresh token on mount
  useEffect(() => {
    let mounted = true

    const restore = async () => {
      try {
        // If user is already authenticated, no need to restore
        if (user || isAuthenticated) {
          if (mounted) {
            setIsRestoring(false)
          }
          return
        }

        // Try to restore from refresh token
        await restoreUserFromRefreshToken()

        if (mounted) {
          setIsRestoring(false)
        }
      } catch (error) {
        console.error('Error during user restoration:', error)
        if (mounted) {
          setIsRestoring(false)
        }
      }
    }

    restore()

    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Run only once on mount

  // Apply event branding
  useEffect(() => {
    if (event) {
      applyBranding({
        primary_color: event.primary_color,
        secondary_color: event.secondary_color,
        logo_url: event.logo_url,
        banner_url: event.banner_url,
      })
    }
  }, [event, applyBranding])

  // Check if user is already registered for this event and skip to meal selections
  useEffect(() => {
    if (event && userRegistrations) {
      setIsCheckingRegistration(false)

      if (!registrationId) {
        const existingRegistration = userRegistrations.registrations.find(
          (reg) => reg.event_id === event.id && reg.status !== 'cancelled'
        )

        if (existingRegistration) {
          setRegistrationId(existingRegistration.id)
          setGuestCount(existingRegistration.number_of_guests)
        }
      }
    }
  }, [event, userRegistrations, registrationId])

  // Check if user has already completed meal selections
  useEffect(() => {
    if (registrationId && event && existingMealSelections) {
      const expectedMealSelections = guestCount // Total attendees (registrant + guests)
      const actualMealSelections = existingMealSelections.meal_selections.length

      if (actualMealSelections >= expectedMealSelections) {
        // User has already completed all meal selections
        setStep('complete')
        toast.info('You have already completed your registration for this event.')
      } else if (event.food_options && event.food_options.length > 0) {
        // User needs to complete meal selections
        setStep('meal-selections')
        setCurrentMealIndex(actualMealSelections) // Resume from where they left off
        toast.info('Please complete your meal selections.')
      } else {
        // No meal selections needed
        setStep('complete')
        toast.info('You are already registered for this event.')
      }
    }
  }, [registrationId, event, existingMealSelections, guestCount])  // Step handlers
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

    // Check if already registered (in case the effect hasn't run yet)
    if (registrationId) {
      toast.info('You are already registered for this event.')
      if (event?.food_options && event.food_options.length > 0) {
        setStep('meal-selections')
      } else {
        setStep('complete')
      }
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

  // Show loading while restoring user
  if (isRestoring) {
    console.log('🔄 Auth restoring...')
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  console.log('🔍 Auth state:', { isAuthenticated, hasUser: !!user, isRestoring })

  // Show auth prompt if user is not authenticated
  if (!isAuthenticated || !user) {
    console.log('🔐 Showing auth prompt')

    // Build the full redirect URL with query params
    const searchParams = new URLSearchParams()
    Object.entries(location.search).forEach(([key, value]) => {
      if (value !== undefined) searchParams.append(key, String(value))
    })
    const fullRedirectUrl = searchParams.toString()
      ? `${location.pathname}?${searchParams.toString()}`
      : location.pathname

    return (
      <div className="container max-w-2xl mx-auto py-12">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Event Registration</CardTitle>
            <CardDescription>
              {event ? `Register for ${event.name}` : 'Loading event...'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">
                To register for this event, please sign in to your account or create a new one.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild size="lg">
                  <Link
                    to="/sign-in"
                    search={{
                      redirect: fullRedirectUrl,
                    }}
                  >
                    Sign In
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link
                    to="/sign-up"
                    search={{
                      redirect: fullRedirectUrl,
                    }}
                  >
                    Create Account
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  console.log('✅ User authenticated, showing registration form')

  // Loading state
  if (isLoadingEvent || isCheckingRegistration) {
    return (
      <div className="container max-w-2xl mx-auto py-12">
        <div className="text-center">
          {isLoadingEvent ? 'Loading event...' : 'Checking registration status...'}
        </div>
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
              {guestCount > 1 ? `Selection ${currentMealIndex + 1} of ${guestCount}` : 'Select your meal preference'}
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
                onClick={() => navigate({ to: '/registrations' })}
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
