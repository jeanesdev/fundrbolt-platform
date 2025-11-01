/**
 * Create NPO Page
 * Page for creating a new non-profit organization
 */

import { NPOCreationForm } from '@/components/npo/npo-creation-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useNPOStore } from '@/stores/npo-store'
import type { NPOCreateRequest } from '@/types/npo'
import { useNavigate } from '@tanstack/react-router'
import { Building2 } from 'lucide-react'
import { toast } from 'sonner'

export default function CreateNPOPage() {
  const navigate = useNavigate()
  const { createNPO, nposLoading } = useNPOStore()

  const handleSubmit = async (data: NPOCreateRequest) => {
    try {
      const response = await createNPO(data)

      toast.success('Organization created successfully!', {
        description: `${response.name} has been created in DRAFT status.`,
      })

      // Navigate to NPO detail page
      navigate({ to: `/npos/${response.id}` })
    } catch (error: unknown) {
      // Extract error message from API response
      const errorMessage =
        error instanceof Error && 'response' in error && typeof error.response === 'object' && error.response !== null && 'data' in error.response && typeof error.response.data === 'object' && error.response.data !== null && 'detail' in error.response.data
          ? typeof error.response.data.detail === 'object' && error.response.data.detail !== null && 'message' in error.response.data.detail
            ? String(error.response.data.detail.message)
            : typeof error.response.data.detail === 'string'
              ? error.response.data.detail
              : 'Failed to create organization. Please try again.'
          : 'Failed to create organization. Please try again.'

      toast.error('Failed to create organization', {
        description: errorMessage,
      })
    }
  }

  return (
    <div className="container mx-auto space-y-6 py-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
          <Building2 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Organization</h1>
          <p className="text-muted-foreground">
            Set up your non-profit organization profile
          </p>
        </div>
      </div>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
        <CardHeader>
          <CardTitle className="text-lg">Getting Started</CardTitle>
          <CardDescription>
            Your organization will be created in <strong>DRAFT</strong> status. You can edit
            details at any time before submitting for approval.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
            <li>Only <strong>Name</strong> and <strong>Email</strong> are required to start</li>
            <li>You can add more details later from the organization dashboard</li>
            <li>You'll be automatically assigned as the organization admin</li>
            <li>Submit for approval when your profile is complete</li>
          </ul>
        </CardContent>
      </Card>

      {/* Creation Form */}
      <NPOCreationForm onSubmit={handleSubmit} isLoading={nposLoading} />
    </div>
  )
}
