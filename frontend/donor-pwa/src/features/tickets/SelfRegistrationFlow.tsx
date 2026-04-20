/**
 * SelfRegistrationFlow component — assigns a ticket to self and registers
 * the current user as an attendee. Multi-step inline flow.
 */
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  getEventBySlug,
  getEventCustomOptions,
  getTicketPackages,
  type PublicTicketCustomOption,
} from '@/lib/api/events'
import { assignTicket, selfRegister } from '@/lib/api/ticket-assignments'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, UserCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

type CustomResponseValue = string | string[] | boolean

function normalizeOptionText(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ')
}

function isDuplicateMealQuestion(
  option: PublicTicketCustomOption,
  foodOptionNames: Set<string>
): boolean {
  if (foodOptionNames.size === 0 || option.type !== 'multi_select') {
    return false
  }

  const normalizedLabel = normalizeOptionText(option.label)
  const normalizedChoices = new Set(
    (option.choices ?? []).map((choice) => normalizeOptionText(choice))
  )

  if (!normalizedLabel.includes('meal') || normalizedChoices.size === 0) {
    return false
  }

  if (normalizedChoices.size !== foodOptionNames.size) {
    return false
  }

  return [...normalizedChoices].every((choice) => foodOptionNames.has(choice))
}

function formatPhoneDisplay(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 0) return ''
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  if (digits.length <= 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return `+${digits.slice(0, digits.length - 10)} (${digits.slice(-10, -7)}) ${digits.slice(-7, -4)}-${digits.slice(-4)}`
}

function phoneDisplayToE164(display: string): string {
  const digits = display.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return display
}

function isValidPhoneDisplay(display: string): boolean {
  const digits = display.replace(/\D/g, '')
  if (digits.length === 10) return true
  return digits.length === 11 && digits.startsWith('1')
}

