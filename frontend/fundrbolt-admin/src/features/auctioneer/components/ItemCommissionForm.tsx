import { useMemo, useState } from 'react'
import type { CommissionListItem } from '@/services/auctioneerService'
import { Gavel, Percent, Save, Trash2 } from 'lucide-react'
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
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import {
  useDeleteCommission,
  useUpsertCommission,
} from '../hooks/useAuctioneerData'

interface ItemCommissionFormProps {
  eventId: string
  auctionItemId: string
  existing?: CommissionListItem | null
  consignmentCost?: number | null
}

export function ItemCommissionForm({
  eventId,
  auctionItemId,
  existing,
  consignmentCost,
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
      consignmentCost={consignmentCost}
    />
  )
}

function ItemCommissionFormInner({
  eventId,
  auctionItemId,
  existing,
  consignmentCost,
}: ItemCommissionFormProps) {
  const [commissionPercent, setCommissionPercent] = useState(
    existing?.commission_percent?.toString() ?? ''
  )
  const [notes, setNotes] = useState(existing?.notes ?? '')

  const upsertMutation = useUpsertCommission(eventId)
  const deleteMutation = useDeleteCommission(eventId)

  const handleSave = () => {
    const percent = parseFloat(commissionPercent)
    if (isNaN(percent) || percent < 0 || percent > 100) return

    upsertMutation.mutate({
      auctionItemId,
      data: {
        commission_percent: percent,
        flat_fee: 0,
        notes: notes || undefined,
      },
    })
  }

  const commissionAmount =
    consignmentCost != null && commissionPercent !== ''
      ? (consignmentCost * parseFloat(commissionPercent)) / 100
      : null

  const handleDelete = () => {
    deleteMutation.mutate(auctionItemId)
  }

  const isSaving = upsertMutation.isPending
  const isDeleting = deleteMutation.isPending

  return (
    <Card>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2 text-base'>
          <Gavel className='h-4 w-4' />
          Auctioneer Setup
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
          {commissionAmount != null && (
            <div className='space-y-2'>
              <Label>Est. Commission</Label>
              <p className='flex h-10 items-center font-semibold text-green-600 dark:text-green-400'>
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                }).format(commissionAmount)}
              </p>
            </div>
          )}
        </div>
        <div className='space-y-2'>
          <Label>Notes</Label>
          <RichTextEditor
            value={notes}
            onChange={setNotes}
            placeholder='Optional notes...'
            disabled={isSaving}
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
