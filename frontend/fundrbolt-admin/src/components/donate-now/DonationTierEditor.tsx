import { donateNowAdminApi, type DonationTierInput, type DonationTierResponse } from '@/api/donateNow'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { GripVertical, Loader2, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface DonationTierEditorProps {
  npoId: string
  tiers: DonationTierResponse[]
}

interface TierDraft {
  id?: string
  amount_cents: number
  impact_statement: string
  display_order: number
}

export function DonationTierEditor({ npoId, tiers }: DonationTierEditorProps) {
  const queryClient = useQueryClient()
  const [drafts, setDrafts] = useState<TierDraft[]>(
    tiers.map((t, i) => ({
      id: t.id,
      amount_cents: t.amount_cents,
      impact_statement: t.impact_statement ?? '',
      display_order: t.display_order ?? i,
    }))
  )

  const saveMutation = useMutation({
    mutationFn: (tierInputs: DonationTierInput[]) =>
      donateNowAdminApi.updateTiers(npoId, tierInputs).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.setQueryData(['donate-now-config', npoId], (old: unknown) => {
        if (old && typeof old === 'object') return { ...(old as object), tiers: data }
        return old
      })
      setDrafts(data.map((t, index) => ({ id: t.id, amount_cents: t.amount_cents, impact_statement: t.impact_statement ?? '', display_order: t.display_order ?? index })))
      toast.success('Donation tiers saved')
    },
    onError: () => toast.error('Failed to save tiers'),
  })

  const addTier = () => {
    if (drafts.length >= 10) {
      toast.error('Maximum 10 donation tiers allowed')
      return
    }
    setDrafts((prev) => [...prev, { amount_cents: 1000, impact_statement: '', display_order: prev.length }])
  }

  const removeTier = (index: number) => {
    setDrafts((prev) => prev.filter((_, i) => i !== index).map((t, i) => ({ ...t, display_order: i })))
  }

  const updateTier = (index: number, field: keyof TierDraft, value: string | number) => {
    setDrafts((prev) => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)))
  }

  const handleSave = () => {
    const inputs: DonationTierInput[] = drafts.map((d, i) => ({
      amount_cents: d.amount_cents,
      impact_statement: d.impact_statement || undefined,
      display_order: i,
    }))
    saveMutation.mutate(inputs)
  }

  return (
    <div className='space-y-4'>
      {drafts.length === 0 && (
        <p className='text-sm text-muted-foreground'>No donation tiers yet. Add up to 10.</p>
      )}

      {drafts.map((tier, index) => (
        <div key={index} className='flex items-start gap-3 rounded-lg border p-3'>
          <GripVertical className='mt-3 h-4 w-4 shrink-0 text-muted-foreground' />
          <div className='flex flex-1 flex-col gap-2 sm:flex-row'>
            <div className='space-y-1'>
              <Label className='text-xs'>Amount ($)</Label>
              <Input
                type='number'
                min='1'
                value={(tier.amount_cents / 100).toFixed(0)}
                onChange={(e) => updateTier(index, 'amount_cents', Math.round(parseFloat(e.target.value) * 100) || 100)}
                className='w-28'
              />
            </div>
            <div className='flex-1 space-y-1'>
              <Label className='text-xs'>Impact Statement</Label>
              <Input
                value={tier.impact_statement}
                onChange={(e) => updateTier(index, 'impact_statement', e.target.value)}
                placeholder='Feeds 5 families for a week'
                maxLength={200}
              />
            </div>
          </div>
          <Button
            variant='ghost'
            size='icon'
            className='mt-1 text-destructive hover:text-destructive'
            onClick={() => removeTier(index)}
          >
            <Trash2 className='h-4 w-4' />
          </Button>
        </div>
      ))}

      <div className='flex gap-2'>
        <Button variant='outline' onClick={addTier} disabled={drafts.length >= 10}>
          <Plus className='mr-2 h-4 w-4' />
          Add Tier
        </Button>
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
          Save Tiers
        </Button>
      </div>
    </div>
  )
}
