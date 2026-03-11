/**
 * SignUpWizard — reusable multi-step wizard container.
 *
 * Renders a progress bar showing named steps and slots in the current
 * step component. Each step is responsible for its own content and
 * for calling `onNext` / `onBack` to advance or retreat.
 */
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'

export interface WizardStep {
  /** Machine-readable step identifier. */
  id: string
  /** Human-readable label shown in the progress indicator. */
  label: string
}

interface SignUpWizardProps {
  /** Ordered list of steps to display in the progress bar. */
  steps: WizardStep[]
  /** Index of the currently active step (0-based). */
  currentStepIndex: number
  /** Optional heading above the progress bar, e.g. "Revision Mode". */
  headingBadge?: React.ReactNode
  /** The active step component to render. */
  children: React.ReactNode
  /** Optional extra class names for the outer wrapper. */
  className?: string
}

/**
 * Multi-step wizard container with a segmented progress bar.
 *
 * The progress bar is divided into equal-width segments, one per step.
 * Completed steps are filled; the active step is partially filled;
 * future steps are grey.
 */
export function SignUpWizard({
  steps,
  currentStepIndex,
  headingBadge,
  children,
  className,
}: SignUpWizardProps) {
  const progressPercent = ((currentStepIndex + 1) / steps.length) * 100

  return (
    <div className={cn('flex w-full flex-col gap-6', className)}>
      {/* ---- Progress bar ---- */}
      <div className='space-y-2'>
        {headingBadge && (
          <div className='flex justify-center'>{headingBadge}</div>
        )}

        {/* Segmented step indicator */}
        <div
          className='flex w-full items-center gap-1'
          role='progressbar'
          aria-valuenow={currentStepIndex + 1}
          aria-valuemin={1}
          aria-valuemax={steps.length}
        >
          {steps.map((step, idx) => (
            <div
              key={step.id}
              className='flex flex-1 flex-col items-center gap-1'
            >
              <div
                className={cn(
                  'h-2 w-full rounded-full transition-colors',
                  idx < currentStepIndex
                    ? 'bg-primary' // completed
                    : idx === currentStepIndex
                      ? 'bg-primary/60' // active
                      : 'bg-muted' // future
                )}
              />
              <span
                className={cn(
                  'text-xs',
                  idx <= currentStepIndex
                    ? 'text-foreground font-medium'
                    : 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>

        {/* Numeric progress for screen readers */}
        <Progress value={progressPercent} className='sr-only' />
      </div>

      {/* ---- Active step content ---- */}
      <div>{children}</div>
    </div>
  )
}
