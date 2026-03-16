/**
 * RecipientSelector (T055) — radio buttons for recipient targeting
 */
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

export type RecipientType =
  | 'all_attendees'
  | 'all_bidders'
  | 'specific_table'
  | 'individual'

interface RecipientSelectorProps {
  value: RecipientType
  onChange: (value: RecipientType) => void
  tableNumber: string
  onTableNumberChange: (value: string) => void
  userIds: string
  onUserIdsChange: (value: string) => void
}

export function RecipientSelector({
  value,
  onChange,
  tableNumber,
  onTableNumberChange,
  userIds,
  onUserIdsChange,
}: RecipientSelectorProps) {
  return (
    <div className='space-y-3'>
      <Label className='text-sm font-medium'>Recipients</Label>
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as RecipientType)}
        className='space-y-2'
      >
        <div className='flex items-center space-x-2'>
          <RadioGroupItem value='all_attendees' id='all_attendees' />
          <Label htmlFor='all_attendees' className='cursor-pointer text-sm'>
            All Attendees
          </Label>
        </div>
        <div className='flex items-center space-x-2'>
          <RadioGroupItem value='all_bidders' id='all_bidders' />
          <Label htmlFor='all_bidders' className='cursor-pointer text-sm'>
            All Bidders
          </Label>
        </div>
        <div className='flex items-center space-x-2'>
          <RadioGroupItem value='specific_table' id='specific_table' />
          <Label htmlFor='specific_table' className='cursor-pointer text-sm'>
            Specific Table
          </Label>
        </div>
        <div className='flex items-center space-x-2'>
          <RadioGroupItem value='individual' id='individual' />
          <Label htmlFor='individual' className='cursor-pointer text-sm'>
            Individual Donors
          </Label>
        </div>
      </RadioGroup>

      {value === 'specific_table' && (
        <Input
          type='number'
          placeholder='Table number'
          value={tableNumber}
          onChange={(e) => onTableNumberChange(e.target.value)}
          className='mt-2 w-32'
          min={1}
        />
      )}

      {value === 'individual' && (
        <Input
          placeholder='User IDs (comma-separated)'
          value={userIds}
          onChange={(e) => onUserIdsChange(e.target.value)}
          className='mt-2'
        />
      )}
    </div>
  )
}
