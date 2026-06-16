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
  onClose?: () => void
  onSkip: () => void
  onComplete: (
    answers: Array<{
      question_id: string
      option_ids: string[]
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
  onClose = () => {},
  onSkip,
  onComplete,
}: AttendeeSurveyModalProps) {
  // Maps question_id → selected option_id(s)
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
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
      const selectedIds = answers[question.id] ?? []
      if (selectedIds.length === 0) return false
      const hasOtherSelected = selectedIds.some(
        (id) => question.options.find((o) => o.id === id)?.is_other
      )
      if (hasOtherSelected) {
        return (otherTexts[question.id] ?? '').trim().length > 0
      }
      return true
    }).length
  }, [activeQuestions, answers, otherTexts])

  const canSubmit = questionCount > 0 && completedCount === questionCount

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose()
      }}
    >
      <DialogContent
        className='flex h-[100dvh] w-screen max-w-none flex-col gap-0 rounded-none border-0 p-0 sm:h-[100dvh] sm:max-w-none'
        // Prevent dismissal via outside-click or Escape key; only the explicit
        // Skip/Submit/X actions should close the modal so responses are recorded.
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className='border-b px-5 py-4 text-left sm:px-8'>
          {survey.discount_cents > 0 && (
            <div className='mb-3 flex items-center gap-2 text-sm font-medium text-amber-600'>
              <Gift className='h-4 w-4' />
              Complete this survey to earn{' '}
              {formatCurrency(survey.discount_cents)} off checkout
            </div>
          )}
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
                const selectedIds: string[] = answers[question.id] ?? []
                const hasOtherSelected = selectedIds.some(
                  (id) => question.options.find((o) => o.id === id)?.is_other
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
                    {question.allow_multiple && (
                      <p className='text-muted-foreground text-xs'>
                        Select all that apply
                      </p>
                    )}
                    <div className='grid gap-3 sm:grid-cols-2'>
                      {question.options
                        .slice()
                        .sort((a, b) => a.display_order - b.display_order)
                        .map((option) => {
                          const selected = selectedIds.includes(option.id)
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
                                setAnswers((prev) => {
                                  const current = prev[question.id] ?? []
                                  let next: string[]
                                  if (question.allow_multiple) {
                                    next = current.includes(option.id)
                                      ? current.filter((id) => id !== option.id)
                                      : [...current, option.id]
                                  } else {
                                    next = [option.id]
                                  }
                                  return { ...prev, [question.id]: next }
                                })
                              }
                            >
                              {option.text}
                            </button>
                          )
                        })}
                    </div>
                    {hasOtherSelected && (
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
                      const selectedIds = answers[question.id] ?? []
                      const hasOtherSelected = selectedIds.some(
                        (id) =>
                          question.options.find((o) => o.id === id)?.is_other
                      )
                      return {
                        question_id: question.id,
                        option_ids: selectedIds,
                        other_text: hasOtherSelected
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
