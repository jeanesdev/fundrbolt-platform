import { useRef, useState, type ChangeEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useParams } from '@tanstack/react-router'
import { eventApi } from '@/services/event-service'
import { ExternalLink, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import {
  donateNowAdminApi,
  type DonateNowConfigResponse,
  type DonateNowConfigUpdate,
  type DonationTierResponse,
} from '@/api/donateNow'
import apiClient from '@/lib/axios'
import { getDonorPwaUrl } from '@/lib/donor-portal'
import { useEventContext } from '@/hooks/use-event-context'
import { useNpoContext } from '@/hooks/use-npo-context'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { DonationTierEditor } from '@/components/donate-now/DonationTierEditor'

export const Route = createFileRoute(
  '/_authenticated/npos/$npoId/donate-now/setup'
)({
  component: DonateNowSetupPage,
})

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface CardProps {
  npoId: string
  config: DonateNowConfigResponse
}

interface NpoListItem {
  id: string
  slug?: string | null
}

function DonateNowSetupPage() {
  const { npoId: npoParam } = useParams({
    from: '/_authenticated/npos/$npoId/donate-now/setup',
  })
  const { availableNpos } = useNpoContext()
  const {
    selectedEventId,
    availableEvents,
    isLoading: isEventsLoading,
  } = useEventContext()

  const isUuid = UUID_PATTERN.test(npoParam)

  const selectedEvent = selectedEventId
    ? availableEvents.find((event) => event.id === selectedEventId)
    : undefined

  const {
    data: selectedEventDetail,
    isPending: isSelectedEventDetailPending,
    isError: isSelectedEventDetailError,
  } = useQuery({
    queryKey: ['event-detail-for-donate-now', selectedEventId],
    queryFn: () => eventApi.getEvent(selectedEventId as string),
    enabled: !isUuid && !!selectedEventId && !selectedEvent?.npo_id,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  })

  const npoIdFromEvent = selectedEvent?.npo_id ?? selectedEventDetail?.npo_id

  const isWaitingForEventResolution =
    !isUuid &&
    !npoIdFromEvent &&
    (isEventsLoading || (!!selectedEventId && isSelectedEventDetailPending))

  const { data: nposList, isPending: isNposListPending } = useQuery({
    queryKey: ['npos-resolve-slug'],
    queryFn: async () => {
      const response = await apiClient.get('/npos')
      return (response.data.items as NpoListItem[]) || []
    },
    enabled:
      !isUuid &&
      !npoIdFromEvent &&
      !isWaitingForEventResolution &&
      (!selectedEventId || isSelectedEventDetailError),
    retry: 1,
    staleTime: 5 * 60 * 1000,
  })

  const resolvedNpoId = isUuid
    ? npoParam
    : (npoIdFromEvent ??
      availableNpos.find((n) => n.slug === npoParam)?.id ??
      nposList?.find((n) => n.slug === npoParam)?.id ??
      null)

  const resolvedNpoSlug = isUuid
    ? (availableNpos.find((n) => n.id === npoParam)?.slug ??
      nposList?.find((n) => n.id === npoParam)?.slug ??
      null)
    : npoIdFromEvent
      ? (availableNpos.find((n) => n.id === npoIdFromEvent)?.slug ??
        nposList?.find((n) => n.id === npoIdFromEvent)?.slug ??
        null)
      : npoParam

  const { data: config, isLoading } = useQuery({
    queryKey: ['donate-now-config', resolvedNpoId],
    queryFn: () =>
      donateNowAdminApi.getConfig(resolvedNpoId as string).then((r) => r.data),
    enabled: !!resolvedNpoId,
  })

  const { data: tiers, isLoading: isTiersLoading } = useQuery({
    queryKey: ['donate-now-tiers', resolvedNpoId],
    queryFn: () =>
      donateNowAdminApi.getTiers(resolvedNpoId as string).then((r) => r.data),
    enabled: !!resolvedNpoId,
  })

  const isResolvingSlug = !isUuid && !resolvedNpoId && isNposListPending

  if (isWaitingForEventResolution || isResolvingSlug || isLoading) {
    return (
      <div className='space-y-4 p-6'>
        <Skeleton className='h-8 w-48' />
        <Skeleton className='h-64 w-full' />
        <Skeleton className='h-48 w-full' />
      </div>
    )
  }

  if (!resolvedNpoId) {
    return (
      <div className='space-y-3 p-6 text-center'>
        <p className='text-muted-foreground text-sm'>
          Could not resolve organization. Please go back and try again.
        </p>
      </div>
    )
  }

  if (!config) {
    return (
      <div className='text-muted-foreground p-6 text-center text-sm'>
        Failed to load configuration.
      </div>
    )
  }

  const openPreview = (
    previewUrl: string
  ): 'popup' | 'same-tab' | 'new-tab' => {
    const isMobileViewport = window.matchMedia('(max-width: 768px)').matches

    if (isMobileViewport) {
      window.location.assign(previewUrl)
      return 'same-tab'
    }

    const popup = window.open(
      previewUrl,
      'donate-now-preview',
      'width=393,height=852,scrollbars=yes,resizable=yes'
    )

    if (!popup) {
      window.open(previewUrl, '_blank', 'noopener,noreferrer')
      return 'new-tab'
    }

    popup.focus()
    return 'popup'
  }

  const handlePreview = () => {
    if (!resolvedNpoSlug) {
      toast.error(
        'Preview is not ready yet. Please wait for organization context to load.'
      )
      return
    }

    const donorPwaUrl = getDonorPwaUrl()
    const previewUrl = `${donorPwaUrl}/npo/${encodeURIComponent(resolvedNpoSlug)}/donate-now`
    const openMode = openPreview(previewUrl)

    if (openMode === 'popup') {
      toast.success('Opened donor preview in a new window.')
    } else if (openMode === 'same-tab') {
      toast.success('Opening donor preview in this tab.')
    } else {
      toast.success('Opened donor preview in a new tab.')
    }
  }

  return (
    <div className='space-y-6 p-6'>
      <div className='flex items-start justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold'>Setup</h1>
          <p className='text-muted-foreground text-sm'>
            Configure your donation page appearance and content
          </p>
        </div>
        <Button variant='outline' onClick={handlePreview}>
          <ExternalLink className='mr-2 h-4 w-4' />
          Open donor preview
        </Button>
      </div>

      <GeneralSettingsCard npoId={resolvedNpoId} config={config} />
      <BrandingCard npoId={resolvedNpoId} config={config} />
      <NpoInfoCard npoId={resolvedNpoId} config={config} />
      <GivingLevelsCard
        tiers={tiers ?? []}
        isLoading={isTiersLoading}
        npoId={resolvedNpoId}
      />
    </div>
  )
}

interface GivingLevelsCardProps {
  npoId: string
  tiers: DonationTierResponse[]
  isLoading: boolean
}

function GivingLevelsCard({ npoId, tiers, isLoading }: GivingLevelsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Giving Levels</CardTitle>
        <CardDescription>
          Configure donation amounts and impact statements shown to donors.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className='space-y-3'>
            <Skeleton className='h-16 w-full' />
            <Skeleton className='h-16 w-full' />
            <Skeleton className='h-10 w-40' />
          </div>
        ) : (
          <DonationTierEditor npoId={npoId} tiers={tiers} />
        )}
      </CardContent>
    </Card>
  )
}

