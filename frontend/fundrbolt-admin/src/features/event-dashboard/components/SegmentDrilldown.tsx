import type {
  SegmentBreakdownItem,
  SegmentType,
} from '@/services/event-dashboard'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SegmentHeatmap } from './SegmentHeatmap'
import { SegmentLeaderboard } from './SegmentLeaderboard'

interface SegmentDrilldownProps {
  segmentType: SegmentType
  onSegmentTypeChange: (segmentType: SegmentType) => void
  items: SegmentBreakdownItem[]
}

export function SegmentDrilldown({
  segmentType,
  onSegmentTypeChange,
  items,
}: SegmentDrilldownProps) {
  return (
    <section className='space-y-4'>
      <div className='flex items-center justify-between'>
        <h2 className='text-lg font-semibold'>Segment Drilldown</h2>
        <Select
          value={segmentType}
          onValueChange={(value) => onSegmentTypeChange(value as SegmentType)}
        >
          <SelectTrigger className='w-[220px]'>
            <SelectValue placeholder='Select segment' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='table'>Table</SelectItem>
            <SelectItem value='guest'>Guest</SelectItem>
            <SelectItem value='registrant'>Registrant</SelectItem>
            <SelectItem value='company'>Company</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className='grid gap-4 xl:grid-cols-2'>
        <SegmentLeaderboard items={items} />
        <SegmentHeatmap items={items} />
      </div>
    </section>
  )
}
