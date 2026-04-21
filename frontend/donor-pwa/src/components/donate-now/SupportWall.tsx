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

  if (isLoading) return <p className='text-muted-foreground text-sm'>Loading support wall...</p>
  if (!data || data.entries.length === 0) {
    return <p className='text-muted-foreground text-sm'>Be the first to donate!</p>
  }

  return (
    <section className='space-y-4'>
      <h2 className='text-lg font-semibold'>Support Wall</h2>
      <div className='space-y-3'>
        {data.entries.map((entry) => (
          <SupportWallEntry key={entry.id} entry={entry} />
        ))}
      </div>
    </section>
  )
}
