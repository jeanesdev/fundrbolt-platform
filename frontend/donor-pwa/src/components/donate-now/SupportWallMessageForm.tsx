import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { useDonateNow } from '@/features/donate-now/useDonateNow'

interface SupportWallMessageFormProps {
  state: ReturnType<typeof useDonateNow>
}

export function SupportWallMessageForm({ state }: SupportWallMessageFormProps) {
  const { isAnonymous, setIsAnonymous, showAmount, setShowAmount, wallMessage, setWallMessage } = state

  return (
    <section
      className='space-y-4 rounded-xl border p-4'
      style={{
        borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.22)',
        backgroundColor: 'rgb(var(--event-background, 255, 255, 255))',
      }}
    >
      <h2 className='text-lg font-semibold'>Support Wall</h2>
      <p
        className='text-sm'
        style={{ color: 'var(--event-text-muted-on-background, #4B5563)' }}
      >
        Leave an optional message on our public support wall.
      </p>

      <Textarea
        value={wallMessage}
        onChange={(e) => setWallMessage(e.target.value)}
        placeholder='Optional message for the support wall...'
        rows={3}
        maxLength={200}
        className='placeholder:text-[var(--event-text-muted-on-background,#6B7280)]'
        style={{
          borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.28)',
          backgroundColor: 'rgb(var(--event-background, 255, 255, 255))',
          color: 'var(--event-text-on-background, #000000)',
        }}
      />

      <div className='flex flex-col gap-2'>
        <div className='flex items-center gap-2'>
          <Checkbox
            id='anonymous'
            checked={isAnonymous}
            onCheckedChange={(v) => setIsAnonymous(!!v)}
          />
          <Label htmlFor='anonymous'>Donate anonymously</Label>
        </div>
        <div className='flex items-center gap-2'>
          <Checkbox
            id='show-amount'
            checked={showAmount}
            onCheckedChange={(v) => setShowAmount(!!v)}
          />
          <Label htmlFor='show-amount'>Show donation amount on wall</Label>
        </div>
      </div>
    </section>
  )
}