function GeneralSettingsCard({ npoId, config }: CardProps) {
  const queryClient = useQueryClient()
  const [pleaText, setPleaText] = useState(config.donate_plea_text ?? '')
  const [isEnabled, setIsEnabled] = useState(config.is_enabled)
  const [feePercent, setFeePercent] = useState(
    (parseFloat(config.processing_fee_pct) * 100).toFixed(2)
  )

  const saveMutation = useMutation({
    mutationFn: (data: DonateNowConfigUpdate) =>
      donateNowAdminApi.updateConfig(npoId, data).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.setQueryData(['donate-now-config', npoId], data)
      toast.success('General settings saved')
    },
    onError: () => toast.error('Failed to save settings'),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>General Settings</CardTitle>
        <CardDescription>
          Control page availability and core donation settings
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-6'>
        <div className='flex items-center gap-3'>
          <Switch
            id='is-enabled'
            checked={isEnabled}
            onCheckedChange={setIsEnabled}
          />
          <Label htmlFor='is-enabled'>Page enabled (visible to donors)</Label>
        </div>

        <div className='space-y-2'>
          <Label htmlFor='plea-text'>Donation Plea Text</Label>
          <Textarea
            id='plea-text'
            value={pleaText}
            onChange={(e) => setPleaText(e.target.value)}
            placeholder='Help us make a difference today...'
            rows={3}
            maxLength={500}
          />
        </div>

        <div className='space-y-2'>
          <Label htmlFor='fee-pct'>Processing Fee Passed to Donor (%)</Label>
          <Input
            id='fee-pct'
            type='number'
            step='0.01'
            min='0'
            max='100'
            value={feePercent}
            onChange={(e) => setFeePercent(e.target.value)}
            className='w-32'
          />
          <p className='text-muted-foreground text-xs'>
            When the donor opts to cover fees, this % is added to their total.
          </p>
        </div>

        <Button
          onClick={() =>
            saveMutation.mutate({
              is_enabled: isEnabled,
              donate_plea_text: pleaText || null,
              processing_fee_pct: (parseFloat(feePercent) / 100).toFixed(4),
            })
          }
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending && (
            <Loader2 className='mr-2 h-4 w-4 animate-spin' />
          )}
          Save General Settings
        </Button>
      </CardContent>
    </Card>
  )
}

