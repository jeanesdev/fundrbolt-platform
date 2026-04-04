import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { DonorLabelInfo } from '@/features/users/api/users-api'
import {
  useDonorLabels,
  useSetUserDonorLabels,
} from '@/features/users/hooks/use-donor-labels'
import { useNPOContextStore } from '@/stores/npo-context-store'
import { Check, Plus, X } from 'lucide-react'
import { useState } from 'react'

function getLabelStyle(color: string | null) {
  if (!color) return {}
  return {
    backgroundColor: `${color}20`,
    borderColor: `${color}60`,
    color: color,
  }
}

interface InlineDonorLabelsProps {
  labels: DonorLabelInfo[] | undefined
  /** When provided, labels become editable (add/remove) */
  userId?: string | null
}

export function InlineDonorLabels({ labels, userId }: InlineDonorLabelsProps) {
  const editable = !!userId
  const selectedNpoId = useNPOContextStore((state) => state.selectedNpoId)
  const { data: labelsData } = useDonorLabels(
    editable ? selectedNpoId : null
  )
  const setLabels = useSetUserDonorLabels(editable ? selectedNpoId : null)
  const [popoverOpen, setPopoverOpen] = useState(false)

  const currentLabels = labels ?? []
  const currentLabelIds = currentLabels.map((l) => l.id)
  const allLabels = labelsData?.items ?? []

  const handleToggleLabel = (labelId: string) => {
    if (!userId) return
    const newIds = currentLabelIds.includes(labelId)
      ? currentLabelIds.filter((id) => id !== labelId)
      : [...currentLabelIds, labelId]
    setLabels.mutate({ userId, labelIds: newIds })
  }

  const handleRemoveLabel = (labelId: string) => {
    if (!userId) return
    const newIds = currentLabelIds.filter((id) => id !== labelId)
    setLabels.mutate({ userId, labelIds: newIds })
  }

  if (!editable && currentLabels.length === 0) return null

  return (
    <div className='flex flex-wrap items-center gap-1'>
      {currentLabels.map((label) => (
        <Badge
          key={label.id}
          variant='outline'
          className='text-xs'
          style={getLabelStyle(label.color)}
        >
          {label.name}
          {editable && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleRemoveLabel(label.id)
              }}
              className='hover:bg-foreground/10 ml-0.5 rounded-full p-0.5'
            >
              <X className='h-2.5 w-2.5' />
            </button>
          )}
        </Badge>
      ))}
      {editable && (
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant='ghost'
              size='sm'
              className='h-5 w-5 rounded-full p-0'
              title='Add label'
            >
              <Plus className='h-3 w-3' />
            </Button>
          </PopoverTrigger>
          <PopoverContent className='w-[200px] p-0' align='start'>
            <Command>
              <CommandInput placeholder='Search labels...' />
              <CommandList>
                <CommandEmpty>No labels found.</CommandEmpty>
                <CommandGroup>
                  {allLabels.map((label) => (
                    <CommandItem
                      key={label.id}
                      onSelect={() => handleToggleLabel(label.id)}
                      className='flex items-center justify-between'
                    >
                      <div className='flex items-center gap-2'>
                        {label.color && (
                          <span
                            className='h-3 w-3 rounded-full'
                            style={{ backgroundColor: label.color }}
                          />
                        )}
                        <span>{label.name}</span>
                      </div>
                      {currentLabelIds.includes(label.id) && (
                        <Check className='h-4 w-4' />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
