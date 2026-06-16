import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useParams } from '@tanstack/react-router'
import apiClient from '@/lib/axios'
import { useNpoContext } from '@/hooks/use-npo-context'
import { SupportWallModerationTable } from '@/components/donate-now/SupportWallModerationTable'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface NpoListItem {
  id: string
  slug?: string | null
}

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

  const isUuid = UUID_PATTERN.test(npoSlug)
  const resolvedFromContext = isUuid
    ? npoSlug
    : (availableNpos.find((n) => n.slug === npoSlug)?.id ?? null)

  // Fallback: fetch NPO list directly when the context store hasn't populated
  // availableNpos yet (e.g. on direct navigation before the layout's query completes).
  // Uses the same query key as setup.tsx so the cache is shared.
  const { data: nposList } = useQuery({
    queryKey: ['npos-resolve-slug'],
    queryFn: async () => {
      const response = await apiClient.get('/npos')
      return (response.data.items as NpoListItem[]) || []
    },
    enabled: !isUuid && !resolvedFromContext,
    staleTime: 5 * 60 * 1000,
  })

  const resolvedNpoId =
    resolvedFromContext ?? nposList?.find((n) => n.slug === npoSlug)?.id ?? null

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
