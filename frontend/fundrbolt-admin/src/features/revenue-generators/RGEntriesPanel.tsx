import { useEffect, useState } from 'react'
import revenueGeneratorService, {
  type RGEntryRow,
} from '@/services/revenueGeneratorService'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface Props {
  eventId: string
  itemId: string
  itemName: string
  onDrawWinner: () => void
}

export function RGEntriesPanel({
  eventId,
  itemId,
  itemName,
  onDrawWinner,
}: Props) {
  const [entries, setEntries] = useState<RGEntryRow[]>([])
  const [totalEntries, setTotalEntries] = useState(0)
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [loading, setLoading] = useState(true)
  const [drawing, setDrawing] = useState(false)

  useEffect(() => {
    setLoading(true)
    revenueGeneratorService
      .listEntries(eventId, itemId)
      .then((data) => {
        setEntries(data.entries)
        setTotalEntries(data.total_entries)
        setTotalRevenue(data.total_revenue)
      })
      .finally(() => setLoading(false))
  }, [eventId, itemId])

  const handleDraw = async () => {
    setDrawing(true)
    try {
      await revenueGeneratorService.drawRandomWinner(eventId, itemId)
      onDrawWinner()
    } finally {
      setDrawing(false)
    }
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <div>
          <h3 className='font-semibold'>{itemName} — Entries</h3>
          <p className='text-muted-foreground text-sm'>
            {totalEntries} entries · ${Number(totalRevenue).toFixed(2)}{' '}
            collected
          </p>
        </div>
        <Button
          onClick={handleDraw}
          disabled={drawing || totalEntries === 0}
          variant='default'
        >
          {drawing ? 'Drawing…' : 'Draw Random Winner'}
        </Button>
      </div>

      {loading ? (
        <p className='text-muted-foreground text-sm'>Loading…</p>
      ) : entries.length === 0 ? (
        <p className='text-muted-foreground text-sm'>No entries yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bidder #</TableHead>
              <TableHead>Donor</TableHead>
              <TableHead className='text-right'>Entries</TableHead>
              <TableHead className='text-right'>Paid</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((row) => (
              <TableRow key={row.bidder_number}>
                <TableCell>
                  <Badge variant='outline'>#{row.bidder_number}</Badge>
                </TableCell>
                <TableCell>{row.donor_name}</TableCell>
                <TableCell className='text-right'>{row.entry_count}</TableCell>
                <TableCell className='text-right'>
                  ${Number(row.total_paid).toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
