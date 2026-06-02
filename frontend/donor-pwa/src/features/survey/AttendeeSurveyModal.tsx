import { useMemo, useState } from 'react'
import { Gift, Loader2, Sparkles } from 'lucide-react'
import type { DonorSurveyConfig } from '@/lib/api/survey'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

interface AttendeeSurveyModalProps {
  open: boolean
  survey: DonorSurveyConfig
  isSubmitting?: boolean
  onSkip: () => void
  onComplete: (
    answers: Array<{
      question_id: string
      option_id: string
      other_text?: string | null
    }>
  ) => void
}

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)

export function AttendeeSurveyModal({
  open,
  survey,
  isSubmitting = false,
  onSkip,
  onComplete,
}: AttendeeSurveyModalProps) {
  // Maps question_id → selected option_id
  const [answers, setAnswers] = useState<Record<string, string>>({})
  // Maps question_id → typed "other" text (only used when is_other option selected)
  const [otherTexts, setOtherTexts] = useState<Record<string, string>>({})

  // Only active questions count — inactive ones are already filtered by the
  // backend (donor_only=True) but this guard makes the component robust.
  const activeQuestions = useMemo(
    () => survey.questions.filter((q) => q.is_active),
    [survey.questions]
  )
  const questionCount = activeQuestions.length

  const completedCount = useMemo(() => {
    return activeQuestions.filter((question) => {
      const selectedOptionId = answers[question.id]
      if (!selectedOptionId) return false
      const selectedOption = question.options.find(
        (o) => o.id === selectedOptionId
      )
      // "Other" option requires non-empty typed text to count as complete
      if (selectedOption?.is_other) {
        return (otherTexts[question.id] ?? '').trim().length > 0
      }
      return true
    }).length
  }, [activeQuestions, answers, otherTexts])

  const canSubmit = questionCount > 0 && completedCount === questionCount

  return (
    <Dialog open={open}>
      <DialogContent
        className='flex h-[100dvh] w-screen max-w-none flex-col gap-0 rounded-none border-0 p-0 sm:h-[100dvh] sm:max-w-none'
        // Prevent accidental dismissal via Escape or outside-click.
        // The only intentional exit paths are "Skip for now" and "Submit survey".
        // A non-intentional close would not record a SurveyResponse row, which is
        // correct per spec: partial/unsaved state → modal reappears on next visit.
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className='border-b px-5 py-4 text-left sm:px-8'>
          <div className='mb-3 flex items-center gap-2 text-sm font-medium text-amber-600'>
            <Gift className='h-4 w-4' />
            Complete this survey to earn {formatCurrency(
              survey.discount_cents
            )}{' '}
            off checkout
          </div>
          <DialogTitle className='text-2xl sm:text-3xl'>
            {survey.modal_prompt_title}
          </DialogTitle>
          <DialogDescription className='max-w-2xl text-base'>
            {survey.modal_prompt_body}
          </DialogDescription>
        </DialogHeader>

        <div className='flex-1 overflow-y-auto px-5 py-5 sm:px-8'>
          <div className='mx-auto max-w-4xl space-y-6'>
            {activeQuestions
              .slice()
              .sort((a, b) => a.display_order - b.display_order)
              .map((question, index) => {
                const selectedOptionId = answers[question.id]
                const selectedOption = question.options.find(
                  (o) => o.id === selectedOptionId
                )
                return (
                  <section
                    key={question.id}
                    className='space-y-3 rounded-2xl border p-4 sm:p-6'
                  >
                    <div className='text-muted-foreground flex items-center gap-2 text-xs font-semibold tracking-wide uppercase'>
                      <Sparkles className='h-3.5 w-3.5' />
                      Question {index + 1}
                    </div>
                    <h3 className='text-lg font-semibold'>{question.text}</h3>
                    <div className='grid gap-3 sm:grid-cols-2'>
                      {question.options
                        .slice()
                        .sort((a, b) => a.display_order - b.display_order)
                        .map((option) => {
                          const selected = selectedOptionId === option.id
                          return (
                            <button
                              key={option.id}
                              type='button'
                              className={cn(
                                'rounded-xl border px-4 py-3 text-left text-sm transition-colors',
                                selected
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-border hover:bg-muted/60'
                              )}
                              onClick={() =>
                                setAnswers((prev) => ({
                                  ...prev,
                                  [question.id]: option.id,
                                }))
                              }
                            >
                              {option.text}
                            </button>
                          )
                        })}
                    </div>
                    {selectedOption?.is_other && (
                      <Textarea
                        autoFocus
                        placeholder='Please describe your answer…'
                        maxLength={500}
                        rows={3}
                        value={otherTexts[question.id] ?? ''}
                        onChange={(e) =>
                          setOtherTexts((prev) => ({
                            ...prev,
                            [question.id]: e.target.value,
                          }))
                        }
                        className='mt-2'
                      />
                    )}
                  </section>
                )
              })}
          </div>
        </div>

        <div className='bg-background border-t px-5 py-4 sm:px-8'>
          <div className='mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <p className='text-muted-foreground text-sm'>
              {completedCount} of {questionCount} answered
            </p>
            <div className='flex gap-2'>
              <Button
                variant='outline'
                onClick={onSkip}
                disabled={isSubmitting}
              >
                Skip for now
              </Button>
              <Button
                onClick={() =>
                  onComplete(
                    activeQuestions.map((question) => {
                      const optionId = answers[question.id]
                      const selectedOption = question.options.find(
                        (o) => o.id === optionId
                      )
                      return {
                        question_id: question.id,
                        option_id: optionId,
                        other_text: selectedOption?.is_other
                          ? (otherTexts[question.id] ?? '').trim() || null
                          : null,
                      }
                    })
                  )
                }
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                ) : null}
                Submit survey
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
