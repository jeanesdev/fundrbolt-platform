import { donateNowAdminApi } from '@/api/donateNow'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useNpoContext } from '@/hooks/use-npo-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useParams } from '@tanstack/react-router'
import { CalendarDays, Heart, RefreshCw, TrendingUp, Users } from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/npos/$npoId/donate-now/dashboard')({
  component: DonateNowDashboardPage,
})

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function DonateNowDashboardPage() {
  const { npoId: npoSlug } = useParams({ from: '/_authenticated/npos/$npoId/donate-now/dashboard' })
  const { availableNpos } = useNpoContext()
  // The URL param may be a slug (e.g. "hope-foundation") — resolve to UUID for API calls
  const npoId = availableNpos.find((n) => n.slug === npoSlug)?.id ?? npoSlug
  const queryClient = useQueryClient()

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['donate-now-config', npoId],
    queryFn: () => donateNowAdminApi.getConfig(npoId).then((r) => r.data),
  })

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['donate-now-stats', npoId],
    queryFn: () => donateNowAdminApi.getStats(npoId).then((r) => r.data),
  })

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      donateNowAdminApi.updateConfig(npoId, { is_enabled: enabled }).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.setQueryData(['donate-now-config', npoId], data)
      toast.success(data.is_enabled ? 'Donate Now page enabled' : 'Donate Now page disabled')
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail ?? 'Failed to update setting')
    },
  })

  if (configLoading) {
    return (
      <div className='space-y-6 p-6'>
        <Skeleton className='h-10 w-64' />
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className='h-28 w-full' />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className='space-y-6 p-6'>
      {/* Header */}
      <div className='flex flex-wrap items-center justify-between gap-4'>
        <div className='flex items-center gap-3'>
          <Heart className='h-6 w-6 text-rose-500' />
          <div>
            <h1 className='text-2xl font-bold'>Donate Now</h1>
            <p className='text-muted-foreground text-sm'>
              Manage your public donation page and track contributions
            </p>
          </div>
        </div>
        <div className='flex items-center gap-2 rounded-lg border px-3 py-2'>
          <span className='text-sm font-medium'>Page {config?.is_enabled ? 'Live' : 'Disabled'}</span>
          <Switch
            checked={config?.is_enabled ?? false}
            onCheckedChange={(checked) => toggleMutation.mutate(checked)}
            disabled={toggleMutation.isPending}
          />
        </div>
      </div>

      {/* Stats cards */}
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total Raised</CardTitle>
            <TrendingUp className='text-muted-foreground h-4 w-4' />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className='h-7 w-24' />
            ) : (
              <div className='text-2xl font-bold'>
                {formatCents(stats?.total_amount_cents ?? 0)}
              </div>
            )}
            <p className='text-muted-foreground text-xs'>
              {stats?.total_count ?? 0} donations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>One-Time</CardTitle>
            <Heart className='text-muted-foreground h-4 w-4' />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className='h-7 w-24' />
            ) : (
              <div className='text-2xl font-bold'>
                {formatCents(stats?.one_time_amount_cents ?? 0)}
              </div>
            )}
            <p className='text-muted-foreground text-xs'>
              {stats?.one_time_count ?? 0} donations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Monthly Recurring</CardTitle>
            <RefreshCw className='text-muted-foreground h-4 w-4' />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className='h-7 w-24' />
            ) : (
              <div className='text-2xl font-bold'>
                {formatCents(stats?.monthly_amount_cents ?? 0)}
              </div>
            )}
            <p className='text-muted-foreground text-xs'>
              {stats?.monthly_count ?? 0} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total Donors</CardTitle>
            <Users className='text-muted-foreground h-4 w-4' />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className='h-7 w-24' />
            ) : (
              <div className='text-2xl font-bold'>{stats?.total_count ?? 0}</div>
            )}
            <p className='text-muted-foreground text-xs'>unique contributors</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent donations */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Donations</CardTitle>
          <CardDescription>The 20 most recent captured donations</CardDescription>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className='space-y-3'>
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className='h-10 w-full' />
              ))}
            </div>
          ) : !stats?.recent?.length ? (
            <p className='text-muted-foreground py-8 text-center text-sm'>
              No donations yet. Share your donate page to get started!
            </p>
          ) : (
            <div className='divide-y'>
              {stats.recent.map((d) => (
                <div
                  key={d.id}
                  className='flex items-center justify-between py-3'
                >
                  <div className='flex items-center gap-3'>
                    <div>
                      <p className='text-sm font-medium'>{d.donor_name}</p>
                      <div className='text-muted-foreground flex items-center gap-2 text-xs'>
                        <CalendarDays className='h-3 w-3' />
                        {formatDate(d.created_at)}
                        {d.event_id && (
                          <span className='text-blue-500'>• Linked to event</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className='flex items-center gap-2'>
                    {d.is_monthly && (
                      <Badge variant='secondary' className='text-xs'>
                        Monthly
                      </Badge>
                    )}
                    <span className='font-semibold'>{formatCents(d.amount_cents)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
