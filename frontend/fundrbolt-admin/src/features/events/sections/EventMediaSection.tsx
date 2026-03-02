import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MediaUploader } from '../components/MediaUploader'
import { useEventWorkspace } from '../useEventWorkspace'

export function EventMediaSection() {
  const {
    currentEvent,
    handleMediaUpload,
    handleMediaDelete,
    uploadProgress,
    uploadingFiles,
  } = useEventWorkspace()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Event Media</CardTitle>
        <CardDescription>
          Upload images, logos, and promotional materials for your event
        </CardDescription>
      </CardHeader>
      <CardContent>
        <MediaUploader
          media={currentEvent.media || []}
          onUpload={handleMediaUpload}
          onDelete={handleMediaDelete}
          uploadProgress={uploadProgress}
          uploadingFiles={uploadingFiles}
        />
      </CardContent>
    </Card>
  )
}
