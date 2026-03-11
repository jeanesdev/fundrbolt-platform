/**
 * SeatingConfigSection Component
 * UI component for configuring event seating (table count and max guests per table)
 */
import { useState } from 'react'
import { Armchair, Info, Users } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface SeatingConfig {
  table_count?: number | null
  max_guests_per_table?: number | null
}

interface SeatingConfigSectionProps {
  initialConfig?: SeatingConfig
  onConfigChange?: (config: SeatingConfig) => void
  disabled?: boolean
}

export function SeatingConfigSection({
  initialConfig,
  onConfigChange,
  disabled = false,
}: SeatingConfigSectionProps) {
  const [tableCount, setTableCount] = useState<string>(
    initialConfig?.table_count?.toString() || ''
  )
  const [maxGuestsPerTable, setMaxGuestsPerTable] = useState<string>(
    initialConfig?.max_guests_per_table?.toString() || ''
  )
  const [confirmClearOpen, setConfirmClearOpen] = useState(false)

  const handleTableCountChange = (value: string) => {
    setTableCount(value)
    const numValue = value === '' ? null : parseInt(value, 10)
    const maxGuests =
      maxGuestsPerTable === '' ? null : parseInt(maxGuestsPerTable, 10)

    if (onConfigChange) {
      onConfigChange({
        table_count: numValue,
        max_guests_per_table: maxGuests,
      })
    }
  }

  const handleMaxGuestsChange = (value: string) => {
    setMaxGuestsPerTable(value)
    const numValue = value === '' ? null : parseInt(value, 10)
    const tables = tableCount === '' ? null : parseInt(tableCount, 10)

    if (onConfigChange) {
      onConfigChange({
        table_count: tables,
        max_guests_per_table: numValue,
      })
    }
  }

  const handleClear = () => {
    setTableCount('')
    setMaxGuestsPerTable('')
    if (onConfigChange) {
      onConfigChange({
        table_count: null,
        max_guests_per_table: null,
      })
    }
    toast.success('Seating configuration cleared')
  }

  const totalCapacity =
    tableCount && maxGuestsPerTable
      ? parseInt(tableCount, 10) * parseInt(maxGuestsPerTable, 10)
      : 0

  const hasPartialConfig =
    (tableCount !== '' && maxGuestsPerTable === '') ||
    (tableCount === '' && maxGuestsPerTable !== '')

  return (
    <div className='bg-muted/30 space-y-4 rounded-lg border p-4'>
      <div className='flex items-center gap-2'>
        <Armchair className='text-muted-foreground h-5 w-5' />
        <h3 className='text-lg font-semibold'>Seating Configuration</h3>
      </div>

      <div className='text-muted-foreground flex items-start gap-2 rounded border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-900 dark:bg-blue-950/20'>
        <Info className='mt-0.5 h-4 w-4 flex-shrink-0' />
        <p>
          Configure the number of tables and maximum guests per table. Both
          values must be set together, or leave both blank if seating is not
          assigned.
        </p>
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <div className='space-y-2'>
          <Label htmlFor='table_count'>Number of Tables</Label>
          <Input
            id='table_count'
            type='number'
            min='1'
            max='1000'
            placeholder='e.g., 15'
            value={tableCount}
            onChange={(e) => handleTableCountChange(e.target.value)}
            disabled={disabled}
            className={
              hasPartialConfig && tableCount === '' ? 'border-orange-500' : ''
            }
          />
          <p className='text-muted-foreground text-xs'>Maximum 1000 tables</p>
        </div>

        <div className='space-y-2'>
          <Label htmlFor='max_guests_per_table'>Max Guests Per Table</Label>
          <Input
            id='max_guests_per_table'
            type='number'
            min='1'
            max='50'
            placeholder='e.g., 8'
            value={maxGuestsPerTable}
            onChange={(e) => handleMaxGuestsChange(e.target.value)}
            disabled={disabled}
            className={
              hasPartialConfig && maxGuestsPerTable === ''
                ? 'border-orange-500'
                : ''
            }
          />
          <p className='text-muted-foreground text-xs'>
            Maximum 50 guests per table
          </p>
        </div>
      </div>

      {hasPartialConfig && (
        <div className='flex items-start gap-2 rounded border border-orange-200 bg-orange-50 p-3 text-sm text-orange-600 dark:border-orange-900 dark:bg-orange-950/20 dark:text-orange-400'>
          <Info className='mt-0.5 h-4 w-4 flex-shrink-0' />
          <p>
            Both table count and max guests per table must be set together, or
            leave both blank.
          </p>
        </div>
      )}

      {totalCapacity > 0 && (
        <div className='flex items-center gap-2 rounded border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/20'>
          <Users className='h-5 w-5 text-green-600 dark:text-green-400' />
          <div className='flex-1'>
            <p className='text-sm font-medium text-green-900 dark:text-green-100'>
              Total Seating Capacity
            </p>
            <p className='text-lg font-bold text-green-700 dark:text-green-300'>
              {totalCapacity} guests
            </p>
            <p className='text-xs text-green-600 dark:text-green-400'>
              {tableCount} tables × {maxGuestsPerTable} guests per table
            </p>
          </div>
        </div>
      )}

      {(tableCount !== '' || maxGuestsPerTable !== '') && (
        <div className='flex justify-end'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => setConfirmClearOpen(true)}
            disabled={disabled}
          >
            Clear Configuration
          </Button>
        </div>
      )}

      <AlertDialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear seating configuration?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove both table count and max guests per table from
              this event.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disabled}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClear} disabled={disabled}>
              Clear Configuration
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
