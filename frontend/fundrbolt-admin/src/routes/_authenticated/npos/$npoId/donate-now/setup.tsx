import { donateNowAdminApi } from '@/api/donateNow'
import { DonateNowConfigForm } from '@/components/donate-now/DonateNowConfigForm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useNpoContext } from '@/hooks/use-npo-context'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useParams } from '@tanstack/react-router'
import { Info, Settings } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/npos/$npoId/donate-now/setup')({
  component: DonateNowSetupPage,
})

function DonateNowSetupPage() {
  const { npoId: npoSlug } = useParams({ from: '/_authenticated/npos/$npoId/donate-now/setup' })
  const { availableNpos } = useNpoContext()
  // The URL param may be a slug (e.g. "hope-foundation") - resolve to UUID for API calls
  const npoId = availableNpos.find((n) => n.slug === npoSlug)?.id ?? npoSlug

  const { data: config, isLoading } = useQuery({
    queryKey: ['donate-now-config', npoId],
    queryFn: () => donateNowAdminApi.getConfig(npoId).then((r) => r.data),
  })

  if (isLoading) {
    return (
      <div className='space-y-4 p-6'>
        <Skeleton className='h-8 w-48' />
        <Skeleton className='h-64 w-full' />
      </div>
    )
  }

  if (!config) {
    return (
      <div className='p-6 text-center text-sm text-muted-foreground'>
        Failed to load configuration.
      </div>
    )
  }

  return (
    <div className='space-y-6 p-6'>
      <div>
        <h1 className='text-2xl font-bold'>Setup</h1>
        <p className='text-muted-foreground text-sm'>
          Configure your donation page appearance and content
        </p>
      </div>

      <Tabs defaultValue='general'>
        <TabsList>
          <TabsTrigger value='general'>
            <Settings className='mr-2 h-4 w-4' />
            General
          </TabsTrigger>
          <TabsTrigger value='npo-info'>
            <Info className='mr-2 h-4 w-4' />
            NPO Info
          </TabsTrigger>
        </TabsList>

        <TabsContent value='general' className='mt-4'>
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>
                Donation plea text, hero media, processing fee, and page defaults
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DonateNowConfigForm npoId={npoId} config={config} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='npo-info' className='mt-4'>
          <Card>
            <CardHeader>
              <CardTitle>NPO Information</CardTitle>
              <CardDescription>
                Text shown on the donation page describing your organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DonateNowConfigForm npoId={npoId} config={config} infoTab />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
