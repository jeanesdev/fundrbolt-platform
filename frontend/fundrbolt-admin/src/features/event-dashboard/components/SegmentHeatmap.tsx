import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { SegmentBreakdownItem } from '@/services/event-dashboard'

interface SegmentHeatmapProps {
  items: SegmentBreakdownItem[]
}

export function SegmentHeatmap({ items }: SegmentHeatmapProps) {
  const maxShare = Math.max(...items.map((item) => item.contribution_share), 0.0001)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contribution Heatmap</CardTitle>
      </CardHeader>
      <CardContent className='space-y-2'>
        {items.map((item) => {
          const width = `${Math.max(8, (item.contribution_share / maxShare) * 100)}%`
          return (
            <div key={item.segment_id} className='space-y-1'>
              <div className='flex items-center justify-between text-xs'>
                <span>{item.segment_label}</span>
                <span>{(item.contribution_share * 100).toFixed(1)}%</span>
              </div>
              <div className='h-2 rounded-full bg-muted'>
                <div className='h-2 rounded-full bg-primary' style={{ width }} />
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
