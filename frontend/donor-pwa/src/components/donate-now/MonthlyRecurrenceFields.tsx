import { Switch } from '@/components/ui/switch'
import type { useDonateNow } from '@/features/donate-now/useDonateNow'

interface MonthlyRecurrenceFieldsProps {
  state: ReturnType<typeof useDonateNow>
}

export function MonthlyRecurrenceFields({ state }: MonthlyRecurrenceFieldsProps) {
  const { isMonthly, setIsMonthly } = state

  return (
    <div className='flex items-center justify-between rounded-lg border p-4'>
      <div>
        <p className='font-medium'>Make this a monthly donation</p>
        <p className='text-sm text-muted-foreground'>
          Your card will be charged automatically each month until you cancel.
        </p>
      </div>
      <Switch checked={isMonthly} onCheckedChange={setIsMonthly} />
    </div>
  )
}
