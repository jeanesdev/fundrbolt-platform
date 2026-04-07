/**
 * NPO Detail Page
 * Displays detailed information about a specific NPO with edit and delete actions
 */
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import type { NPOApplication } from '@/types/npo'
import {
  type CredentialRead,
  type CredentialResponse,
  isConfigured,
} from '@/types/payments'
import { colors as brandColors } from '@fundrbolt/shared/assets'
import {
  ArrowLeft,
  Building2,
  Calendar,
  ClipboardCheck,
  CreditCard,
  Edit,
  Globe,
  Hash,
  Mail,
  MapPin,
  Phone,
  Trash2,
  Users,
} from 'lucide-react'
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
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ApplicationReviewDialog } from '@/components/admin/application-review-dialog'
import { ApplicationStatusBadge } from '@/components/npo/application-status-badge'
import { MemberList } from '@/features/npo-management/components/MemberList'
import { PendingInvitations } from '@/features/npo-management/components/PendingInvitations'
import { StaffInvitation } from '@/features/npo-management/components/StaffInvitation'

// Helper to get full logo URL
function getLogoUrl(logoPath: string | null): string | null {
  if (!logoPath) return null
  if (logoPath.startsWith('http://') || logoPath.startsWith('https://')) {
    return logoPath
  }
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'
  const baseUrl = apiUrl.replace(/\/api\/v1$/, '')
  return `${baseUrl}${logoPath}`
}

// Helper to format phone number
function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '')

  // Format as (XXX) XXX-XXXX for 10-digit US numbers
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }

  // Format as +X (XXX) XXX-XXXX for 11-digit numbers (with country code)
  if (cleaned.length === 11 && cleaned[0] === '1') {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
  }

  // Return original if doesn't match expected formats
  return phone
}

// Status color mapping
const statusColors = {
  draft: 'bg-gray-500',
  pending_approval: 'bg-yellow-500',
  approved: 'bg-green-500',
  suspended: 'bg-red-500',
  rejected: 'bg-red-700',
} as const

// Status label mapping
const statusLabels = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  suspended: 'Suspended',
  rejected: 'Rejected',
} as const

