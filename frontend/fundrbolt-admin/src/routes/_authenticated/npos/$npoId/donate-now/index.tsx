import { donateNowAdminApi } from '@/api/donateNow'
import { DonateNowConfigForm } from '@/components/donate-now/DonateNowConfigForm'
import { DonationTierEditor } from '@/components/donate-now/DonationTierEditor'
import { SupportWallModerationTable } from '@/components/donate-now/SupportWallModerationTable'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate, useParams } from '@tanstack/react-router'
import { ArrowLeft, Heart } from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/npos/$npoId/donate-now/')({
  validateSearch: (search: Record<string, unknown>) => ({
    tab:
      search.tab === 'tiers' || search.tab === 'info' || search.tab === 'wall'
        ? search.tab
        : 'config',
  }),
  component: DonateNowConfigPage,
})

function DonateNowConfigPage() {
  const { npoId } = useParams({ from: '/_authenticated/npos/$npoId/donate-now/' })
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: config, isLoading } = useQuery({
    queryKey: ['donate-now-config', npoId],
    queryFn: () => donateNowAdminApi.getConfig(npoId).then((r) => r.data),
  })

  const { data: tiersData } = useQuery({
    queryKey: ['donate-now-tiers', npoId],
    queryFn: () => donateNowAdminApi.getTiers(npoId).then((r) => r.data),
  })

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      donateNowAdminApi.updateConfig(npoId, { is_enabled: enabled }).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.setQueryData(['donate-now-config', npoId], data)
      toast.success(data.is_enabled ? 'Donate Now page enabled' : 'Donate Now page disabled')
    },
    onError: () => toast.error('Failed to update setting'),
  })

  const handleTabChange = (tab: string) => {
    navigate({
      to: '/npos/$npoId/donate-now',
      params: { npoId },
      search: { tab: tab as 'config' | 'tiers' | 'info' | 'wall' },
      replace: true,
    })
  }

  if (isLoading) {
    return (
      <div className='container mx-auto space-y-4 px-4 py-6'>
        <Skeleton className='h-8 w-48' />
        <Skeleton className='h-64 w-full' />
      </div>
    )
  }

  return (
    <div className='container mx-auto space-y-6 px-4 py-6'>
      {/* Header */}
      <div className='flex items-center gap-4'>
        <Link to='/npos/$npoId' params={{ npoId }}>
          <Button variant='ghost' size='icon'>
            <ArrowLeft className='h-4 w-4' />
          </Button>
        </Link>
        <div className='flex flex-1 items-center gap-3'>
          <Heart className='h-6 w-6 text-rose-500' />
          <h1 className='text-2xl font-bold'>Donate Now Page</h1>
        </div>
        <div className='flex items-center gap-2'>
          <span className='text-sm text-muted-foreground'>
            {config?.is_enabled ? 'Enabled' : 'Disabled'}
          </span>
          <Switch
            checked={config?.is_enabled ?? false}
            onCheckedChange={(checked) => toggleMutation.mutate(checked)}
            disabled={toggleMutation.isPending}
          />
        </div>
      </div>

      <Tabs defaultValue='config' onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value='config'>General</TabsTrigger>
          <TabsTrigger value='tiers'>Donation Tiers</TabsTrigger>
          <TabsTrigger value='info'>NPO Info</TabsTrigger>
          <TabsTrigger value='wall'>Support Wall</TabsTrigger>
        </TabsList>

        <TabsContent value='config'>
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>
                Configure the hero media, plea text, and processing fee for your donate now page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {config && <DonateNowConfigForm npoId={npoId} config={config} />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='tiers'>
          <Card>
            <CardHeader>
              <CardTitle>Donation Tiers</CardTitle>
              <CardDescription>
                Set up to 10 suggested donation amounts. Donors can also enter a custom amount.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DonationTierEditor npoId={npoId} tiers={tiersData ?? []} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='info'>
          <Card>
            <CardHeader>
              <CardTitle>NPO Information Text</CardTitle>
              <CardDescription>
                Optional description shown to donors on the donate now page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {config && <DonateNowConfigForm npoId={npoId} config={config} infoTab />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='wall'>
          <SupportWallModerationTable npoId={npoId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
