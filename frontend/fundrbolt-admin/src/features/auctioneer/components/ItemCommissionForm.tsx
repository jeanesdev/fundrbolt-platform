import { useMemo, useState } from 'react'
import type { CommissionListItem } from '@/services/auctioneerService'
import { DollarSign, Percent, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  useDeleteCommission,
  useUpsertCommission,
} from '../hooks/useAuctioneerData'

interface ItemCommissionFormProps {
  eventId: string
  auctionItemId: string
  existing?: CommissionListItem | null
}

export function ItemCommissionForm({
  eventId,
  auctionItemId,
  existing,
}: ItemCommissionFormProps) {
  // Derive a stable key so React remounts the form when existing data changes
  const formKey = useMemo(
    () => existing?.auction_item_id ?? 'new',
    [existing?.auction_item_id]
  )

  return (
    <ItemCommissionFormInner
      key={formKey}
      eventId={eventId}
      auctionItemId={auctionItemId}
      existing={existing}
    />
  )
}

function ItemCommissionFormInner({
  eventId,
  auctionItemId,
  existing,
}: ItemCommissionFormProps) {
  const [commissionPercent, setCommissionPercent] = useState(
    existing?.commission_percent?.toString() ?? ''
  )
  const [flatFee, setFlatFee] = useState(existing?.flat_fee?.toString() ?? '0')
  const [notes, setNotes] = useState(existing?.notes ?? '')

  const upsertMutation = useUpsertCommission(eventId)
  const deleteMutation = useDeleteCommission(eventId)

  const handleSave = () => {
    const percent = parseFloat(commissionPercent)
    const fee = parseFloat(flatFee)

    if (isNaN(percent) || percent < 0 || percent > 100) return
    if (isNaN(fee) || fee < 0) return

    upsertMutation.mutate({
      auctionItemId,
      data: {
        commission_percent: percent,
        flat_fee: fee,
        notes: notes || undefined,
      },
    })
  }

  const handleDelete = () => {
    deleteMutation.mutate(auctionItemId)
  }

  const isSaving = upsertMutation.isPending
  const isDeleting = deleteMutation.isPending

  return (
    <Card>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2 text-base'>
          <Percent className='h-4 w-4' />
          Commission & Fee
        </CardTitle>
        <CardDescription>
          Track your commission for this auction item
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='grid grid-cols-2 gap-4'>
          <div className='space-y-2'>
            <Label htmlFor='commission-percent'>Commission %</Label>
            <div className='relative'>
              <Input
                id='commission-percent'
                type='number'
                min='0'
                max='100'
                step='0.01'
                placeholder='e.g. 10'
                value={commissionPercent}
                onChange={(e) => setCommissionPercent(e.target.value)}
                className='pr-8'
              />
              <Percent className='text-muted-foreground absolute top-3 right-2 h-3 w-3' />
            </div>
          </div>
          <div className='space-y-2'>
            <Label htmlFor='flat-fee'>Flat Fee</Label>
            <div className='relative'>
              <DollarSign className='text-muted-foreground absolute top-3 left-2 h-3 w-3' />
              <Input
                id='flat-fee'
                type='number'
                min='0'
                step='0.01'
                placeholder='0.00'
                value={flatFee}
                onChange={(e) => setFlatFee(e.target.value)}
                className='pl-7'
              />
            </div>
          </div>
        </div>
        <div className='space-y-2'>
          <Label htmlFor='notes'>Notes</Label>
          <Textarea
            id='notes'
            placeholder='Optional notes...'
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={2000}
            rows={2}
          />
        </div>
        <div className='flex gap-2'>
          <Button
            onClick={handleSave}
            disabled={isSaving || !commissionPercent}
            size='sm'
          >
            <Save className='mr-1 h-3 w-3' />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
          {existing && (
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
              variant='destructive'
              size='sm'
            >
              <Trash2 className='mr-1 h-3 w-3' />
              {isDeleting ? 'Removing...' : 'Remove'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
