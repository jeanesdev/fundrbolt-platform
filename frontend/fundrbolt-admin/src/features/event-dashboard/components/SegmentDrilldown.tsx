/**
 * Segment Drilldown Component
 * 
 * Displays segment breakdowns by table, guest, registrant, or company
 */

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useSegmentBreakdown } from '../hooks/useEventDashboard'
import type { SegmentType } from '@/types/event-dashboard'

interface SegmentDrilldownProps {
  eventId: string
}

export function SegmentDrilldown({ eventId }: SegmentDrilldownProps) {
  const [segmentType, setSegmentType] = useState<SegmentType>('table')

  const { data: breakdown, isLoading } = useSegmentBreakdown({
    eventId,
    segmentType,
    limit: 50,
    sort: 'total_amount',
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Segment Breakdown</CardTitle>
            <CardDescription>
              View contributions by different segments
            </CardDescription>
          </div>
          <Select value={segmentType} onValueChange={(value) => setSegmentType(value as SegmentType)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select segment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="table">By Table</SelectItem>
              <SelectItem value="guest">By Guest</SelectItem>
              <SelectItem value="registrant">By Registrant</SelectItem>
              <SelectItem value="company">By Company</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : breakdown && breakdown.items.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Segment</TableHead>
                <TableHead className="text-right">Total Amount</TableHead>
                <TableHead className="text-right">Contribution %</TableHead>
                <TableHead className="text-right">Guests</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {breakdown.items.map((item) => (
                <TableRow key={item.segment_id}>
                  <TableCell className="font-medium">{item.segment_label}</TableCell>
                  <TableCell className="text-right">
                    ${parseFloat(item.total_amount.amount).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {(item.contribution_share * 100).toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right">{item.guest_count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No segment data available
          </div>
        )}
      </CardContent>
    </Card>
  )
}