export default function NpoDetailPage() {
  const { npoId } = useParams({ from: '/_authenticated/npos/$npoId/' })
  const navigate = useNavigate()
  const { currentNPO, nposLoading, nposError, loadNPOById, deleteNPO } =
    useNPOStore()
  const user = useAuthStore((state) => state.user)
  const [showReviewDialog, setShowReviewDialog] = useState(false)
  const showPaymentSettings = user?.role === 'super_admin'

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

  const handleReviewComplete = async () => {
    setShowReviewDialog(false)
    // Reload the NPO to get updated status
    if (npoId) {
      await loadNPOById(npoId)
    }
  }

  const handleDelete = async () => {
    if (!npoId) return

    if (
      !confirm(
        'Are you sure you want to delete this organization? This action cannot be undone.'
      )
    ) {
      return
    }

    try {
      await deleteNPO(npoId)
      toast.success('Organization deleted successfully')
      navigate({ to: '/npos' })
    } catch (_error) {
      toast.error('Failed to delete organization')
    }
  }

  // Loading state
  if (nposLoading && !currentNPO) {
    return (
      <div className='container mx-auto space-y-4 px-2 py-3 sm:space-y-6 sm:px-6 sm:py-6'>
        <Skeleton className='h-12 w-64' />
        <Skeleton className='h-64 w-full' />
        <Skeleton className='h-64 w-full' />
      </div>
    )
  }

  // Error state
  if (nposError) {
    return (
      <div className='container mx-auto px-2 py-3 sm:px-6 sm:py-6'>
        <Card className='border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20'>
          <CardContent className='pt-6'>
            <p className='text-sm text-red-600 dark:text-red-400'>
              {nposError}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Not found state
  if (!currentNPO) {
    return (
      <div className='container mx-auto px-2 py-3 sm:px-6 sm:py-6'>
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12'>
            <Building2 className='text-muted-foreground mb-4 h-12 w-12' />
            <h3 className='mb-2 text-lg font-semibold'>
              Organization not found
            </h3>
            <p className='text-muted-foreground mb-4 text-sm'>
              The organization you're looking for doesn't exist or has been
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

  const npo = currentNPO

  return (
    <div className='container mx-auto space-y-4 px-2 py-3 sm:space-y-6 sm:px-6 sm:py-6'>
      {/* Header */}
      <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
        <div className='flex items-center gap-4'>
          <Link to='/npos'>
            <Button variant='ghost' size='icon'>
              <ArrowLeft className='h-5 w-5' />
            </Button>
          </Link>
          <div>
            <div className='flex items-center gap-3'>
              <h1 className='text-2xl font-bold tracking-tight md:text-3xl'>
                {npo.name}
              </h1>
              <Badge
                variant='secondary'
                className={`${statusColors[npo.status as keyof typeof statusColors]} text-white`}
              >
                {statusLabels[npo.status as keyof typeof statusLabels]}
              </Badge>
            </div>
            <p className='text-muted-foreground'>Organization Details</p>
          </div>
        </div>
        <div className='flex flex-wrap gap-2'>
          {/* Review button - only for super_admin when NPO is pending approval */}
          {user?.role === 'super_admin' &&
            npo.status === 'pending_approval' && (
              <Button
                onClick={() => setShowReviewDialog(true)}
                className='flex-1 md:flex-none'
              >
                <ClipboardCheck className='mr-2 h-4 w-4' />
                <span>Review Application</span>
              </Button>
            )}
          {user?.role === 'super_admin' && (
            <Link
              to='/npos/$npoId/payment-settings'
              params={{ npoId }}
              className='flex-1 md:flex-none'
            >
              <Button variant='outline' className='w-full'>
                <CreditCard className='mr-2 h-4 w-4' />
                <span>Payment Settings</span>
              </Button>
            </Link>
          )}
          <Link
            to='/npos/$npoId/edit'
            params={{ npoId }}
            search={{ tab: 'details' }}
            className='flex-1 md:flex-none'
          >
            <Button variant='outline' className='w-full'>
              <Edit className='mr-2 h-4 w-4' />
            </Button>
          </Link>
          <Button
            variant='destructive'
            onClick={handleDelete}
            className='flex-1 md:flex-none'
          >
            <Trash2 className='mr-2 h-4 w-4' />
            <span>Delete</span>
          </Button>
        </div>
      </div>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Core organization details</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          {/* Application Status Badge (only for draft NPOs) */}
          <ApplicationStatusBadge
            npo={npo}
            onApplicationSubmitted={() => loadNPOById(npoId)}
          />

          {npo.status === 'draft' && <Separator />}

          <div className='grid gap-4 md:grid-cols-2'>
            <div className='space-y-2'>
              <div className='text-muted-foreground flex items-center gap-2 text-sm font-medium'>
                <Building2 className='h-4 w-4' />
                Organization Name
              </div>
              <p className='text-sm'>{npo.name}</p>
            </div>

            <div className='space-y-2'>
              <div className='text-muted-foreground flex items-center gap-2 text-sm font-medium'>
                <Mail className='h-4 w-4' />
                Email
              </div>
              <p className='text-sm'>{npo.email}</p>
            </div>

            {npo.phone && (
              <div className='space-y-2'>
                <div className='text-muted-foreground flex items-center gap-2 text-sm font-medium'>
                  <Phone className='h-4 w-4' />
                  Phone
                </div>
                <p className='text-sm'>{formatPhoneNumber(npo.phone)}</p>
              </div>
            )}

            {npo.tax_id && (
              <div className='space-y-2'>
                <div className='text-muted-foreground flex items-center gap-2 text-sm font-medium'>
                  <Building2 className='h-4 w-4' />
                  Tax ID (EIN)
                </div>
                <p className='text-sm'>{npo.tax_id}</p>
              </div>
            )}

            {npo.registration_number && (
              <div className='space-y-2'>
                <div className='text-muted-foreground flex items-center gap-2 text-sm font-medium'>
                  <Building2 className='h-4 w-4' />
                  Registration Number
                </div>
                <p className='text-sm'>{npo.registration_number}</p>
              </div>
            )}

            {npo.website_url && (
              <div className='space-y-2'>
                <div className='text-muted-foreground flex items-center gap-2 text-sm font-medium'>
                  <Globe className='h-4 w-4' />
                  Website
                </div>
                <a
                  href={npo.website_url}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-primary text-sm hover:underline'
                >
                  {npo.website_url}
                </a>
              </div>
            )}

            {npo.hashtag && (
              <div className='space-y-2'>
                <div className='text-muted-foreground flex items-center gap-2 text-sm font-medium'>
                  <Hash className='h-4 w-4' />
                  Hashtag
                </div>
                <p className='text-sm font-medium'>{npo.hashtag}</p>
              </div>
            )}

            <div className='space-y-2'>
              <div className='text-muted-foreground flex items-center gap-2 text-sm font-medium'>
                <Users className='h-4 w-4' />
                Members
              </div>
              <p className='text-sm'>
                {npo.active_member_count || 0} active / {npo.member_count || 0}{' '}
                total
              </p>
            </div>

            <div className='space-y-2'>
              <div className='text-muted-foreground flex items-center gap-2 text-sm font-medium'>
                <Calendar className='h-4 w-4' />
                Created
              </div>
              <p className='text-sm'>
                {new Date(npo.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          <Separator />

          {npo.description && (
            <div className='space-y-2'>
              <p className='text-muted-foreground text-sm font-medium'>
                Description
              </p>
              <p className='text-sm'>{npo.description}</p>
            </div>
          )}

          {npo.mission_statement && (
            <div className='space-y-2'>
              <p className='text-muted-foreground text-sm font-medium'>
                Mission Statement
              </p>
              <p className='text-sm'>{npo.mission_statement}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {showPaymentSettings && (
        <Card>
          <CardHeader>
            <div className='flex items-start justify-between gap-4'>
              <div>
                <CardTitle className='flex items-center gap-2'>
                  <CreditCard className='h-5 w-5' />
                  Payment Settings
                </CardTitle>
                <CardDescription>
                  Current payment gateway configuration for this organization
                </CardDescription>
              </div>
              <Link
                to='/npos/$npoId/edit'
                params={{ npoId }}
                search={{ tab: 'payments' }}
              >
                <Button variant='outline' size='sm'>
                  Manage
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {paymentSettingsLoading && (
              <div className='space-y-3'>
                <Skeleton className='h-5 w-40' />
                <Skeleton className='h-16 w-full' />
              </div>
            )}

            {!paymentSettingsLoading && paymentSettingsError && (
              <p className='text-destructive text-sm'>
                Failed to load payment settings.
              </p>
            )}

            {!paymentSettingsLoading &&
              !paymentSettingsError &&
              credentialResponse &&
              (isConfigured(credentialResponse) ? (
                <div className='space-y-4'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <Badge
                      variant={
                        existingCredential?.is_active ? 'default' : 'secondary'
                      }
                    >
                      {existingCredential?.is_live_mode ? 'Live' : 'Sandbox'}
                    </Badge>
                    <Badge variant='outline'>Configured</Badge>
                  </div>

                  <div className='grid gap-4 md:grid-cols-2'>
                    <div className='space-y-2'>
                      <p className='text-muted-foreground text-sm font-medium'>
                        Gateway
                      </p>
                      <p className='text-sm'>
                        {credentialResponse.gateway_name === 'deluxe'
                          ? 'Deluxe (First American)'
                          : 'Stub'}
                      </p>
                    </div>

                    <div className='space-y-2'>
                      <p className='text-muted-foreground text-sm font-medium'>
                        Merchant ID
                      </p>
                      <code className='bg-muted rounded px-2 py-1 font-mono text-xs'>
                        {credentialResponse.merchant_id_masked}
                      </code>
                    </div>

                    <div className='space-y-2'>
                      <p className='text-muted-foreground text-sm font-medium'>
                        API Key
                      </p>
                      <code className='bg-muted rounded px-2 py-1 font-mono text-xs'>
                        {credentialResponse.api_key_masked}
                      </code>
                    </div>

                    {credentialResponse.gateway_id && (
                      <div className='space-y-2'>
                        <p className='text-muted-foreground text-sm font-medium'>
                          Gateway ID
                        </p>
                        <p className='text-sm'>
                          {credentialResponse.gateway_id}
                        </p>
                      </div>
                    )}
                  </div>

                  <p className='text-muted-foreground text-xs'>
                    Last updated{' '}
                    {new Date(credentialResponse.updated_at).toLocaleString()}
                  </p>
                </div>
              ) : (
                <div className='space-y-3'>
                  <Badge variant='secondary'>Not Configured</Badge>
                  <p className='text-muted-foreground text-sm'>
                    No payment credentials are configured for this organization
                    yet.
                  </p>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Team Management */}
      <Card>
        <CardHeader>
          <CardTitle>Team Management</CardTitle>
          <CardDescription>
            Manage organization members and invitations
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          <StaffInvitation npoId={npoId} />
          <Separator />
          <PendingInvitations npoId={npoId} />
          <Separator />
          <div className='space-y-4'>
            <h3 className='text-lg font-semibold'>Current Members</h3>
            <MemberList npoId={npoId} canManageMembers={true} />
          </div>
        </CardContent>
      </Card>

      {/* Branding */}
      {npo.branding && (
        <Card>
          <CardHeader>
            <CardTitle>Branding</CardTitle>
            <CardDescription>Organization colors and logo</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            {/* Logo */}
            {npo.branding.logo_url && (
              <div className='space-y-2'>
                <p className='text-muted-foreground text-sm font-medium'>
                  Logo
                </p>
                <div className='flex items-center gap-4'>
                  <img
                    src={getLogoUrl(npo.branding.logo_url) || undefined}
                    alt={`${npo.name} logo`}
                    className='h-24 w-24 rounded-lg border object-contain p-2'
                    style={{
                      backgroundColor:
                        npo.branding.background_color ||
                        brandColors.secondary.white,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Colors */}
            <div className='space-y-2'>
              <p className='text-muted-foreground text-sm font-medium'>
                Brand Colors
              </p>
              <div className='flex flex-wrap gap-4'>
                {npo.branding.primary_color && (
                  <div className='flex items-center gap-2'>
                    <div
                      className='h-10 w-10 rounded-lg border'
                      style={{ backgroundColor: npo.branding.primary_color }}
                    />
                    <div>
                      <p className='text-xs font-medium'>Primary</p>
                      <p className='text-muted-foreground font-mono text-xs'>
                        {npo.branding.primary_color}
                      </p>
                    </div>
                  </div>
                )}

                {npo.branding.secondary_color && (
                  <div className='flex items-center gap-2'>
                    <div
                      className='h-10 w-10 rounded-lg border'
                      style={{ backgroundColor: npo.branding.secondary_color }}
                    />
                    <div>
                      <p className='text-xs font-medium'>Secondary</p>
                      <p className='text-muted-foreground font-mono text-xs'>
                        {npo.branding.secondary_color}
                      </p>
                    </div>
                  </div>
                )}

                {npo.branding.background_color && (
                  <div className='flex items-center gap-2'>
                    <div
                      className='h-10 w-10 rounded-lg border'
                      style={{ backgroundColor: npo.branding.background_color }}
                    />
                    <div>
                      <p className='text-xs font-medium'>Background</p>
                      <p className='text-muted-foreground font-mono text-xs'>
                        {npo.branding.background_color}
                      </p>
                    </div>
                  </div>
                )}

                {npo.branding.accent_color && (
                  <div className='flex items-center gap-2'>
                    <div
                      className='h-10 w-10 rounded-lg border'
                      style={{ backgroundColor: npo.branding.accent_color }}
                    />
                    <div>
                      <p className='text-xs font-medium'>Accent</p>
                      <p className='text-muted-foreground font-mono text-xs'>
                        {npo.branding.accent_color}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Social Media Links */}
            {npo.branding.social_media_links &&
              Object.values(npo.branding.social_media_links).some(
                (link) => link
              ) && (
                <div className='space-y-2'>
                  <p className='text-muted-foreground text-sm font-medium'>
                    Social Media
                  </p>
                  <div className='flex flex-wrap gap-2'>
                    {npo.branding.social_media_links.facebook && (
                      <a
                        href={npo.branding.social_media_links.facebook}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='text-primary inline-flex items-center gap-1 text-sm hover:underline'
                      >
                        Facebook
                      </a>
                    )}
                    {npo.branding.social_media_links.twitter && (
                      <a
                        href={npo.branding.social_media_links.twitter}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='text-primary inline-flex items-center gap-1 text-sm hover:underline'
                      >
                        Twitter
                      </a>
                    )}
                    {npo.branding.social_media_links.instagram && (
                      <a
                        href={npo.branding.social_media_links.instagram}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='text-primary inline-flex items-center gap-1 text-sm hover:underline'
                      >
                        Instagram
                      </a>
                    )}
                    {npo.branding.social_media_links.linkedin && (
                      <a
                        href={npo.branding.social_media_links.linkedin}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='text-primary inline-flex items-center gap-1 text-sm hover:underline'
                      >
                        LinkedIn
                      </a>
                    )}
                  </div>
                </div>
              )}
          </CardContent>
        </Card>
      )}

      {/* Legal Information */}
      {(npo.tax_id || npo.registration_number) && (
        <Card>
          <CardHeader>
            <CardTitle>Legal Information</CardTitle>
            <CardDescription>Tax and registration details</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='grid gap-4 md:grid-cols-2'>
              {npo.tax_id && (
                <div className='space-y-2'>
                  <p className='text-muted-foreground text-sm font-medium'>
                    Tax ID (EIN)
                  </p>
                  <p className='font-mono text-sm'>{npo.tax_id}</p>
                </div>
              )}

              {npo.registration_number && (
                <div className='space-y-2'>
                  <p className='text-muted-foreground text-sm font-medium'>
                    Registration Number
                  </p>
                  <p className='font-mono text-sm'>{npo.registration_number}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Address */}
      {npo.address && (
        <Card>
          <CardHeader>
            <CardTitle>Address</CardTitle>
            <CardDescription>Physical location</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='flex items-start gap-2'>
              <MapPin className='text-muted-foreground mt-1 h-4 w-4' />
              <div className='space-y-1 text-sm'>
                {npo.address.street && <p>{npo.address.street}</p>}
                <p>
                  {[
                    npo.address.city,
                    npo.address.state,
                    npo.address.postal_code,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </p>
                {npo.address.country && <p>{npo.address.country}</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Application Status (if exists) */}
      {npo.application && (
        <Card>
          <CardHeader>
            <CardTitle>Application Status</CardTitle>
            <CardDescription>Current approval application</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='grid gap-4 md:grid-cols-2'>
              <div className='space-y-2'>
                <p className='text-muted-foreground text-sm font-medium'>
                  Status
                </p>
                <Badge>
                  {npo.application.status.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>

              <div className='space-y-2'>
                <p className='text-muted-foreground text-sm font-medium'>
                  Submitted
                </p>
                <p className='text-sm'>
                  {new Date(npo.application.submitted_at).toLocaleDateString()}
                </p>
              </div>

              {npo.application.reviewed_at && (
                <>
                  <div className='space-y-2'>
                    <p className='text-muted-foreground text-sm font-medium'>
                      Reviewed
                    </p>
                    <p className='text-sm'>
                      {new Date(
                        npo.application.reviewed_at
                      ).toLocaleDateString()}
                    </p>
                  </div>

                  {npo.application.review_notes &&
                    Object.keys(npo.application.review_notes).length > 0 && (
                      <div className='col-span-2 space-y-2'>
                        <p className='text-muted-foreground text-sm font-medium'>
                          Review Notes
                        </p>
                        <div className='space-y-1'>
                          {Object.entries(npo.application.review_notes).map(
                            ([key, value]) => (
                              <p key={key} className='text-sm'>
                                <span className='font-medium'>{key}:</span>{' '}
                                {value}
                              </p>
                            )
                          )}
                        </div>
                      </div>
                    )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Review Dialog */}
      {showReviewDialog && currentNPO && (
        <ApplicationReviewDialog
          application={
            {
              id: currentNPO.id,
              npo_id: currentNPO.id,
              status: 'submitted',
              npo_name: currentNPO.name,
              npo_email: currentNPO.email,
              submitted_at: currentNPO.created_at,
              created_at: currentNPO.created_at,
              updated_at: currentNPO.updated_at,
            } as NPOApplication
          }
          open={showReviewDialog}
          onClose={() => setShowReviewDialog(false)}
          onReviewComplete={handleReviewComplete}
        />
      )}
    </div>
  )
}
