import { useState } from 'react'
import { AxiosError } from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import {
  donateNowApi,
  type DonationCreateRequest,
  type DonationResponse,
  SUPPORT_WALL_PAGE_SIZE,
  type SupportWallEntry,
  type SupportWallPage,
} from '@/lib/api/donateNow'
import { triggerCelebrationConfetti } from '@/lib/celebration-confetti'

interface PendingDonationDraft {
  npo_slug: string
  amount_cents: number
  donor_name?: string
  covers_processing_fee: boolean
  processing_fee_cents: number
  total_charged_cents: number
  is_monthly: boolean
  support_wall_message?: string
  is_anonymous: boolean
  show_amount: boolean
  created_at: string
}

function getPendingDonationStorageKey(npoSlug: string): string {
  return `donate-now:pending:${npoSlug}`
}

function toUrlAmountCents(urlAmountDollars?: number): number | null {
  if (
    !Number.isFinite(urlAmountDollars) ||
    !urlAmountDollars ||
    urlAmountDollars <= 0
  ) {
    return null
  }

  return Math.round(urlAmountDollars * 100)
}

function formatAmountFromCents(amountCents: number): string {
  const dollars = amountCents / 100
  if (Number.isInteger(dollars)) {
    return String(dollars)
  }

  return dollars.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

export function useDonateNow(npoSlug: string, urlAmountDollars?: number) {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const defaultDonorName =
    `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim()
  const urlAmountCents = toUrlAmountCents(urlAmountDollars)

  const [selectedAmount, setSelectedAmount] = useState<number>(
    () => urlAmountCents ?? 2500
  ) // $25 default
  const [customAmount, setCustomAmount] = useState<string>(() =>
    urlAmountCents ? formatAmountFromCents(urlAmountCents) : ''
  )
  const [donorName, setDonorName] = useState<string>(defaultDonorName)
  const [isMonthly, setIsMonthly] = useState(false)
  const [coversProcessingFee, setCoversProcessingFee] = useState(true)
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [showAmount, setShowAmount] = useState(true)
  const [wallMessage, setWallMessage] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [donationSuccess, setDonationSuccess] = useState(false)
  const [lastDonation, setLastDonation] = useState<
    Awaited<ReturnType<typeof donateNowApi.createDonation>>['data'] | null
  >(null)

  const {
    data: pageData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['donate-now-page', npoSlug],
    queryFn: () => donateNowApi.getPage(npoSlug).then((r) => r.data),
  })

  const buildSupportWallEntry = (
    donation: DonationResponse,
    request: DonationCreateRequest
  ): SupportWallEntry | null => {
    const trimmedMessage = request.support_wall_message?.trim() || null
    if (request.is_anonymous && !trimmedMessage) {
      return null
    }

    const resolvedDisplayName = request.is_anonymous
      ? null
      : request.donor_name?.trim() || defaultDonorName || null

    return {
      id: donation.id,
      display_name: resolvedDisplayName,
      is_anonymous: request.is_anonymous ?? false,
      show_amount: request.show_amount ?? true,
      amount_cents:
        request.show_amount === false ? null : donation.amount_cents,
      is_monthly: request.is_monthly ?? false,
      tier_label: null,
      message: trimmedMessage,
      created_at: donation.created_at,
    }
  }

  const updateSupportWallCache = (
    donation: DonationResponse,
    request: DonationCreateRequest
  ) => {
    const nextEntry = buildSupportWallEntry(donation, request)
    if (!nextEntry) {
      return
    }

    queryClient.setQueryData<SupportWallPage>(
      ['support-wall', npoSlug, 1],
      (current) => {
        const perPage = current?.per_page ?? SUPPORT_WALL_PAGE_SIZE
        const total = (current?.total ?? 0) + 1

        return {
          entries: [nextEntry, ...(current?.entries ?? [])].slice(0, perPage),
          total,
          page: 1,
          per_page: perPage,
          pages: Math.max(1, Math.ceil(total / perPage)),
        }
      }
    )
  }

  const donateMutation = useMutation({
    mutationFn: (req: DonationCreateRequest) =>
      donateNowApi.createDonation(npoSlug, req),
    onSuccess: (res, request) => {
      updateSupportWallCache(res.data, request)
      void queryClient.invalidateQueries({
        queryKey: ['support-wall', npoSlug],
      })
      setLastDonation(res.data)
      setDonationSuccess(true)
      setShowConfirm(false)
      triggerCelebrationConfetti()
    },
  })

  const effectiveAmountCents = customAmount
    ? Math.round(parseFloat(customAmount) * 100)
    : selectedAmount

  const feePercent = parseFloat(pageData?.processing_fee_pct ?? '0')
  const processingFeeCents = coversProcessingFee
    ? Math.round(effectiveAmountCents * feePercent)
    : 0
  const totalCents = effectiveAmountCents + processingFeeCents

  const handleDonate = () => {
    if (!effectiveAmountCents || effectiveAmountCents <= 0) return
    const idempotencyKey = `donor-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const donationRequest: DonationCreateRequest = {
      amount_cents: effectiveAmountCents,
      donor_name: donorName.trim() || undefined,
      covers_processing_fee: coversProcessingFee,
      is_monthly: isMonthly,
      support_wall_message: wallMessage || undefined,
      is_anonymous: isAnonymous,
      show_amount: showAmount,
      idempotency_key: idempotencyKey,
    }

    void donateMutation.mutateAsync(donationRequest).catch(async (error) => {
      if (
        donationRequest.donor_name &&
        error instanceof AxiosError &&
        error.response?.status === 500
      ) {
        await donateMutation.mutateAsync({
          ...donationRequest,
          donor_name: undefined,
        })
      }
    })
  }

  const savePendingDonation = () => {
    const draft: PendingDonationDraft = {
      npo_slug: npoSlug,
      amount_cents: effectiveAmountCents,
      donor_name: donorName.trim() || undefined,
      covers_processing_fee: coversProcessingFee,
      processing_fee_cents: processingFeeCents,
      total_charged_cents: totalCents,
      is_monthly: isMonthly,
      support_wall_message: wallMessage || undefined,
      is_anonymous: isAnonymous,
      show_amount: showAmount,
      created_at: new Date().toISOString(),
    }

    sessionStorage.setItem(
      getPendingDonationStorageKey(npoSlug),
      JSON.stringify(draft)
    )
  }

  const loadPendingDonation = (): PendingDonationDraft | null => {
    const raw = sessionStorage.getItem(getPendingDonationStorageKey(npoSlug))
    if (!raw) return null

    try {
      return JSON.parse(raw) as PendingDonationDraft
    } catch {
      return null
    }
  }

  const clearPendingDonation = () => {
    sessionStorage.removeItem(getPendingDonationStorageKey(npoSlug))
  }

  const completePendingDonation = (): boolean => {
    const draft = loadPendingDonation()
    if (!draft) return false

    setSelectedAmount(draft.amount_cents)
    setCustomAmount('')
    setDonorName(draft.donor_name ?? defaultDonorName)
    setCoversProcessingFee(draft.covers_processing_fee)
    setIsMonthly(draft.is_monthly)
    setWallMessage(draft.support_wall_message ?? '')
    setIsAnonymous(draft.is_anonymous)
    setShowAmount(draft.show_amount)

    setShowConfirm(true)
    setDonationSuccess(false)
    clearPendingDonation()
    return true
  }

  return {
    pageData,
    isLoading,
    error,
    selectedAmount,
    setSelectedAmount,
    customAmount,
    setCustomAmount,
    donorName,
    setDonorName,
    isMonthly,
    setIsMonthly,
    coversProcessingFee,
    setCoversProcessingFee,
    isAnonymous,
    setIsAnonymous,
    showAmount,
    setShowAmount,
    wallMessage,
    setWallMessage,
    showConfirm,
    setShowConfirm,
    effectiveAmountCents,
    processingFeeCents,
    totalCents,
    feePercent,
    handleDonate,
    isPending: donateMutation.isPending,
    donateError: donateMutation.error,
    donationSuccess,
    lastDonation,
    setDonationSuccess,
    savePendingDonation,
    clearPendingDonation,
    completePendingDonation,
  }
}
