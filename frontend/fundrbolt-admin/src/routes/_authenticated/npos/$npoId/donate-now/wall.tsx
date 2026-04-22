import { SupportWallModerationTable } from '@/components/donate-now/SupportWallModerationTable'
import { useNpoContext } from '@/hooks/use-npo-context'
import { createFileRoute, useParams } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/npos/$npoId/donate-now/wall')({
  component: DonateNowWallPage,
})

function DonateNowWallPage() {
  const { npoId: npoSlug } = useParams({ from: '/_authenticated/npos/$npoId/donate-now/wall' })
  const { availableNpos } = useNpoContext()
  // The URL param may be a slug (e.g. "hope-foundation") — resolve to UUID for API calls
  const npoId = availableNpos.find((n) => n.slug === npoSlug)?.id ?? npoSlug

  return (
    <div className='space-y-6 p-6'>
      <div>
        <h1 className='text-2xl font-bold'>Support Wall</h1>
        <p className='text-muted-foreground text-sm'>
          Moderate donor messages shown on the public support wall
        </p>
      </div>
      <SupportWallModerationTable npoId={npoId} />
    </div>
  )
}
