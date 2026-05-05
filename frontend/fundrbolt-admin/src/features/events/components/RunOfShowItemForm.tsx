/**
 * RunOfShowItemForm — Inline form for adding a new run-of-show item.
 * Time is entered as time-only; the date portion comes from the event date.
 */
import { useState } from 'react'
import type { RunOfShowItemCreate } from '@/types/run-of-show'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface RunOfShowItemFormProps {
  onSubmit: (data: RunOfShowItemCreate) => void
  onCancel: () => void
  /** ISO datetime of the event start — used as the date when saving */
  eventDate?: string
}

/** Get a YYYY-MM-DD date string from an ISO datetime or fall back to today */
function getDateStr(iso?: string): string {
  const src = iso ?? new Date().toISOString()
  try {
    const d = new Date(src)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

/** Get a sensible default time string (nearest future half-hour) as HH:mm */
function getDefaultTime(): string {
  const now = new Date()
  now.setMinutes(Math.ceil(now.getMinutes() / 30) * 30, 0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`
}

/** Combine YYYY-MM-DD + HH:mm → ISO UTC string */
function combineDateTimeToIso(dateStr: string, timeStr: string): string {
  return new Date(`${dateStr}T${timeStr}`).toISOString()
}

export function RunOfShowItemForm({
  onSubmit,
  onCancel,
  eventDate,
}: RunOfShowItemFormProps) {
  const [title, setTitle] = useState('')
  const [timeValue, setTimeValue] = useState(getDefaultTime())
  const [donorVisible, setDonorVisible] = useState(false)
  const [auctioneerVisible, setAuctioneerVisible] = useState(true)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed || !timeValue) return
    const dateStr = getDateStr(eventDate)
    onSubmit({
      title: trimmed,
      scheduled_time: combineDateTimeToIso(dateStr, timeValue),
      donor_visible: donorVisible,
      auctioneer_visible: auctioneerVisible,
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className='space-y-3 rounded-lg border border-dashed p-3'
    >
      <div className='flex items-center gap-2'>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder='Item title...'
          maxLength={200}
          className='h-8 flex-1 text-sm'
          autoFocus
          required
        />
        <Input
          type='time'
          value={timeValue}
          onChange={(e) => setTimeValue(e.target.value)}
          className='h-8 w-28 text-sm'
          required
        />
      </div>
      <div className='flex items-center gap-4 text-sm'>
        <label className='flex cursor-pointer items-center gap-1.5'>
          <input
            type='checkbox'
            checked={donorVisible}
            onChange={(e) => setDonorVisible(e.target.checked)}
            className='rounded'
          />
          <Label className='cursor-pointer text-xs'>Donor visible</Label>
        </label>
        <label className='flex cursor-pointer items-center gap-1.5'>
          <input
            type='checkbox'
            checked={auctioneerVisible}
            onChange={(e) => setAuctioneerVisible(e.target.checked)}
            className='rounded'
          />
          <Label className='cursor-pointer text-xs'>Auctioneer visible</Label>
        </label>
        <div className='ml-auto flex gap-2'>
          <Button type='submit' size='sm' variant='outline' className='h-8'>
            <Plus className='mr-1 h-3 w-3' />
            Add
          </Button>
          <Button
            type='button'
            size='sm'
            variant='ghost'
            className='h-8'
            onClick={onCancel}
          >
            <X className='h-3 w-3' />
          </Button>
        </div>
      </div>
    </form>
  )
}
