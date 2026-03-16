/**
 * NPO Payment Settings Page
 *
 * T024 — Phase 3 (US1).
 *
 * Lets a Super Admin configure, test, and delete payment gateway credentials
 * for a specific NPO. Fetches existing credentials on mount and shows the
 * NpoCredentialForm in create or edit mode accordingly.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import {
  type CredentialRead,
  type CredentialResponse,
  isConfigured,
} from '@/types/payments'
import { ArrowLeft, CreditCard } from 'lucide-react'
import apiClient from '@/lib/axios'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { NpoCredentialForm } from '@/components/payments/NpoCredentialForm'

export default function NpoPaymentSettingsPage() {
  const { npoId } = useParams({
    from: '/_authenticated/npos/$npoId/payment-settings',
  })
  const queryClient = useQueryClient()

  // ── Fetch current credential state ───────────────────────────────────────

  const {
    data: credentialResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['npo-payment-credentials', npoId],
    queryFn: async () => {
      const res = await apiClient.get<CredentialResponse>(
        `/admin/npos/${npoId}/payment-credentials`
      )
      return res.data
    },
  })

  const existingCredential: CredentialRead | null =
    credentialResponse && isConfigured(credentialResponse)
      ? credentialResponse
      : null

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSaved = (updated: CredentialRead) => {
    queryClient.setQueryData(['npo-payment-credentials', npoId], updated)
  }

  const handleDeleted = () => {
    queryClient.setQueryData(['npo-payment-credentials', npoId], {
      npo_id: npoId,
      configured: false,
    })
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className='container mx-auto max-w-2xl space-y-6 py-6'>
      {/* Back navigation */}
      <div className='flex items-center gap-2'>
        <Link
          to='/npos/$npoId'
          params={{ npoId }}
          className='text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm'
        >
          <ArrowLeft className='h-4 w-4' />
          Back to NPO
        </Link>
      </div>

      {/* Page header */}
      <div className='flex items-center gap-3'>
        <div className='bg-primary/10 rounded-lg p-2'>
          <CreditCard className='text-primary h-6 w-6' />
        </div>
        <div>
          <h1 className='text-2xl font-bold'>Payment Settings</h1>
          <p className='text-muted-foreground text-sm'>
            Configure payment gateway credentials for this NPO
          </p>
        </div>
        {existingCredential && (
          <Badge
            variant={existingCredential.is_active ? 'default' : 'secondary'}
            className='ml-auto'
          >
            {existingCredential.is_live_mode ? '🔴 Live' : '🟡 Sandbox'}
          </Badge>
        )}
      </div>

      {/* Status indicator */}
      {!isLoading && credentialResponse && (
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
                  {new Date(credentialResponse.updated_at).toLocaleString()}
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

      {/* Loading skeleton */}
      {isLoading && (
        <div className='space-y-3'>
          <Skeleton className='h-8 w-48' />
          <Skeleton className='h-32 w-full' />
        </div>
      )}

      {/* Error state */}
      {error && (
        <Card className='border-destructive'>
          <CardContent className='pt-4'>
            <p className='text-destructive text-sm'>
              Failed to load payment credentials. Please try refreshing.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Credential form */}
      {!isLoading && !error && (
        <NpoCredentialForm
          npoId={npoId}
          existingCredential={existingCredential}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}
