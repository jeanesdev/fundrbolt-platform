import { useState } from 'react'
import { DONOR_LABEL_COLORS } from '@/themes/colors'
import { Check, Plus, X } from 'lucide-react'
import { useNPOContextStore } from '@/stores/npo-context-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { DonorLabelInfo } from '@/features/users/api/users-api'
import {
  useCreateDonorLabel,
  useDonorLabels,
  useSetUserDonorLabels,
  useUserDonorLabels,
} from '@/features/users/hooks/use-donor-labels'

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
  /** NPO ID for label queries — falls back to NPO context store */
  npoId?: string | null
}

export function InlineDonorLabels({
  labels,
  userId,
  npoId: npoIdProp,
}: InlineDonorLabelsProps) {
  const editable = !!userId
  const storeNpoId = useNPOContextStore((state) => state.selectedNpoId)
  const npoId = npoIdProp ?? storeNpoId
  const { data: labelsData } = useDonorLabels(editable ? npoId : null)
  const { data: userLabelsData } = useUserDonorLabels(
    editable ? npoId : null,
    userId ?? null
  )
  const setLabels = useSetUserDonorLabels(editable ? npoId : null)
  const createLabel = useCreateDonorLabel(editable ? npoId : null)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newLabelName, setNewLabelName] = useState('')

  // Use live query data when available, fall back to prop
  const currentLabels =
    (editable && userLabelsData ? userLabelsData : null) ?? labels ?? []
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

  const handleCreateLabel = () => {
    const name = newLabelName.trim()
    if (!name) return
    // Pick color based on label name length to avoid Math.random() purity lint
    const colorIndex = name.length % DONOR_LABEL_COLORS.length
    const color = DONOR_LABEL_COLORS[colorIndex]
    createLabel.mutate(
      { name, color },
      {
        onSuccess: (created) => {
          setNewLabelName('')
          setShowCreate(false)
          // Auto-assign the new label to this user
          if (userId) {
            setLabels.mutate({
              userId,
              labelIds: [...currentLabelIds, created.id],
            })
          }
        },
      }
    )
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
        <Popover
          open={popoverOpen}
          onOpenChange={(open) => {
            setPopoverOpen(open)
            if (!open) {
              setShowCreate(false)
              setNewLabelName('')
            }
          }}
        >
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
          <PopoverContent className='w-[220px] p-0' align='start'>
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
                <CommandSeparator />
                <CommandGroup>
                  {showCreate ? (
                    <div className='flex items-center gap-1 px-2 py-1.5'>
                      <Input
                        value={newLabelName}
                        onChange={(e) => setNewLabelName(e.target.value)}
                        placeholder='Label name'
                        className='h-7 text-xs'
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleCreateLabel()
                          }
                          e.stopPropagation()
                        }}
                        autoFocus
                      />
                      <Button
                        size='sm'
                        className='h-7 px-2 text-xs'
                        disabled={!newLabelName.trim() || createLabel.isPending}
                        onClick={handleCreateLabel}
                      >
                        Add
                      </Button>
                    </div>
                  ) : (
                    <CommandItem
                      onSelect={() => setShowCreate(true)}
                      className='text-xs'
                    >
                      <Plus className='mr-2 h-3 w-3' />
                      Create new label
                    </CommandItem>
                  )}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
