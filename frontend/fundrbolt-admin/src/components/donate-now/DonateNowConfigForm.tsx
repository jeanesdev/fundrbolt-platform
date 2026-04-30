import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import {
  donateNowAdminApi,
  type DonateNowConfigResponse,
  type DonateNowConfigUpdate,
} from '@/api/donateNow'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface DonateNowConfigFormProps {
  npoId: string
  config: DonateNowConfigResponse
  /** When true, only shows the NPO info text field */
  infoTab?: boolean
}

export function DonateNowConfigForm({
  npoId,
  config,
  infoTab = false,
}: DonateNowConfigFormProps) {
  const queryClient = useQueryClient()
  const [donaPleaText, setDonaPleaText] = useState(
    config.donate_plea_text ?? ''
  )
  const [heroUrl, setHeroUrl] = useState(config.hero_media_url ?? '')
  const [npoInfoText, setNpoInfoText] = useState(config.npo_info_text ?? '')
  const [feePercent, setFeePercent] = useState(
    (parseFloat(config.processing_fee_pct) * 100).toFixed(2)
  )
  const [uploading, setUploading] = useState(false)

  const saveMutation = useMutation({
    mutationFn: (data: DonateNowConfigUpdate) =>
      donateNowAdminApi.updateConfig(npoId, data).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.setQueryData(['donate-now-config', npoId], data)
      toast.success('Settings saved')
    },
    onError: () => toast.error('Failed to save settings'),
  })

  const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const { data } = await donateNowAdminApi.getHeroUploadUrl(
        npoId,
        file.name,
        file.type
      )
      await fetch(data.upload_url, {
        method: 'PUT',
        body: file,
        headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': file.type },
      })
      setHeroUrl(data.blob_url)
      toast.success('Hero image uploaded — click Save to apply')
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  if (infoTab) {
    return (
      <div className='space-y-4'>
        <div className='space-y-2'>
          <Label htmlFor='npo-info-text'>NPO Information Text</Label>
          <Textarea
            id='npo-info-text'
            value={npoInfoText}
            onChange={(e) => setNpoInfoText(e.target.value)}
            placeholder='Tell donors about your mission...'
            rows={6}
          />
        </div>
        <Button
          onClick={() =>
            saveMutation.mutate({ npo_info_text: npoInfoText || null })
          }
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending && (
            <Loader2 className='mr-2 h-4 w-4 animate-spin' />
          )}
          Save
        </Button>
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      <div className='space-y-2'>
        <Label htmlFor='plea-text'>Donation Plea Text</Label>
        <Textarea
          id='plea-text'
          value={donaPleaText}
          onChange={(e) => setDonaPleaText(e.target.value)}
          placeholder='Help us make a difference today...'
          rows={4}
          maxLength={500}
        />
      </div>

      <div className='space-y-2'>
        <Label>Hero Image / Video</Label>
        {heroUrl && (
          <img
            src={heroUrl}
            alt='Hero preview'
            className='h-40 w-full rounded-md object-cover'
          />
        )}
        <div className='flex gap-2'>
          <Input
            value={heroUrl}
            onChange={(e) => setHeroUrl(e.target.value)}
            placeholder='https://...'
            className='flex-1'
          />
          <label className='cursor-pointer'>
            <Button variant='outline' size='icon' asChild disabled={uploading}>
              <span>
                {uploading ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : (
                  <Upload className='h-4 w-4' />
                )}
              </span>
            </Button>
            <input
              type='file'
              accept='image/*,video/*'
              className='hidden'
              onChange={handleHeroUpload}
            />
          </label>
        </div>
      </div>

      <div className='space-y-2'>
        <Label htmlFor='fee-pct'>Processing Fee Passed to Donor (%)</Label>
        <Input
          id='fee-pct'
          type='number'
          step='0.01'
          min='0'
          max='100'
          value={feePercent}
          onChange={(e) => setFeePercent(e.target.value)}
          className='w-32'
        />
        <p className='text-muted-foreground text-xs'>
          When donor opts to cover fees, this % is added to their total.
        </p>
      </div>

      <Button
        onClick={() =>
          saveMutation.mutate({
            donate_plea_text: donaPleaText || null,
            hero_media_url: heroUrl || null,
            processing_fee_pct: (parseFloat(feePercent) / 100).toFixed(4),
          })
        }
        disabled={saveMutation.isPending}
      >
        {saveMutation.isPending && (
          <Loader2 className='mr-2 h-4 w-4 animate-spin' />
        )}
        Save Settings
      </Button>
    </div>
  )
}
