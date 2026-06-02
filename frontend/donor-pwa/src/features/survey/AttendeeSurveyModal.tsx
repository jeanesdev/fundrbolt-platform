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

interface AttendeeSurveyModalProps {
  open: boolean
  survey: DonorSurveyConfig
  isSubmitting?: boolean
  onSkip: () => void
  onComplete: (
    answers: Array<{ question_id: string; option_id: string }>
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
  const [answers, setAnswers] = useState<Record<string, string>>({})

  const questionCount = survey.questions.length
  const completedCount = useMemo(
    () => Object.values(answers).filter(Boolean).length,
    [answers]
  )
  const canSubmit = questionCount > 0 && completedCount === questionCount

  return (
    <Dialog open={open}>
      <DialogContent className='flex h-[100dvh] w-screen max-w-none flex-col gap-0 rounded-none border-0 p-0 sm:h-[100dvh] sm:max-w-none'>
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
            {survey.questions
              .slice()
              .sort((a, b) => a.display_order - b.display_order)
              .map((question, index) => (
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
                        const selected = answers[question.id] === option.id
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
                </section>
              ))}
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
                    survey.questions.map((question) => ({
                      question_id: question.id,
                      option_id: answers[question.id],
                    }))
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
