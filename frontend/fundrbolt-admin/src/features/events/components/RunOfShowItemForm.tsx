/**
 * RunOfShowItemForm — Inline form for adding a new run-of-show item.
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
}

/** Convert a local datetime-local input string to ISO 8601 */
function localDatetimeToIso(value: string): string {
  if (!value) return ''
  // datetime-local value is like "2025-01-15T14:30"
  return new Date(value).toISOString()
}

/** Convert an ISO datetime string to datetime-local input format "YYYY-MM-DDTHH:MM" */
function isoToLocalDatetime(iso: string): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return ''
  }
}

/** Get a sensible default datetime (nearest future half-hour) */
function getDefaultDatetime(): string {
  const now = new Date()
  now.setMinutes(Math.ceil(now.getMinutes() / 30) * 30, 0, 0)
  return isoToLocalDatetime(now.toISOString())
}

export function RunOfShowItemForm({
  onSubmit,
  onCancel,
}: RunOfShowItemFormProps) {
  const [title, setTitle] = useState('')
  const [scheduledTime, setScheduledTime] = useState(getDefaultDatetime())
  const [donorVisible, setDonorVisible] = useState(false)
  const [auctioneerVisible, setAuctioneerVisible] = useState(true)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed || !scheduledTime) return
    onSubmit({
      title: trimmed,
      scheduled_time: localDatetimeToIso(scheduledTime),
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
          type='datetime-local'
          value={scheduledTime}
          onChange={(e) => setScheduledTime(e.target.value)}
          className='h-8 w-48 text-sm'
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
