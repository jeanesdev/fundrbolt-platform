import { createFileRoute, useParams } from '@tanstack/react-router'
import { useNpoContext } from '@/hooks/use-npo-context'
import { SupportWallModerationTable } from '@/components/donate-now/SupportWallModerationTable'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const Route = createFileRoute(
  '/_authenticated/npos/$npoId/donate-now/wall'
)({
  component: DonateNowWallPage,
})

function DonateNowWallPage() {
  const { npoId: npoSlug } = useParams({
    from: '/_authenticated/npos/$npoId/donate-now/wall',
  })
  const { availableNpos } = useNpoContext()
  const resolvedNpoId = UUID_PATTERN.test(npoSlug)
    ? npoSlug
    : (availableNpos.find((n) => n.slug === npoSlug)?.id ?? null)

  return (
    <div className='space-y-6 p-6'>
      <div>
        <h1 className='text-2xl font-bold'>Support Wall</h1>
        <p className='text-muted-foreground text-sm'>
          Moderate donor messages shown on the public support wall
        </p>
      </div>
      <SupportWallModerationTable npoId={resolvedNpoId} />
    </div>
  )
}