interface SelfRegistrationFlowProps {
  ticketId: string
  assignmentId?: string | null
  eventSlug: string
  packageId: string
  ticketNumber: number | string
  userName: string
  userEmail: string
  userPhone?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function SelfRegistrationFlow({
  ticketId,
  assignmentId,
  eventSlug,
  packageId,
  ticketNumber,
  userName,
  userEmail,
  userPhone,
  open,
  onOpenChange,
  onSuccess,
}: SelfRegistrationFlowProps) {
  const queryClient = useQueryClient()
  const defaultPhone = userPhone?.trim() ? formatPhoneDisplay(userPhone) : ''
  const [phoneDraft, setPhoneDraft] = useState<string | null>(null)
  const [showPhoneError, setShowPhoneError] = useState(false)
  const [mealSelectionId, setMealSelectionId] = useState('')
  const [showMealError, setShowMealError] = useState(false)
  const [customResponses, setCustomResponses] = useState<
    Record<string, CustomResponseValue>
  >({})
  const [showCustomErrors, setShowCustomErrors] = useState(false)
  const phone = phoneDraft ?? defaultPhone

  const phoneIsValid = isValidPhoneDisplay(phone)

  const { data: eventDetail, isLoading: isLoadingEventDetail } = useQuery({
    queryKey: ['event', eventSlug],
    queryFn: () => getEventBySlug(eventSlug),
    enabled: open && Boolean(eventSlug),
  })

  const { data: ticketPackages, isLoading: isLoadingTicketPackages } = useQuery(
    {
      queryKey: ['public-ticket-packages', eventSlug],
      queryFn: () => getTicketPackages(eventSlug),
      enabled: open && Boolean(eventSlug),
    }
  )

  const { data: eventCustomOptions, isLoading: isLoadingEventOptions } =
    useQuery({
      queryKey: ['event-custom-options', eventSlug],
      queryFn: () => getEventCustomOptions(eventSlug),
      enabled: open && Boolean(eventSlug),
    })

  const selectedPackage = useMemo(
    () => ticketPackages?.find((pkg) => pkg.id === packageId) ?? null,
    [packageId, ticketPackages]
  )

  const foodOptions = eventDetail?.food_options ?? []
  const foodOptionNames = useMemo(
    () => new Set(foodOptions.map((option) => normalizeOptionText(option.name))),
    [foodOptions]
  )
  const requiresMealSelection = foodOptions.length > 0
  const mealSelectionIsValid =
    !requiresMealSelection || Boolean(mealSelectionId)
  const customOptions = useMemo(() => {
    const packageOptions = (selectedPackage?.custom_options ?? []).filter(
      (option) => !isDuplicateMealQuestion(option, foodOptionNames)
    )
    const universalOptions = eventCustomOptions ?? []
    return [...universalOptions, ...packageOptions]
  }, [foodOptionNames, selectedPackage?.custom_options, eventCustomOptions])
  const customOptionErrors = customOptions.reduce<Record<string, string>>(
    (errors, option) => {
      if (!option.is_required) {
        return errors
      }

      const value = customResponses[option.id]
      if (option.type === 'boolean') {
        if (value !== true) {
          errors[option.id] = 'This selection is required.'
        }
        return errors
      }

      if (option.type === 'multi_select') {
        if (!Array.isArray(value) || value.length === 0) {
          errors[option.id] = 'Choose at least one option.'
        }
        return errors
      }

      if (typeof value !== 'string' || value.trim().length === 0) {
        errors[option.id] = 'This response is required.'
      }

      return errors
    },
    {}
  )
  const customResponsesAreValid = Object.keys(customOptionErrors).length === 0
  const isLoadingRegistrationOptions =
    isLoadingEventDetail || isLoadingTicketPackages || isLoadingEventOptions

  const buildCustomResponsePayload = () => {
    return customOptions.reduce<Record<string, string>>((payload, option) => {
      const value = customResponses[option.id]

      if (option.type === 'boolean') {
        if (value === true) {
          payload[option.id] = 'true'
        }
        return payload
      }

      if (option.type === 'multi_select') {
        if (Array.isArray(value) && value.length > 0) {
          payload[option.id] = JSON.stringify(value)
        }
        return payload
      }

      if (typeof value === 'string' && value.trim().length > 0) {
        payload[option.id] = value.trim()
      }

      return payload
    }, {})
  }

  const updateMultiSelectOption = (
    optionId: string,
    choice: string,
    checked: boolean
  ) => {
    setCustomResponses((current) => {
      const previous = Array.isArray(current[optionId]) ? current[optionId] : []
      const nextValues = checked
        ? [...previous, choice]
        : previous.filter((value) => value !== choice)

      return {
        ...current,
        [optionId]: nextValues,
      }
    })
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const resolvedAssignmentId = assignmentId
        ? assignmentId
        : (await assignTicket(ticketId, userName, userEmail)).id

      await selfRegister(resolvedAssignmentId, {
        phone: phoneDisplayToE164(phone),
        meal_selection_id: mealSelectionId || undefined,
        custom_responses: buildCustomResponsePayload(),
      })
    },
    onSuccess: async () => {
      toast.success('Registered successfully!')

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ticket-inventory'] }),
        queryClient.invalidateQueries({
          queryKey: ['ticket-inventory', 'event-context'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['registrations', 'events-with-branding'],
        }),
      ])

      onOpenChange(false)
      onSuccess?.()
    },
    onError: () => {
      toast.error('Registration failed. Please try again.')
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex max-h-[calc(100vh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md'>
        <DialogHeader className='shrink-0 px-6 pt-6 pb-4'>
          <DialogTitle className='flex items-center gap-2'>
            <UserCheck className='h-5 w-5' />
            Register for Ticket #{ticketNumber}
          </DialogTitle>
          <DialogDescription>
            You are registering yourself as an attendee for this ticket.
          </DialogDescription>
        </DialogHeader>

        <div className='flex-1 overflow-y-auto px-6'>
          <div className='space-y-4 pt-2 pb-6'>
            <div className='rounded-lg border p-3'>
              <p className='text-sm font-medium'>{userName}</p>
              <p className='text-muted-foreground text-sm'>{userEmail}</p>
              <Badge variant='secondary' className='mt-1 text-xs'>
                Your account
              </Badge>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='phone'>Cell Number</Label>
              <Input
                id='phone'
                type='tel'
                placeholder='(555) 000-0000'
                value={phone}
                onChange={(e) => {
                  setPhoneDraft(formatPhoneDisplay(e.target.value))
                  if (showPhoneError) {
                    setShowPhoneError(false)
                  }
                }}
                onBlur={() => setShowPhoneError(!phoneIsValid)}
                aria-invalid={showPhoneError && !phoneIsValid}
                required
              />
              {showPhoneError && !phoneIsValid && (
                <p className='text-sm text-red-600'>
                  Enter a valid cell number.
                </p>
              )}
            </div>

            {isLoadingRegistrationOptions ? (
              <div className='text-muted-foreground rounded-lg border border-dashed p-3 text-sm'>
                Loading registration questions...
              </div>
            ) : (
              <>
                {foodOptions.length > 0 && (
                  <div className='space-y-2'>
                    <Label htmlFor='meal-selection'>Meal selection</Label>
                    <Select
                      value={mealSelectionId}
                      onValueChange={(value) => {
                        setMealSelectionId(value)
                        if (showMealError) {
                          setShowMealError(false)
                        }
                      }}
                    >
                      <SelectTrigger id='meal-selection'>
                        <SelectValue placeholder='Select a meal option' />
                      </SelectTrigger>
                      <SelectContent>
                        {foodOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.name}
                            {option.description ? ` - ${option.description}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {showMealError && !mealSelectionIsValid && (
                      <p className='text-sm text-red-600'>
                        Select a meal option to complete registration.
                      </p>
                    )}
                  </div>
                )}

                {customOptions.length > 0 && (
                  <div className='space-y-3'>
                    <div>
                      <p className='text-sm font-medium'>
                        Registration questions
                      </p>
                      <p className='text-muted-foreground text-sm'>
                        Answer the event questions attached to this ticket.
                      </p>
                    </div>

                    {customOptions.map((option: PublicTicketCustomOption) => {
                      const error = showCustomErrors
                        ? customOptionErrors[option.id]
                        : undefined

                      if (option.type === 'boolean') {
                        return (
                          <div
                            key={option.id}
                            className='space-y-2 rounded-lg border p-3'
                          >
                            <div className='flex items-start gap-3'>
                              <Checkbox
                                id={`custom-option-${option.id}`}
                                checked={customResponses[option.id] === true}
                                onCheckedChange={(checked) => {
                                  setCustomResponses((current) => ({
                                    ...current,
                                    [option.id]: checked === true,
                                  }))
                                }}
                              />
                              <Label
                                htmlFor={`custom-option-${option.id}`}
                                className='leading-5'
                              >
                                {option.label}
                                {option.is_required ? ' *' : ''}
                              </Label>
                            </div>
                            {error && (
                              <p className='text-sm text-red-600'>{error}</p>
                            )}
                          </div>
                        )
                      }

                      if (option.type === 'multi_select') {
                        const optionValue = customResponses[option.id]
                        const selectedChoices: string[] = Array.isArray(
                          optionValue
                        )
                          ? optionValue
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
                                    checked={selectedChoices.includes(choice)}
                                    onCheckedChange={(checked) => {
                                      updateMultiSelectOption(
                                        option.id,
                                        choice,
                                        checked === true
                                      )
                                    }}
                                  />
                                  <span>{choice}</span>
                                </label>
                              ))}
                            </div>
                            {error && (
                              <p className='text-sm text-red-600'>{error}</p>
                            )}
                          </div>
                        )
                      }

                      return (
                        <div
                          key={option.id}
                          className='space-y-2 rounded-lg border p-3'
                        >
                          {(() => {
                            const optionValue = customResponses[option.id]
                            const textValue =
                              typeof optionValue === 'string' ? optionValue : ''

                            return (
                              <>
                                <Label htmlFor={`custom-option-${option.id}`}>
                                  {option.label}
                                  {option.is_required ? ' *' : ''}
                                </Label>
                                <Textarea
                                  id={`custom-option-${option.id}`}
                                  value={textValue}
                                  onChange={(event) => {
                                    const value = event.target.value
                                    setCustomResponses((current) => ({
                                      ...current,
                                      [option.id]: value,
                                    }))
                                  }}
                                  placeholder='Enter your response'
                                />
                                {error && (
                                  <p className='text-sm text-red-600'>{error}</p>
                                )}
                              </>
                            )
                          })()}
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <DialogFooter className='shrink-0 border-t px-6 py-4'>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!phoneIsValid) {
                setShowPhoneError(true)
              }

              if (!mealSelectionIsValid) {
                setShowMealError(true)
              }

              if (!customResponsesAreValid) {
                setShowCustomErrors(true)
              }

              if (
                !phoneIsValid ||
                !mealSelectionIsValid ||
                !customResponsesAreValid
              ) {
                return
              }

              mutation.mutate()
            }}
            disabled={mutation.isPending || isLoadingRegistrationOptions}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Registering…
              </>
            ) : (
              'Register Myself'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
