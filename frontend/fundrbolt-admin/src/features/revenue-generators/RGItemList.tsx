import { useState } from 'react'
import revenueGeneratorService, {
  type RGItem,
} from '@/services/revenueGeneratorService'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Switch } from '@/components/ui/switch'
import { RGEntriesPanel } from './RGEntriesPanel'
import { RGItemForm } from './RGItemForm'

interface Props {
  eventId: string
  items: RGItem[]
  onRefresh: () => void
}

export function RGItemList({ eventId, items, onRefresh }: Props) {
  const [editItem, setEditItem] = useState<RGItem | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const handleToggleVisible = async (item: RGItem) => {
    await revenueGeneratorService.updateItem(eventId, item.id, {
      is_visible: !item.is_visible,
    })
    onRefresh()
  }

  const handleToggleOpen = async (item: RGItem) => {
    await revenueGeneratorService.updateItem(eventId, item.id, {
      is_open_for_entries: !item.is_open_for_entries,
    })
    onRefresh()
  }

  const handleDelete = async (item: RGItem) => {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return
    setDeleting(item.id)
    try {
      await revenueGeneratorService.deleteItem(eventId, item.id)
      onRefresh()
    } finally {
      setDeleting(null)
    }
  }

  if (items.length === 0) {
    return (
      <p className='text-muted-foreground py-8 text-center text-sm'>
        No revenue generator items yet. Add one to get started.
      </p>
    )
  }

  return (
    <>
      <div className='space-y-3'>
        {items.map((item) => (
          <Card key={item.id}>
            <Collapsible
              open={expandedId === item.id}
              onOpenChange={(open) => setExpandedId(open ? item.id : null)}
            >
              <CardHeader className='pb-2'>
                <div className='flex items-center justify-between gap-2'>
                  <div className='min-w-0 flex-1'>
                    <div className='flex items-center gap-2'>
                      <CardTitle className='text-base'>{item.name}</CardTitle>
                      <Badge variant='secondary'>
                        ${Number(item.price_per_entry).toFixed(2)}/entry
                      </Badge>
                      {item.current_winner_name && (
                        <Badge variant='default'>
                          🏆 {item.current_winner_name}
                        </Badge>
                      )}
                    </div>
                    <CardDescription className='mt-0.5 text-xs'>
                      {item.total_entries} entries · $
                      {Number(item.total_revenue).toFixed(2)} raised
                    </CardDescription>
                  </div>
                  <div className='flex shrink-0 items-center gap-2'>
                    <div className='flex flex-col items-end gap-1 text-xs'>
                      <label className='flex cursor-pointer items-center gap-1'>
                        <span className='text-muted-foreground'>Visible</span>
                        <Switch
                          checked={item.is_visible}
                          onCheckedChange={() => handleToggleVisible(item)}
                          className='scale-75'
                        />
                      </label>
                      <label className='flex cursor-pointer items-center gap-1'>
                        <span className='text-muted-foreground'>Open</span>
                        <Switch
                          checked={item.is_open_for_entries}
                          onCheckedChange={() => handleToggleOpen(item)}
                          className='scale-75'
                        />
                      </label>
                    </div>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => setEditItem(item)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant='destructive'
                      size='sm'
                      disabled={deleting === item.id}
                      onClick={() => handleDelete(item)}
                    >
                      {deleting === item.id ? '…' : 'Delete'}
                    </Button>
                    <CollapsibleTrigger asChild>
                      <Button variant='ghost' size='sm'>
                        {expandedId === item.id ? 'Hide' : 'Entries'}
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </div>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className='pt-0'>
                  <RGEntriesPanel
                    eventId={eventId}
                    itemId={item.id}
                    itemName={item.name}
                    onDrawWinner={onRefresh}
                  />
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ))}
      </div>

      {editItem && (
        <RGItemForm
          eventId={eventId}
          item={editItem}
          open={true}
          onClose={() => setEditItem(null)}
          onSaved={onRefresh}
        />
      )}
    </>
  )
}
