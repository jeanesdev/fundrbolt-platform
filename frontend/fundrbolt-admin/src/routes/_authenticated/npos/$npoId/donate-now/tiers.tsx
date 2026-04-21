import { donateNowAdminApi } from '@/api/donateNow'
import { DonationTierEditor } from '@/components/donate-now/DonationTierEditor'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useParams } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/npos/$npoId/donate-now/tiers')({
  component: DonateNowTiersPage,
})

function DonateNowTiersPage() {
  const { npoId } = useParams({ from: '/_authenticated/npos/$npoId/donate-now/tiers' })

  const { data: tiers, isLoading } = useQuery({
    queryKey: ['donate-now-tiers', npoId],
    queryFn: () => donateNowAdminApi.getTiers(npoId).then((r) => r.data),
  })

  return (
    <div className='space-y-6 p-6'>
      <div>
        <h1 className='text-2xl font-bold'>Donation Tiers</h1>
        <p className='text-muted-foreground text-sm'>
          Set suggested donation amounts shown to donors
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tiers</CardTitle>
          <CardDescription>Up to 10 tiers. Donors can always enter a custom amount.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='space-y-3'>
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className='h-16 w-full' />
              ))}
            </div>
          ) : (
            <DonationTierEditor npoId={npoId} tiers={tiers ?? []} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
