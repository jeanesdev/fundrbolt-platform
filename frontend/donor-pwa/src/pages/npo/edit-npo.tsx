/**
 * Edit NPO Page
 * Page for editing an existing non-profit organization (details + branding)
 */

import { NPOBrandingSection } from '@/components/npo/npo-branding-section'
import { NPOCreationForm } from '@/components/npo/npo-creation-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useNPOStore } from '@/stores/npo-store'
import type { NPOCreateRequest } from '@/types/npo'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { AlertCircle, ArrowLeft, Building2 } from 'lucide-react'
import { useEffect } from 'react'
import { toast } from 'sonner'

export default function EditNPOPage() {
  const { npoId } = useParams({ from: '/_authenticated/npos/$npoId/edit' })
  const navigate = useNavigate()
  const { currentNPO, nposLoading, nposError, loadNPOById, updateNPO } = useNPOStore()

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
      const errorMessage = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Failed to update organization'
      toast.error(errorMessage)
      throw error
    }
  }

  const handleBrandingSave = () => {
    // Reload NPO data to reflect branding changes
    loadNPOById(npoId)
  }

  // Loading state
  if (nposLoading && !currentNPO) {
    return (
      <div className="container mx-auto space-y-4 px-4 py-4 sm:space-y-6 sm:px-6 sm:py-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  // Error state
  if (nposError) {
    return (
      <div className="container mx-auto space-y-4 px-4 py-4 sm:space-y-6 sm:px-6 sm:py-6">
        <Card className="border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="mb-4 h-12 w-12 text-red-600 dark:text-red-400" />
            <h3 className="mb-2 text-lg font-semibold">Error Loading Organization</h3>
            <p className="mb-4 text-sm text-muted-foreground">{nposError}</p>
            <Link to="/npos">
              <Button>
                <ArrowLeft className="mr-2 h-4 w-4" />
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
      <div className="container mx-auto space-y-4 px-4 py-4 sm:space-y-6 sm:px-6 sm:py-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">Organization not found</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              The organization you're trying to edit doesn't exist or has been deleted.
            </p>
            <Link to="/npos">
              <Button>
                <ArrowLeft className="mr-2 h-4 w-4" />
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
    <div className="container mx-auto space-y-4 px-4 py-4 sm:space-y-6 sm:px-6 sm:py-6">
      {/* Page Header */}
      <div className="flex items-center gap-3 sm:gap-4">
        <Link to="/npos/$npoId" params={{ npoId }}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 sm:h-12 sm:w-12">
          <Building2 className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Edit Organization</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Update your organization's information and branding
          </p>
        </div>
      </div>

      {/* Info Card */}
      {currentNPO.status !== 'draft' && (
        <Card className="border-yellow-200 bg-yellow-50/50 dark:border-yellow-900 dark:bg-yellow-950/20">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Note</CardTitle>
            <CardDescription className="text-sm">
              This organization is currently <strong>{currentNPO.status.toUpperCase()}</strong>.
              Changes may require re-approval depending on your organization's policies.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Tabs for Details and Branding */}
      <Tabs defaultValue="details" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-6">
          <NPOCreationForm
            onSubmit={handleSubmit}
            isLoading={nposLoading}
            defaultValues={defaultValues}
            submitButtonText="Save"
          />
        </TabsContent>

        <TabsContent value="branding" className="mt-6">
          <NPOBrandingSection npoId={npoId} onSave={handleBrandingSave} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
