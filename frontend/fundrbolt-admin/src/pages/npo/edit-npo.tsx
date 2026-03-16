/**
 * Edit NPO Page
 * Page for editing an existing non-profit organization (details + branding)
 */
import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import type { NPOCreateRequest } from '@/types/npo'
import {
  type CredentialRead,
  type CredentialResponse,
  isConfigured,
} from '@/types/payments'
import { AlertCircle, ArrowLeft, Building2, CreditCard } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { useNPOStore } from '@/stores/npo-store'
import apiClient from '@/lib/axios'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { NPOBrandingSection } from '@/components/npo/npo-branding-section'
import { NPOCreationForm } from '@/components/npo/npo-creation-form'
import { NpoCredentialForm } from '@/components/payments/NpoCredentialForm'

export default function EditNPOPage() {
  const { npoId } = useParams({ from: '/_authenticated/npos/$npoId/edit' })
  const search = useSearch({ from: '/_authenticated/npos/$npoId/edit' })
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const { currentNPO, nposLoading, nposError, loadNPOById, updateNPO } =
    useNPOStore()
  const showPaymentSettings = user?.role === 'super_admin'
  const activeTab =
    showPaymentSettings && search.tab === 'payments' ? 'payments' : search.tab

  const {
    data: credentialResponse,
    isLoading: paymentSettingsLoading,
    error: paymentSettingsError,
  } = useQuery({
    queryKey: ['npo-payment-credentials', npoId],
    queryFn: async () => {
      const res = await apiClient.get<CredentialResponse>(
        `/admin/npos/${npoId}/payment-credentials`
      )
      return res.data
    },
    enabled: showPaymentSettings,
  })

  const existingCredential: CredentialRead | null =
    credentialResponse && isConfigured(credentialResponse)
      ? credentialResponse
      : null

  useEffect(() => {
    if (npoId) {
      loadNPOById(npoId)
    }
  }, [npoId, loadNPOById])

  const handleSubmit = async (data: NPOCreateRequest) => {
    try {
      await updateNPO(npoId, data)
      toast.success('Organization updated successfully')
      navigate({ to: '/npos/$npoId', params: { npoId } })
    } catch (error: unknown) {
      const errorMessage =
        (error as { response?: { data?: { detail?: string } } }).response?.data
          ?.detail || 'Failed to update organization'
      toast.error(errorMessage)
      throw error
    }
  }

  const handleBrandingSave = () => {
    // Reload NPO data to reflect branding changes
    loadNPOById(npoId)
  }

  const handleTabChange = (tab: string) => {
    navigate({
      to: '/npos/$npoId/edit',
      params: { npoId },
      search: {
        tab: tab === 'branding' || tab === 'payments' ? tab : 'details',
      },
      replace: true,
    })
  }

  const handlePaymentSaved = (updated: CredentialRead) => {
    queryClient.setQueryData(['npo-payment-credentials', npoId], updated)
  }

  const handlePaymentDeleted = () => {
    queryClient.setQueryData(['npo-payment-credentials', npoId], {
      npo_id: npoId,
      configured: false,
    })
  }

  const handlePaymentSkip = () => {
    handleTabChange('details')
  }

  // Loading state
  if (nposLoading && !currentNPO) {
    return (
      <div className='container mx-auto space-y-4 px-4 py-4 sm:space-y-6 sm:px-6 sm:py-6'>
        <Skeleton className='h-12 w-64' />
        <Skeleton className='h-64 w-full' />
        <Skeleton className='h-96 w-full' />
      </div>
    )
  }

  // Error state
  if (nposError) {
    return (
      <div className='container mx-auto space-y-4 px-4 py-4 sm:space-y-6 sm:px-6 sm:py-6'>
        <Card className='border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20'>
          <CardContent className='flex flex-col items-center justify-center py-12'>
            <AlertCircle className='mb-4 h-12 w-12 text-red-600 dark:text-red-400' />
            <h3 className='mb-2 text-lg font-semibold'>
              Error Loading Organization
            </h3>
            <p className='text-muted-foreground mb-4 text-sm'>{nposError}</p>
            <Link to='/npos'>
              <Button>
                <ArrowLeft className='mr-2 h-4 w-4' />
                Back to Organizations
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Not found state
  if (!currentNPO) {
    return (
      <div className='container mx-auto space-y-4 px-4 py-4 sm:space-y-6 sm:px-6 sm:py-6'>
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12'>
            <Building2 className='text-muted-foreground mb-4 h-12 w-12' />
            <h3 className='mb-2 text-lg font-semibold'>
              Organization not found
            </h3>
            <p className='text-muted-foreground mb-4 text-sm'>
              The organization you're trying to edit doesn't exist or has been
              deleted.
            </p>
            <Link to='/npos'>
              <Button>
                <ArrowLeft className='mr-2 h-4 w-4' />
                Back to Organizations
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Parse address for form defaults
  const defaultValues = {
    name: currentNPO.name,
    email: currentNPO.email,
    tagline: currentNPO.tagline || undefined,
    description: currentNPO.description || undefined,
    mission_statement: currentNPO.mission_statement || undefined,
    tax_id: currentNPO.tax_id || undefined,
    registration_number: currentNPO.registration_number || undefined,
    website_url: currentNPO.website_url || undefined,
    phone: currentNPO.phone || undefined,
    address: currentNPO.address || undefined,
  }

  return (
    <div className='container mx-auto space-y-4 px-4 py-4 sm:space-y-6 sm:px-6 sm:py-6'>
      {/* Page Header */}
      <div className='flex items-center gap-3 sm:gap-4'>
        <Link to='/npos/$npoId' params={{ npoId }}>
          <Button variant='ghost' size='icon'>
            <ArrowLeft className='h-5 w-5' />
          </Button>
        </Link>
        <div className='bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg sm:h-12 sm:w-12'>
          <Building2 className='text-primary h-5 w-5 sm:h-6 sm:w-6' />
        </div>
        <div>
          <h1 className='text-2xl font-bold tracking-tight sm:text-3xl'>
            Edit Organization
          </h1>
          <p className='text-muted-foreground text-sm sm:text-base'>
            Update your organization's information, branding, and settings
          </p>
        </div>
      </div>

      {/* Info Card */}
      {currentNPO.status !== 'draft' && (
        <Card className='border-yellow-200 bg-yellow-50/50 dark:border-yellow-900 dark:bg-yellow-950/20'>
          <CardHeader>
            <CardTitle className='text-base sm:text-lg'>Note</CardTitle>
            <CardDescription className='text-sm'>
              This organization is currently{' '}
              <strong>{currentNPO.status.toUpperCase()}</strong>. Changes may
              require re-approval depending on your organization's policies.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Tabs for Details and Branding */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className='w-full'
      >
        <TabsList
          className={`grid w-full ${showPaymentSettings ? 'grid-cols-3' : 'grid-cols-2'}`}
        >
          <TabsTrigger value='details'>Details</TabsTrigger>
          <TabsTrigger value='branding'>Branding</TabsTrigger>
          {showPaymentSettings && (
            <TabsTrigger value='payments'>Payment Settings</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value='details' className='mt-6'>
          <NPOCreationForm
            onSubmit={handleSubmit}
            isLoading={nposLoading}
            defaultValues={defaultValues}
            submitButtonText='Save'
          />
        </TabsContent>

        <TabsContent value='branding' className='mt-6'>
          <NPOBrandingSection npoId={npoId} onSave={handleBrandingSave} />
        </TabsContent>

        {showPaymentSettings && (
          <TabsContent value='payments' className='mt-6 space-y-6'>
            <div className='flex items-center gap-3'>
              <div className='bg-primary/10 rounded-lg p-2'>
                <CreditCard className='text-primary h-5 w-5' />
              </div>
              <div>
                <h2 className='text-xl font-semibold'>Payment Settings</h2>
                <p className='text-muted-foreground text-sm'>
                  Configure payment gateway credentials for this organization.
                </p>
              </div>
              {existingCredential && (
                <Badge
                  variant={
                    existingCredential.is_active ? 'default' : 'secondary'
                  }
                  className='ml-auto'
                >
                  {existingCredential.is_live_mode ? '🔴 Live' : '🟡 Sandbox'}
                </Badge>
              )}
            </div>

            {!paymentSettingsLoading && credentialResponse && (
              <Card className='bg-muted/50'>
                <CardContent className='pt-4'>
                  {isConfigured(credentialResponse) ? (
                    <div className='space-y-1 text-sm'>
                      <p>
                        <span className='font-medium'>Gateway:</span>{' '}
                        {credentialResponse.gateway_name === 'deluxe'
                          ? 'Deluxe (First American)'
                          : 'Stub'}
                      </p>
                      <p>
                        <span className='font-medium'>Merchant ID:</span>{' '}
                        <code className='bg-background rounded px-1 py-0.5 font-mono text-xs'>
                          {credentialResponse.merchant_id_masked}
                        </code>
                      </p>
                      <p>
                        <span className='font-medium'>API Key:</span>{' '}
                        <code className='bg-background rounded px-1 py-0.5 font-mono text-xs'>
                          {credentialResponse.api_key_masked}
                        </code>
                      </p>
                      {credentialResponse.gateway_id && (
                        <p>
                          <span className='font-medium'>Gateway ID:</span>{' '}
                          {credentialResponse.gateway_id}
                        </p>
                      )}
                      <p className='text-muted-foreground text-xs'>
                        Last updated:{' '}
                        {new Date(
                          credentialResponse.updated_at
                        ).toLocaleString()}
                      </p>
                    </div>
                  ) : (
                    <p className='text-muted-foreground text-sm'>
                      No payment credentials configured for this NPO.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {paymentSettingsLoading && (
              <div className='space-y-3'>
                <Skeleton className='h-8 w-48' />
                <Skeleton className='h-32 w-full' />
              </div>
            )}

            {paymentSettingsError && (
              <Card className='border-destructive'>
                <CardContent className='pt-4'>
                  <p className='text-destructive text-sm'>
                    Failed to load payment credentials. Please try refreshing.
                  </p>
                </CardContent>
              </Card>
            )}

            {!paymentSettingsLoading && !paymentSettingsError && (
              <NpoCredentialForm
                npoId={npoId}
                existingCredential={existingCredential}
                onSaved={handlePaymentSaved}
                onDeleted={handlePaymentDeleted}
                onSkip={handlePaymentSkip}
              />
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
