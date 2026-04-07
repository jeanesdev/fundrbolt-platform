import { useState } from 'react'
import type { EventSettingsResponse } from '@/services/auctioneerService'
import { Percent, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useUpsertSettings } from '../hooks/useAuctioneerData'

interface CategoryPercentagesProps {
  eventId: string
  settings: EventSettingsResponse | null
}

export function CategoryPercentages({
  eventId,
  settings,
}: CategoryPercentagesProps) {
  const [livePercent, setLivePercent] = useState(
    settings?.live_auction_percent?.toString() ?? '0'
  )
  const [paddlePercent, setPaddlePercent] = useState(
    settings?.paddle_raise_percent?.toString() ?? '0'
  )
  const [silentPercent, setSilentPercent] = useState(
    settings?.silent_auction_percent?.toString() ?? '0'
  )

  const upsertMutation = useUpsertSettings(eventId)

  const handleSave = () => {
    const live = parseFloat(livePercent)
    const paddle = parseFloat(paddlePercent)
    const silent = parseFloat(silentPercent)

    if ([live, paddle, silent].some((v) => isNaN(v) || v < 0 || v > 100)) return

    upsertMutation.mutate({
      live_auction_percent: live,
      paddle_raise_percent: paddle,
      silent_auction_percent: silent,
    })
  }

  return (
    <Card>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2 text-base'>
          <Percent className='h-4 w-4' />
          Category Percentages
        </CardTitle>
        <CardDescription>
          Commission percentages for revenue not covered by per-item commissions
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='grid grid-cols-3 gap-4'>
          <div className='space-y-2'>
            <Label htmlFor='live-percent'>Live Auction %</Label>
            <Input
              id='live-percent'
              type='number'
              min='0'
              max='100'
              step='0.01'
              value={livePercent}
              onChange={(e) => setLivePercent(e.target.value)}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='paddle-percent'>Paddle Raise %</Label>
            <Input
              id='paddle-percent'
              type='number'
              min='0'
              max='100'
              step='0.01'
              value={paddlePercent}
              onChange={(e) => setPaddlePercent(e.target.value)}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='silent-percent'>Silent Auction %</Label>
            <Input
              id='silent-percent'
              type='number'
              min='0'
              max='100'
              step='0.01'
              value={silentPercent}
              onChange={(e) => setSilentPercent(e.target.value)}
            />
          </div>
        </div>
        <Button
          onClick={handleSave}
          disabled={upsertMutation.isPending}
          size='sm'
        >
          <Save className='mr-1 h-3 w-3' />
          {upsertMutation.isPending ? 'Saving...' : 'Save Settings'}
        </Button>
      </CardContent>
    </Card>
  )
}
