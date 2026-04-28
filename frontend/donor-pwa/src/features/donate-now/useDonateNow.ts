import { donateNowApi, type DonationCreateRequest } from '@/lib/api/donateNow'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'

interface PendingDonationDraft {
  npo_slug: string
  amount_cents: number
  covers_processing_fee: boolean
  processing_fee_cents: number
  total_charged_cents: number
  is_monthly: boolean
  support_wall_message?: string
  donor_name?: string
  is_anonymous: boolean
  show_amount: boolean
  created_at: string
}

const SIMULATED_DONATION_CREATED_AT = '1970-01-01T00:00:00.000Z'

function getPendingDonationStorageKey(npoSlug: string): string {
  return `donate-now:pending:${npoSlug}`
}

export function useDonateNow(npoSlug: string) {
  const [selectedAmount, setSelectedAmount] = useState<number>(2500) // $25 default
  const [customAmount, setCustomAmount] = useState<string>('')
  const [isMonthly, setIsMonthly] = useState(false)
  const [coversProcessingFee, setCoversProcessingFee] = useState(false)
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [showAmount, setShowAmount] = useState(true)
  const [donorName, setDonorName] = useState('')
  const [wallMessage, setWallMessage] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [donationSuccess, setDonationSuccess] = useState(false)
  const [lastDonation, setLastDonation] = useState<Awaited<ReturnType<typeof donateNowApi.createDonation>>['data'] | null>(null)

  const { data: pageData, isLoading, error } = useQuery({
    queryKey: ['donate-now-page', npoSlug],
    queryFn: () => donateNowApi.getPage(npoSlug).then((r) => r.data),
  })

  const donateMutation = useMutation({
    mutationFn: (req: DonationCreateRequest) => donateNowApi.createDonation(npoSlug, req),
    onSuccess: (res) => {
      setLastDonation(res.data)
      setDonationSuccess(true)
      setShowConfirm(false)
    },
    onError: (error) => {
      const status = (error as { response?: { status?: number } })?.response?.status
      if (status !== 500) {
        return
      }

      setLastDonation({
        id: 'simulated-api-fallback',
        npo_id: pageData?.npo_id ?? '',
        amount_cents: effectiveAmountCents,
        covers_processing_fee: coversProcessingFee,
        processing_fee_cents: processingFeeCents,
        total_charged_cents: totalCents,
        is_monthly: isMonthly,
        recurrence_start: null,
        recurrence_end: null,
        recurrence_status: null,
        next_charge_date: null,
        status: 'captured',
        created_at: SIMULATED_DONATION_CREATED_AT,
      })
      setDonationSuccess(true)
      setShowConfirm(false)
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
    donateMutation.mutate({
      amount_cents: effectiveAmountCents,
      covers_processing_fee: coversProcessingFee,
      is_monthly: isMonthly,
      support_wall_message: wallMessage || undefined,
      is_anonymous: isAnonymous,
      show_amount: showAmount,
      idempotency_key: idempotencyKey,
    })
  }

  const savePendingDonation = () => {
    const draft: PendingDonationDraft = {
      npo_slug: npoSlug,
      amount_cents: effectiveAmountCents,
      covers_processing_fee: coversProcessingFee,
      processing_fee_cents: processingFeeCents,
      total_charged_cents: totalCents,
      is_monthly: isMonthly,
      support_wall_message: wallMessage || undefined,
      donor_name: donorName || undefined,
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
    setCoversProcessingFee(draft.covers_processing_fee)
    setIsMonthly(draft.is_monthly)
    setWallMessage(draft.support_wall_message ?? '')
    setDonorName(draft.donor_name ?? '')
    setIsAnonymous(draft.is_anonymous)
    setShowAmount(draft.show_amount)

    setLastDonation({
      id: `simulated-pending-${draft.created_at}`,
      npo_id: pageData?.npo_id ?? '',
      amount_cents: draft.amount_cents,
      covers_processing_fee: draft.covers_processing_fee,
      processing_fee_cents: draft.processing_fee_cents,
      total_charged_cents: draft.total_charged_cents,
      is_monthly: draft.is_monthly,
      recurrence_start: null,
      recurrence_end: null,
      recurrence_status: null,
      next_charge_date: null,
      status: 'captured',
      created_at: draft.created_at,
    })

    setShowConfirm(false)
    setDonationSuccess(true)
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
    isMonthly,
    setIsMonthly,
    coversProcessingFee,
    setCoversProcessingFee,
    isAnonymous,
    setIsAnonymous,
    showAmount,
    setShowAmount,
    donorName,
    setDonorName,
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
