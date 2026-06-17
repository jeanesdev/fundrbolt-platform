import { useMemo, useState } from 'react'
import type { PublicCauseSectionCard } from '@/lib/api/cause-section-cards'
import { CauseSectionShell } from './CauseSectionShell'

function isDirectVideoUrl(url: string) {
  return /\.(mp4|webm|ogg)(\?.*)?$/i.test(url)
}

export function VideoCard({ card }: { card: PublicCauseSectionCard }) {
  const [hasError, setHasError] = useState(false)
  const videoUrl = card.video_url ?? ''
  const directVideo = useMemo(() => isDirectVideoUrl(videoUrl), [videoUrl])

  return (
    <CauseSectionShell card={card}>
      {hasError ? (
        <a
          href={videoUrl}
          target='_blank'
          rel='noreferrer noopener'
          className='text-sm font-medium text-blue-600 underline'
        >
          Open video in a new tab
        </a>
      ) : directVideo ? (
        <video
          controls
          playsInline
          autoPlay={card.video_autoplay ?? false}
          muted={card.video_muted_by_default ?? true}
          className='w-full rounded-xl'
          onError={() => setHasError(true)}
        >
          <source src={videoUrl} />
        </video>
      ) : (
        <iframe
          src={videoUrl}
          title={card.title ?? 'Cause video'}
          className='aspect-video w-full rounded-xl border-0'
          allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
          allowFullScreen
          onError={() => setHasError(true)}
        />
      )}
    </CauseSectionShell>
  )
}
