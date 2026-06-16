import type { MediaSource } from '@/services/cause-section-cards'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

interface VideoCardEditorProps {
  videoUrl: string
  videoMediaSource: MediaSource | null
  videoAutoplay: boolean
  videoMutedByDefault: boolean
  onVideoUrlChange: (value: string) => void
  onVideoMediaSourceChange: (value: MediaSource | null) => void
  onVideoAutoplayChange: (value: boolean) => void
  onVideoMutedByDefaultChange: (value: boolean) => void
}

export function VideoCardEditor({
  videoUrl,
  videoMediaSource,
  videoAutoplay,
  videoMutedByDefault,
  onVideoUrlChange,
  onVideoMediaSourceChange,
  onVideoAutoplayChange,
  onVideoMutedByDefaultChange,
}: VideoCardEditorProps) {
  return (
    <div className='space-y-4'>
      <div className='space-y-2'>
        <Label htmlFor='video-source'>Video Source</Label>
        <Select
          value={videoMediaSource ?? 'external'}
          onValueChange={(value) =>
            onVideoMediaSourceChange(value as MediaSource)
          }
        >
          <SelectTrigger id='video-source'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='external'>External HTTPS URL</SelectItem>
            <SelectItem value='upload'>Uploaded Asset URL</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className='space-y-2'>
        <Label htmlFor='video-url'>Video URL</Label>
        <Input
          id='video-url'
          placeholder='https://...'
          value={videoUrl}
          onChange={(event) => onVideoUrlChange(event.target.value)}
        />
      </div>

      <div className='flex items-center justify-between rounded-lg border p-3'>
        <div>
          <p className='font-medium'>Autoplay</p>
          <p className='text-muted-foreground text-sm'>
            Start playback automatically when supported.
          </p>
        </div>
        <Switch
          checked={videoAutoplay}
          onCheckedChange={onVideoAutoplayChange}
        />
      </div>

      <div className='flex items-center justify-between rounded-lg border p-3'>
        <div>
          <p className='font-medium'>Muted by default</p>
          <p className='text-muted-foreground text-sm'>
            Recommended for autoplaying videos.
          </p>
        </div>
        <Switch
          checked={videoMutedByDefault}
          onCheckedChange={onVideoMutedByDefaultChange}
        />
      </div>
    </div>
  )
}
