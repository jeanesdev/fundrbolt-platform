import { Switch } from '@/components/ui/switch'
import type { useDonateNow } from '@/features/donate-now/useDonateNow'

interface MonthlyRecurrenceFieldsProps {
  state: ReturnType<typeof useDonateNow>
}

export function MonthlyRecurrenceFields({
  state,
}: MonthlyRecurrenceFieldsProps) {
  const { isMonthly, setIsMonthly } = state

  return (
    <div
      className='flex items-center justify-between rounded-lg border p-4'
      style={{
        borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.22)',
        backgroundColor: 'rgb(var(--event-background, 255, 255, 255))',
      }}
    >
      <div>
        <p className='font-medium'>Make this a monthly donation</p>
        <p
          className='text-sm'
          style={{ color: 'var(--event-text-muted-on-background, #4B5563)' }}
        >
          Your card will be charged automatically each month until you cancel.
        </p>
      </div>
      <Switch checked={isMonthly} onCheckedChange={setIsMonthly} />
    </div>
  )
}
