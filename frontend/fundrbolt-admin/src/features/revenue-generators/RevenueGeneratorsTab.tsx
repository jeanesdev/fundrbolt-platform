import { useEffect, useState } from 'react'
import revenueGeneratorService, {
  type RGItem,
} from '@/services/revenueGeneratorService'
import { Button } from '@/components/ui/button'
import { RGItemForm } from './RGItemForm'
import { RGItemList } from './RGItemList'

interface Props {
  eventId: string
}

export function RevenueGeneratorsTab({ eventId }: Props) {
  const [items, setItems] = useState<RGItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  const loadItems = () => {
    setLoading(true)
    revenueGeneratorService
      .listItems(eventId)
      .then(setItems)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  return (
    <div className='space-y-4'>
      <div className='flex justify-end'>
        <Button onClick={() => setShowCreate(true)}>+ Add Item</Button>
      </div>

      {loading ? (
        <p className='text-muted-foreground text-sm'>Loading…</p>
      ) : (
        <RGItemList eventId={eventId} items={items} onRefresh={loadItems} />
      )}

      <RGItemForm
        eventId={eventId}
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSaved={loadItems}
      />
    </div>
  )
}
