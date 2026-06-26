import { useCallback, useEffect, useState } from 'react'
import auctionItemService from '@/services/auctionItemService'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

interface SilentAuctionExtensionPolicyCardProps {
  eventId: string
}

export function SilentAuctionExtensionPolicyCard({
  eventId,
}: SilentAuctionExtensionPolicyCardProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [extensionDuration, setExtensionDuration] = useState(3)
  const [maxTotalExtension, setMaxTotalExtension] = useState(30)

  const loadPolicy = useCallback(async () => {
    setIsLoading(true)
    try {
      const policy =
        await auctionItemService.getSilentAuctionExtensionPolicy(eventId)
      setEnabled(policy.auto_extension_enabled)
      setExtensionDuration(policy.extension_duration_minutes)
      setMaxTotalExtension(policy.max_total_extension_minutes)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to load anti-sniping settings'
      )
    } finally {
      setIsLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    if (!eventId) return
    void loadPolicy()
  }, [eventId, loadPolicy])

  const handleSave = async () => {
    const duration = Number(extensionDuration)
    const maxTotal = Number(maxTotalExtension)

    if (duration < 1 || duration > 10) {
      toast.error('Extension duration must be between 1 and 10 minutes.')
      return
    }
    if (maxTotal < 0 || maxTotal > 60) {
      toast.error('Max total extension must be between 0 and 60 minutes.')
      return
    }

    setIsSaving(true)
    try {
      const policy =
        await auctionItemService.updateSilentAuctionExtensionPolicy(eventId, {
          auto_extension_enabled: enabled,
          extension_duration_minutes: duration,
          max_total_extension_minutes: maxTotal,
        })
      setEnabled(policy.auto_extension_enabled)
      setExtensionDuration(policy.extension_duration_minutes)
      setMaxTotalExtension(policy.max_total_extension_minutes)
      toast.success('Anti-sniping settings saved.')
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to save anti-sniping settings'
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Silent Auction Anti-Sniping</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='flex items-center justify-between rounded-md border p-3'>
          <div>
            <Label htmlFor='auto-extension-switch'>Auto-extension</Label>
            <p className='text-muted-foreground text-sm'>
              Extend close time on qualifying late bids.
            </p>
          </div>
          <Switch
            id='auto-extension-switch'
            checked={enabled}
            disabled={isLoading || isSaving}
            onCheckedChange={setEnabled}
          />
        </div>

        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <div className='space-y-2'>
            <Label htmlFor='extension-duration'>
              Extension duration (minutes)
            </Label>
            <Input
              id='extension-duration'
              type='number'
              min={1}
              max={10}
              value={extensionDuration}
              disabled={isLoading || isSaving}
              onChange={(e) => setExtensionDuration(Number(e.target.value))}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='max-total-extension'>
              Max total extension (minutes)
            </Label>
            <Input
              id='max-total-extension'
              type='number'
              min={0}
              max={60}
              value={maxTotalExtension}
              disabled={isLoading || isSaving}
              onChange={(e) => setMaxTotalExtension(Number(e.target.value))}
            />
          </div>
        </div>

        <Button
          onClick={() => void handleSave()}
          disabled={isLoading || isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Anti-Sniping Settings'}
        </Button>
      </CardContent>
    </Card>
  )
}
