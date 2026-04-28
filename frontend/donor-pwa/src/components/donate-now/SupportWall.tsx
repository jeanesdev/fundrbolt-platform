import { donateNowApi } from '@/lib/api/donateNow'
import { useQuery } from '@tanstack/react-query'
import { SupportWallEntry } from './SupportWallEntry'

interface SupportWallProps {
  npoSlug: string
}

export function SupportWall({ npoSlug }: SupportWallProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['support-wall', npoSlug],
    queryFn: () => donateNowApi.getSupportWall(npoSlug).then((r) => r.data),
  })

  return (
    <section
      className='space-y-4 rounded-xl border p-4'
      style={{
        borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.22)',
        backgroundColor: 'rgb(var(--event-background, 255, 255, 255))',
      }}
    >
      <h2 className='text-lg font-semibold'>Support Wall</h2>
      {isLoading ? (
        <p className='text-sm' style={{ color: 'var(--event-text-muted-on-background, #4B5563)' }}>
          Loading support wall...
        </p>
      ) : !data || data.entries.length === 0 ? (
        <p className='text-sm' style={{ color: 'var(--event-text-muted-on-background, #4B5563)' }}>
          Be the first to donate!
        </p>
      ) : (
        <div className='space-y-3'>
          {data.entries.map((entry) => (
            <SupportWallEntry key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </section>
  )
}