function BrandingCard({ npoId, config }: CardProps) {
  const queryClient = useQueryClient()
  const [primaryColor, setPrimaryColor] = useState(
    config.brand_color_primary ?? ''
  )
  const [secondaryColor, setSecondaryColor] = useState(
    config.brand_color_secondary ?? ''
  )
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const npoPrimary = config.npo_brand_color_primary
  const npoSecondary = config.npo_brand_color_secondary
  const pageLogoUrl = config.page_logo_url
  const fallbackNpoLogoUrl = config.npo_brand_logo_url
  const effectiveLogoUrl = pageLogoUrl || fallbackNpoLogoUrl || null

  const saveMutation = useMutation({
    mutationFn: (data: DonateNowConfigUpdate) =>
      donateNowAdminApi.updateConfig(npoId, data).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.setQueryData(['donate-now-config', npoId], data)
      toast.success('Branding saved')
    },
    onError: () => toast.error('Failed to save branding'),
  })

  const handleLogoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(true)
    try {
      const { data } = await donateNowAdminApi.uploadPageLogo(npoId, file)
      queryClient.setQueryData(['donate-now-config', npoId], data)
      toast.success('Logo uploaded')
    } catch {
      toast.error('Logo upload failed')
    } finally {
      setUploadingLogo(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  const effectivePrimary = primaryColor || npoPrimary || '#000000'
  const effectiveSecondary = secondaryColor || npoSecondary || '#000000'

  return (
    <Card>
      <CardHeader>
        <CardTitle>Branding</CardTitle>
        <CardDescription>
          Page colors and logo. Leave colors blank to inherit from your NPO
          branding.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-6'>
        <div className='space-y-2'>
          <Label>Page Logo</Label>
          <p className='text-muted-foreground text-xs'>
            Small square logo shown in the donate-now page header (max 2 MB,
            JPEG/PNG/WebP).
          </p>
          {!pageLogoUrl && fallbackNpoLogoUrl && (
            <p className='text-muted-foreground text-xs'>
              Using your NPO logo by default until you upload a page-specific
              logo.
            </p>
          )}
          <div className='flex items-center gap-4'>
            {effectiveLogoUrl ? (
              <img
                src={effectiveLogoUrl}
                alt='Page logo'
                className='h-16 w-16 rounded-md border object-contain'
              />
            ) : (
              <div className='bg-muted text-muted-foreground flex h-16 w-16 items-center justify-center rounded-md border text-xs'>
                None
              </div>
            )}
            <Button
              variant='outline'
              onClick={() => logoInputRef.current?.click()}
              disabled={uploadingLogo}
            >
              {uploadingLogo ? (
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              ) : (
                <Upload className='mr-2 h-4 w-4' />
              )}
              {effectiveLogoUrl ? 'Replace Logo' : 'Upload Logo'}
            </Button>
            <input
              ref={logoInputRef}
              type='file'
              accept='image/jpeg,image/png,image/webp'
              className='hidden'
              onChange={handleLogoUpload}
            />
          </div>
        </div>

        <div className='space-y-2'>
          <Label htmlFor='color-primary'>Primary Color</Label>
          {!primaryColor && npoPrimary && (
            <p className='text-muted-foreground text-xs'>
              Using NPO default: <span className='font-mono'>{npoPrimary}</span>
            </p>
          )}
          <div className='flex items-center gap-3'>
            <input
              id='color-primary'
              type='color'
              value={effectivePrimary}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className='h-10 w-16 cursor-pointer rounded border p-1'
            />
            <Input
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              placeholder={npoPrimary ?? '#000000'}
              className='w-36 font-mono'
              maxLength={7}
            />
            {primaryColor && (
              <Button
                variant='ghost'
                size='sm'
                onClick={() => setPrimaryColor('')}
              >
                Reset to NPO default
              </Button>
            )}
          </div>
        </div>

        <div className='space-y-2'>
          <Label htmlFor='color-secondary'>Secondary Color</Label>
          {!secondaryColor && npoSecondary && (
            <p className='text-muted-foreground text-xs'>
              Using NPO default:{' '}
              <span className='font-mono'>{npoSecondary}</span>
            </p>
          )}
          <div className='flex items-center gap-3'>
            <input
              id='color-secondary'
              type='color'
              value={effectiveSecondary}
              onChange={(e) => setSecondaryColor(e.target.value)}
              className='h-10 w-16 cursor-pointer rounded border p-1'
            />
            <Input
              value={secondaryColor}
              onChange={(e) => setSecondaryColor(e.target.value)}
              placeholder={npoSecondary ?? '#000000'}
              className='w-36 font-mono'
              maxLength={7}
            />
            {secondaryColor && (
              <Button
                variant='ghost'
                size='sm'
                onClick={() => setSecondaryColor('')}
              >
                Reset to NPO default
              </Button>
            )}
          </div>
        </div>

        <Button
          onClick={() =>
            saveMutation.mutate({
              brand_color_primary: primaryColor || null,
              brand_color_secondary: secondaryColor || null,
            })
          }
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending && (
            <Loader2 className='mr-2 h-4 w-4 animate-spin' />
          )}
          Save Branding
        </Button>
      </CardContent>
    </Card>
  )
}

function NpoInfoCard({ npoId, config }: CardProps) {
  const queryClient = useQueryClient()
  const [npoInfoText, setNpoInfoText] = useState(config.npo_info_text ?? '')

  const saveMutation = useMutation({
    mutationFn: (data: DonateNowConfigUpdate) =>
      donateNowAdminApi.updateConfig(npoId, data).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.setQueryData(['donate-now-config', npoId], data)
      toast.success('NPO information saved')
    },
    onError: () => toast.error('Failed to save'),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>NPO Information</CardTitle>
        <CardDescription>
          Text shown on the donation page describing your organization
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='space-y-2'>
          <Label htmlFor='npo-info-text'>About Your Organization</Label>
          <Textarea
            id='npo-info-text'
            value={npoInfoText}
            onChange={(e) => setNpoInfoText(e.target.value)}
            placeholder='Tell donors about your mission...'
            rows={6}
          />
        </div>
        <Button
          onClick={() =>
            saveMutation.mutate({ npo_info_text: npoInfoText || null })
          }
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending && (
            <Loader2 className='mr-2 h-4 w-4 animate-spin' />
          )}
          Save NPO Information
        </Button>
      </CardContent>
    </Card>
  )
}
