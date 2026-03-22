/**
 * Invitation Acceptance Page
 * Handles accepting ticket invitations via token from email
 */
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  getEventBySlug,
  getEventCustomOptions,
  type PublicTicketCustomOption,
} from '@/lib/api/events'
import {
  registerViaInvitation,
  validateInvitationToken,
} from '@/lib/api/ticket-invitations'
import { useAuthStore } from '@/stores/auth-store'
import { useEventContextStore } from '@/stores/event-context-store'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  CalendarDays,
  CheckCircle,
  Loader2,
  LogIn,
  Ticket,
  UserPlus,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

type CustomResponseValue = string | string[] | boolean

export default function AcceptInvitationPage() {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const availableEvents = useEventContextStore((s) => s.availableEvents)
  const setAvailableEvents = useEventContextStore((s) => s.setAvailableEvents)
  const setSelectedEvent = useEventContextStore((s) => s.setSelectedEvent)

  const [phone, setPhone] = useState('')
  const [mealSelectionId, setMealSelectionId] = useState('')
  const [registered, setRegistered] = useState(false)
  const [customResponses, setCustomResponses] = useState<
    Record<string, CustomResponseValue>
  >({})

  // Read token from URL
  const params = new URLSearchParams(window.location.search)
  const token = params.get('token') ?? ''

  const {
    data: validation,
    isLoading: validating,
    error: validationError,
  } = useQuery({
    queryKey: ['invitation-validate', token],
    queryFn: () => validateInvitationToken(token),
    enabled: !!token,
    retry: false,
  })

  // Fetch event details for food options when we have a valid slug
  const { data: eventDetail } = useQuery({
    queryKey: ['event', validation?.event_slug],
    queryFn: () => getEventBySlug(validation!.event_slug!),
    enabled: !!validation?.valid && !!validation?.event_slug,
  })

  // Fetch event-level custom options
  const { data: eventCustomOptions } = useQuery({
    queryKey: ['event-custom-options', validation?.event_slug],
    queryFn: () => getEventCustomOptions(validation!.event_slug!),
    enabled: !!validation?.valid && !!validation?.event_slug,
  })

  const universalOptions: PublicTicketCustomOption[] = eventCustomOptions ?? []

  const buildCustomResponsePayload = () => {
    return universalOptions.reduce<Record<string, string>>(
      (payload, option) => {
        const value = customResponses[option.id]
        if (option.type === 'boolean') {
          if (value === true) payload[option.id] = 'true'
          return payload
        }
        if (option.type === 'multi_select') {
          if (Array.isArray(value) && value.length > 0)
            payload[option.id] = JSON.stringify(value)
          return payload
        }
        if (typeof value === 'string' && value.trim().length > 0)
          payload[option.id] = value.trim()
        return payload
      },
      {}
    )
  }

  const registerMutation = useMutation({
    mutationFn: () =>
      registerViaInvitation(token, {
        phone: phone.trim() || undefined,
        meal_selection_id: mealSelectionId || undefined,
        custom_responses: buildCustomResponsePayload(),
      }),
    onSuccess: (response) => {
      if (validation?.event_slug && validation.event_name) {
        const mergedEvents = [...availableEvents]
        const existingIndex = mergedEvents.findIndex(
          (eventOption) => eventOption.slug === validation.event_slug
        )
        const registeredEvent = {
          id: response.event_id,
          name: validation.event_name,
          slug: response.event_slug,
          event_date: validation.event_date,
          is_registered: true,
          has_ticket_access: false,
        }

        if (existingIndex >= 0) {
          mergedEvents[existingIndex] = {
            ...mergedEvents[existingIndex],
            ...registeredEvent,
          }
        } else {
          mergedEvents.unshift(registeredEvent)
        }

        setAvailableEvents(mergedEvents)
        setSelectedEvent(
          response.event_id,
          validation.event_name,
          response.event_slug
        )
      }

      setRegistered(true)
      toast.success('Registration complete!')
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Registration failed'
      toast.error(msg)
    },
  })

  // No token provided
  if (!token) {
    return (
      <div className='container mx-auto flex min-h-[60vh] items-center justify-center py-12'>
        <Card className='w-full max-w-lg border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20'>
          <CardContent className='pt-6'>
            <div className='flex flex-col items-center gap-4 text-center'>
              <div className='rounded-full bg-red-100 p-3 dark:bg-red-900/30'>
                <XCircle className='h-8 w-8 text-red-600 dark:text-red-400' />
              </div>
              <h3 className='text-lg font-semibold text-red-900 dark:text-red-100'>
                Invalid Invitation Link
              </h3>
              <p className='text-sm text-red-700 dark:text-red-300'>
                No invitation token was provided. Please use the link from your
                email.
              </p>
              <Button
                onClick={() => (window.location.href = '/')}
                variant='outline'
              >
                Go Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Loading
  if (validating) {
    return (
      <div className='container mx-auto flex min-h-[60vh] items-center justify-center py-12'>
        <Card className='w-full max-w-lg'>
          <CardContent className='pt-6'>
            <div className='space-y-4'>
              <Skeleton className='h-12 w-full' />
              <Skeleton className='h-24 w-full' />
              <Skeleton className='h-10 w-full' />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Validation error or invalid token
  if (validationError || !validation || !validation.valid) {
    const isExpired = validation?.expired
    return (
      <div className='container mx-auto flex min-h-[60vh] items-center justify-center py-12'>
        <Card className='w-full max-w-lg border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20'>
          <CardContent className='pt-6'>
            <div className='flex flex-col items-center gap-4 text-center'>
              <div className='rounded-full bg-red-100 p-3 dark:bg-red-900/30'>
                <XCircle className='h-8 w-8 text-red-600 dark:text-red-400' />
              </div>
              <h3 className='text-lg font-semibold text-red-900 dark:text-red-100'>
                {isExpired ? 'Invitation Expired' : 'Invalid Invitation'}
              </h3>
              <p className='text-sm text-red-700 dark:text-red-300'>
                {isExpired
                  ? 'This invitation link has expired. Please ask the host to resend your invitation.'
                  : 'This invitation link is invalid or has expired.'}
              </p>
              <Button
                onClick={() => (window.location.href = '/')}
                variant='outline'
              >
                Go Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Already registered
  if (validation.already_registered) {
    return (
      <div className='container mx-auto flex min-h-[60vh] items-center justify-center py-12'>
        <Card className='w-full max-w-lg'>
          <CardContent className='pt-6'>
            <div className='flex flex-col items-center gap-4 text-center'>
              <div className='rounded-full bg-green-100 p-3 dark:bg-green-900/30'>
                <CheckCircle className='h-8 w-8 text-green-600 dark:text-green-400' />
              </div>
              <h3 className='text-lg font-semibold'>Already Registered</h3>
              <p className='text-muted-foreground text-sm'>
                You&apos;ve already registered for this event.
              </p>
              {validation.event_slug && (
                <Button
                  onClick={() =>
                    navigate({
                      to: '/events/$slug',
                      params: { slug: validation.event_slug! },
                    })
                  }
                >
                  Go to Event
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Registration success
  if (registered) {
    return (
      <div className='container mx-auto flex min-h-[60vh] items-center justify-center py-12'>
        <Card className='w-full max-w-lg text-center'>
          <CardContent className='space-y-4 py-10'>
            <CheckCircle className='mx-auto h-16 w-16 text-green-500' />
            <h2 className='text-2xl font-bold'>Registration Complete!</h2>
            <p className='text-muted-foreground'>
              You are now registered for {validation.event_name}.
            </p>
            {validation.event_slug && (
              <Button
                onClick={() =>
                  navigate({
                    to: '/events/$slug',
                    params: { slug: validation.event_slug! },
                  })
                }
              >
                Go to Event
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Not authenticated — prompt to sign in
  if (!isAuthenticated) {
    const encodedToken = encodeURIComponent(token)
    const redirectPath = `/invitations/accept?token=${encodedToken}`
    const signUpHref = `/sign-up?intent=donor&redirect=${encodeURIComponent(redirectPath)}`

    return (
      <div className='container mx-auto flex min-h-[60vh] items-center justify-center py-12'>
        <Card className='w-full max-w-lg'>
          <CardHeader className='text-center'>
            <div className='mx-auto mb-4 rounded-full bg-blue-100 p-3 dark:bg-blue-900/30'>
              <Ticket className='h-8 w-8 text-blue-600 dark:text-blue-400' />
            </div>
            <CardTitle className='text-2xl'>You&apos;re Invited!</CardTitle>
            <CardDescription>
              Sign in or create an account to accept your invitation.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='bg-muted/50 space-y-2 rounded-lg border p-4'>
              {validation.event_name && (
                <div>
                  <p className='text-muted-foreground text-sm'>Event</p>
                  <p className='font-semibold'>{validation.event_name}</p>
                </div>
              )}
              {validation.event_date && (
                <div className='text-muted-foreground flex items-center gap-1 text-sm'>
                  <CalendarDays className='h-4 w-4' />
                  {new Date(validation.event_date).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
              )}
              {validation.guest_name && (
                <div>
                  <p className='text-muted-foreground text-sm'>Guest</p>
                  <p className='text-sm'>{validation.guest_name}</p>
                </div>
              )}
            </div>

            <Button
              className='w-full'
              onClick={() =>
                (window.location.href = `/sign-in?redirect=${encodeURIComponent(redirectPath)}`)
              }
            >
              <LogIn className='mr-2 h-4 w-4' />
              Sign In to Register
            </Button>
            <div className='text-muted-foreground text-center text-sm'>
              Don&apos;t have an account?{' '}
              <a
                href={signUpHref}
                className='text-primary font-medium hover:underline'
              >
                Create one
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Authenticated — show registration form
  const foodOptions = eventDetail?.food_options ?? []

  return (
    <div className='container mx-auto flex min-h-[60vh] items-center justify-center py-12'>
      <Card className='flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden'>
        <CardHeader className='shrink-0 text-center'>
          <div className='mx-auto mb-4 rounded-full bg-blue-100 p-3 dark:bg-blue-900/30'>
            <Ticket className='h-8 w-8 text-blue-600 dark:text-blue-400' />
          </div>
          <CardTitle className='text-2xl'>Accept Invitation</CardTitle>
          <CardDescription>
            Complete your registration for {validation.event_name}
          </CardDescription>
        </CardHeader>
        <CardContent className='flex min-h-0 flex-1 flex-col overflow-hidden p-0'>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              registerMutation.mutate()
            }}
            className='flex min-h-0 flex-1 flex-col'
          >
            <div className='flex-1 overflow-y-auto px-6'>
              <div className='space-y-5 pt-1 pb-6'>
                <div className='bg-muted/50 space-y-2 rounded-lg border p-4'>
                  <div className='flex items-center justify-between'>
                    <span className='font-medium'>{validation.event_name}</span>
                    <Badge variant='secondary'>
                      <Ticket className='mr-1 h-3 w-3' />
                      Ticket
                    </Badge>
                  </div>
                  {validation.event_date && (
                    <div className='text-muted-foreground flex items-center gap-1 text-sm'>
                      <CalendarDays className='h-4 w-4' />
                      {new Date(validation.event_date).toLocaleDateString(
                        'en-US',
                        {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        }
                      )}
                    </div>
                  )}
                  {validation.guest_name && (
                    <p className='text-muted-foreground text-sm'>
                      Guest: {validation.guest_name}
                    </p>
                  )}
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='inv-phone'>Phone Number (optional)</Label>
                  <Input
                    id='inv-phone'
                    type='tel'
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder='(555) 123-4567'
                  />
                </div>

                {foodOptions.length > 0 && (
                  <div className='space-y-2'>
                    <Label htmlFor='inv-meal'>Meal Selection</Label>
                    <Select
                      value={mealSelectionId}
                      onValueChange={setMealSelectionId}
                    >
                      <SelectTrigger id='inv-meal'>
                        <SelectValue placeholder='Select a meal option' />
                      </SelectTrigger>
                      <SelectContent>
                        {foodOptions.map((opt) => (
                          <SelectItem key={opt.id} value={opt.id}>
                            {opt.name}
                            {opt.description ? ` — ${opt.description}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {universalOptions.length > 0 && (
                  <div className='space-y-3'>
                    <p className='text-sm font-medium'>
                      Registration questions
                    </p>
                    {universalOptions.map(
                      (option: PublicTicketCustomOption) => {
                        if (option.type === 'boolean') {
                          return (
                            <div
                              key={option.id}
                              className='space-y-2 rounded-lg border p-3'
                            >
                              <div className='flex items-start gap-3'>
                                <Checkbox
                                  id={`inv-option-${option.id}`}
                                  checked={customResponses[option.id] === true}
                                  onCheckedChange={(checked) =>
                                    setCustomResponses((c) => ({
                                      ...c,
                                      [option.id]: checked === true,
                                    }))
                                  }
                                />
                                <Label
                                  htmlFor={`inv-option-${option.id}`}
                                  className='leading-5'
                                >
                                  {option.label}
                                  {option.is_required ? ' *' : ''}
                                </Label>
                              </div>
                            </div>
                          )
                        }

                        if (option.type === 'multi_select') {
                          const selected = Array.isArray(
                            customResponses[option.id]
                          )
                            ? (customResponses[option.id] as string[])
                            : []
                          return (
                            <div
                              key={option.id}
                              className='space-y-2 rounded-lg border p-3'
                            >
                              <p className='text-sm font-medium'>
                                {option.label}
                                {option.is_required ? ' *' : ''}
                              </p>
                              <div className='space-y-2'>
                                {(option.choices ?? []).map((choice) => (
                                  <label
                                    key={choice}
                                    className='flex items-center gap-2 text-sm'
                                  >
                                    <Checkbox
                                      checked={selected.includes(choice)}
                                      onCheckedChange={(checked) => {
                                        setCustomResponses((c) => {
                                          const prev = Array.isArray(
                                            c[option.id]
                                          )
                                            ? (c[option.id] as string[])
                                            : []
                                          return {
                                            ...c,
                                            [option.id]: checked
                                              ? [...prev, choice]
                                              : prev.filter(
                                                (v) => v !== choice
                                              ),
                                          }
                                        })
                                      }}
                                    />
                                    <span>{choice}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )
                        }

                        const textVal =
                          typeof customResponses[option.id] === 'string'
                            ? (customResponses[option.id] as string)
                            : ''
                        return (
                          <div
                            key={option.id}
                            className='space-y-2 rounded-lg border p-3'
                          >
                            <Label htmlFor={`inv-option-${option.id}`}>
                              {option.label}
                              {option.is_required ? ' *' : ''}
                            </Label>
                            <Textarea
                              id={`inv-option-${option.id}`}
                              value={textVal}
                              onChange={(e) =>
                                setCustomResponses((c) => ({
                                  ...c,
                                  [option.id]: e.target.value,
                                }))
                              }
                              placeholder='Enter your response'
                            />
                          </div>
                        )
                      }
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className='shrink-0 border-t px-6 py-4'>
              <Button
                type='submit'
                className='w-full'
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Registering…
                  </>
                ) : (
                  <>
                    <UserPlus className='mr-2 h-4 w-4' />
                    Complete Registration
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
