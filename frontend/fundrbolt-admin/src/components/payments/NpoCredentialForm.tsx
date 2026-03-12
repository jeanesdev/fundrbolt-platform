/**
 * NpoCredentialForm — create/update/delete/test NPO payment gateway credentials.
 *
 * T023 — Phase 3 (US1).
 *
 * Used in the NPO payment settings page (T024). Supports both "create" mode (no
 * existing credentials) and "edit" mode (existing masked credentials shown).
 */
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import {
  type CredentialCreate,
  type CredentialRead,
  type CredentialTestResponse,
  type GatewayName,
} from '@/types/payments'
import { CheckCircle, Loader2, TestTube2, Trash2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import apiClient from '@/lib/axios'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { PasswordInput } from '@/components/password-input'

interface NpoCredentialFormProps {
  /** NPO UUID string */
  npoId: string
  /** Existing masked credentials when in edit mode; undefined/null for create mode */
  existingCredential?: CredentialRead | null
  /** Called after a successful create or update with the latest masked response */
  onSaved?: (cred: CredentialRead) => void
  /** Called after a successful delete */
  onDeleted?: () => void
}

interface FormValues {
  gateway_name: GatewayName
  merchant_id: string
  api_key: string
  api_secret: string
  gateway_id: string
  is_live_mode: boolean
}

export function NpoCredentialForm({
  npoId,
  existingCredential,
  onSaved,
  onDeleted,
}: NpoCredentialFormProps) {
  const isEditing = !!existingCredential

  const [testResult, setTestResult] = useState<CredentialTestResponse | null>(
    null
  )

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      gateway_name: existingCredential?.gateway_name ?? 'deluxe',
      merchant_id: '',
      api_key: '',
      api_secret: '',
      gateway_id: existingCredential?.gateway_id ?? '',
      is_live_mode: existingCredential?.is_live_mode ?? false,
    },
  })

  // Reset form when existingCredential changes (e.g. after save)
  useEffect(() => {
    reset({
      gateway_name: existingCredential?.gateway_name ?? 'deluxe',
      merchant_id: '',
      api_key: '',
      api_secret: '',
      gateway_id: existingCredential?.gateway_id ?? '',
      is_live_mode: existingCredential?.is_live_mode ?? false,
    })
  }, [existingCredential, reset])

  const isLiveMode = useWatch({ control, name: 'is_live_mode' })

  // ── Mutations ────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload: CredentialCreate = {
        gateway_name: values.gateway_name,
        merchant_id: values.merchant_id,
        api_key: values.api_key,
        api_secret: values.api_secret,
        gateway_id: values.gateway_id || null,
        is_live_mode: values.is_live_mode,
      }

      if (isEditing) {
        const res = await apiClient.put<CredentialRead>(
          `/admin/npos/${npoId}/payment-credentials`,
          payload
        )
        return res.data
      } else {
        const res = await apiClient.post<CredentialRead>(
          `/admin/npos/${npoId}/payment-credentials`,
          payload
        )
        return res.data
      }
    },
    onSuccess: (cred) => {
      toast.success(isEditing ? 'Credentials updated' : 'Credentials saved')
      setTestResult(null)
      onSaved?.(cred)
    },
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: string } } })
        .response?.data?.detail
      toast.error(
        detail ??
          (isEditing
            ? 'Failed to update credentials'
            : 'Failed to save credentials')
      )
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiClient.delete(`/admin/npos/${npoId}/payment-credentials`)
    },
    onSuccess: () => {
      toast.success('Credentials deleted')
      onDeleted?.()
    },
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: string } } })
        .response?.data?.detail
      toast.error(detail ?? 'Failed to delete credentials')
    },
  })

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<CredentialTestResponse>(
        `/admin/npos/${npoId}/payment-credentials/test`,
        {}
      )
      return res.data
    },
    onSuccess: (result) => {
      setTestResult(result)
      if (result.success) {
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
    },
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: string } } })
        .response?.data?.detail
      toast.error(detail ?? 'Test connection failed')
      setTestResult(null)
    },
  })

  const onSubmit = handleSubmit((values) => {
    saveMutation.mutate(values)
  })

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isEditing
            ? 'Update Payment Credentials'
            : 'Configure Payment Credentials'}
        </CardTitle>
        <CardDescription>
          {isEditing
            ? 'Enter new values to replace the existing credentials. Leave secret fields empty to keep current values — actually all fields must be provided (full replacement).'
            : 'Enter the Deluxe payment gateway credentials for this NPO. All values are encrypted before storage and never returned in plaintext.'}
        </CardDescription>
      </CardHeader>

      <form onSubmit={onSubmit}>
        <CardContent className='space-y-5'>
          {/* Gateway name */}
          <div className='grid gap-1.5'>
            <Label htmlFor='gateway_name'>Gateway</Label>
            <select
              id='gateway_name'
              {...register('gateway_name', { required: 'Gateway is required' })}
              className='border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm focus:ring-1 focus:outline-none'
            >
              <option value='deluxe'>Deluxe (First American)</option>
              <option value='stub'>Stub (Development / Testing)</option>
            </select>
            {errors.gateway_name && (
              <p className='text-destructive text-xs'>
                {errors.gateway_name.message}
              </p>
            )}
          </div>

          {/* Merchant ID */}
          <div className='grid gap-1.5'>
            <Label htmlFor='merchant_id'>
              Merchant ID
              {isEditing && existingCredential?.merchant_id_masked && (
                <span className='text-muted-foreground ml-2 text-xs font-normal'>
                  Current: {existingCredential.merchant_id_masked}
                </span>
              )}
            </Label>
            <PasswordInput
              id='merchant_id'
              placeholder={
                isEditing ? 'Enter new value to replace...' : 'MID-00012345'
              }
              {...register('merchant_id', {
                required: !isEditing || 'Merchant ID is required',
              })}
            />
            {errors.merchant_id && (
              <p className='text-destructive text-xs'>
                {errors.merchant_id.message}
              </p>
            )}
          </div>

          {/* API Key */}
          <div className='grid gap-1.5'>
            <Label htmlFor='api_key'>
              API Key
              {isEditing && existingCredential?.api_key_masked && (
                <span className='text-muted-foreground ml-2 text-xs font-normal'>
                  Current: {existingCredential.api_key_masked}
                </span>
              )}
            </Label>
            <PasswordInput
              id='api_key'
              placeholder={
                isEditing ? 'Enter new value to replace...' : 'ak_live_...'
              }
              {...register('api_key', { required: 'API key is required' })}
            />
            {errors.api_key && (
              <p className='text-destructive text-xs'>
                {errors.api_key.message}
              </p>
            )}
          </div>

          {/* API Secret */}
          <div className='grid gap-1.5'>
            <Label htmlFor='api_secret'>API Secret</Label>
            <PasswordInput
              id='api_secret'
              placeholder={
                isEditing ? 'Enter new value to replace...' : 'as_live_...'
              }
              {...register('api_secret', {
                required: 'API secret is required',
              })}
            />
            {errors.api_secret && (
              <p className='text-destructive text-xs'>
                {errors.api_secret.message}
              </p>
            )}
          </div>

          {/* Gateway ID (optional) */}
          <div className='grid gap-1.5'>
            <Label htmlFor='gateway_id'>
              Gateway ID
              <span className='text-muted-foreground ml-1 text-xs'>
                (optional)
              </span>
            </Label>
            <input
              id='gateway_id'
              type='text'
              placeholder='GW-001'
              {...register('gateway_id')}
              className='border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm focus:ring-1 focus:outline-none'
            />
          </div>

          {/* Live Mode toggle */}
          <div className='flex items-center justify-between rounded-lg border p-3'>
            <div className='space-y-0.5'>
              <Label htmlFor='is_live_mode' className='text-base'>
                Live Mode
              </Label>
              <p className='text-muted-foreground text-sm'>
                {isLiveMode
                  ? '⚠️ Live mode — real transactions will be processed'
                  : 'Sandbox mode — no real charges'}
              </p>
            </div>
            <Switch
              id='is_live_mode'
              checked={isLiveMode}
              onCheckedChange={(checked) => setValue('is_live_mode', checked)}
            />
          </div>

          {/* Test connection result */}
          {testResult && (
            <div
              className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
                testResult.success
                  ? 'border-green-200 bg-green-50 text-green-800'
                  : 'border-red-200 bg-red-50 text-red-800'
              }`}
            >
              {testResult.success ? (
                <CheckCircle className='mt-0.5 h-4 w-4 shrink-0 text-green-600' />
              ) : (
                <XCircle className='mt-0.5 h-4 w-4 shrink-0 text-red-600' />
              )}
              <div>
                <p className='font-medium'>
                  {testResult.success
                    ? 'Connection verified'
                    : 'Connection failed'}
                </p>
                <p>{testResult.message}</p>
                {testResult.latency_ms != null && (
                  <p className='text-xs opacity-70'>
                    Latency: {testResult.latency_ms}ms
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>

        <Separator />

        <CardFooter className='flex flex-wrap gap-2 pt-4'>
          {/* Save button */}
          <Button
            type='submit'
            disabled={isSubmitting || saveMutation.isPending}
          >
            {saveMutation.isPending && (
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
            )}
            {isEditing ? 'Update Credentials' : 'Save Credentials'}
          </Button>

          {/* Test connection button — only shown when credentials already exist */}
          {isEditing && (
            <Button
              type='button'
              variant='outline'
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
            >
              {testMutation.isPending ? (
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              ) : (
                <TestTube2 className='mr-2 h-4 w-4' />
              )}
              Test Connection
            </Button>
          )}

          {/* Delete button — only shown in edit mode */}
          {isEditing && (
            <Button
              type='button'
              variant='destructive'
              onClick={() => {
                if (
                  confirm(
                    'Delete payment credentials for this NPO? The NPO will no longer be able to collect payments.'
                  )
                ) {
                  deleteMutation.mutate()
                }
              }}
              disabled={deleteMutation.isPending}
              className='ml-auto'
            >
              {deleteMutation.isPending ? (
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              ) : (
                <Trash2 className='mr-2 h-4 w-4' />
              )}
              Delete Credentials
            </Button>
          )}
        </CardFooter>
      </form>
    </Card>
  )
}
